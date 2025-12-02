from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('task_assigned', 'Task Assigned'),
        ('task_updated', 'Task Updated'),
        ('due_date', 'Due Date Reminder'),
        ('chat_message', 'New Chat Message'),
        ('file_attached', 'File Attached'),
        ('status_change', 'Status Changed'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    data = models.JSONField(default=dict)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.type} - {self.user.username}"


# Task-related signals
@receiver(post_save, sender='tasks.Task')
def notify_task_created(sender, instance, created, **kwargs):
    if created:
        # Notify assigned users
        for user in instance.assigned_to.all():
            Notification.objects.create(
                user=user,
                type='task_assigned',
                title='New Task Assigned',
                message=f'You have been assigned to task: {instance.title}',
                data={'task_id': instance.id}
            )
            send_notification_ws(user.id, {
                'type': 'task_assigned',
                'title': 'New Task Assigned',
                'message': f'You have been assigned to task: {instance.title}',
                'task_id': instance.id,
            })


@receiver(post_save, sender='tasks.TaskAttachment')
def notify_file_attached(sender, instance, created, **kwargs):
    if created:
        # Notify task assignees except uploader
        for user in instance.task.assigned_to.all():
            if user.id != instance.uploaded_by.id:
                Notification.objects.create(
                    user=user,
                    type='file_attached',
                    title='File Attached',
                    message=f'New file attached to task: {instance.task.title}',
                    data={
                        'task_id': instance.task.id,
                        'file_name': instance.file_name,
                    }
                )
                send_notification_ws(user.id, {
                    'type': 'file_attached',
                    'title': 'File Attached',
                    'message': f'New file attached to task: {instance.task.title}',
                    'task_id': instance.task.id,
                    'file_name': instance.file_name,
                })


# Chat-related signals - Now using string reference to avoid import issues
@receiver(post_save, sender='chat.Message')
def notify_new_message(sender, instance, created, **kwargs):
    if created:
        # Import here to avoid circular imports
        from apps.chat.models import ChatRoom
        
        # Notify room participants except sender
        participants = instance.room.participants.exclude(id=instance.sender.id)
        for user in participants:
            Notification.objects.create(
                user=user,
                type='chat_message',
                title='New Message',
                message=f'New message from {instance.sender.username}',
                data={
                    'room_id': instance.room.id,
                    'message_id': instance.id,
                    'sender_id': instance.sender.id,
                }
            )
            send_notification_ws(user.id, {
                'type': 'chat_message',
                'title': 'New Message',
                'message': f'New message from {instance.sender.username}',
                'room_id': instance.room.id,
            })


def send_notification_ws(user_id, data):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user_id}',
            {
                'type': 'send_notification',
                'data': data
            }
        )
    except Exception as e:
        # Log error but don't crash the app
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send WebSocket notification: {e}")