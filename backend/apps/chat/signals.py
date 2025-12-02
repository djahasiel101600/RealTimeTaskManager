from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.notifications.models import send_notification_ws, Notification
from .models import Message


@receiver(post_save, sender=Message)
def notify_new_message(sender, instance, created, **kwargs):
    if created:
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