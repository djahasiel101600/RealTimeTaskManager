from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.notifications.models import send_notification_ws, Notification
from .models import Task, TaskAttachment


@receiver(post_save, sender=Task)
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


@receiver(post_save, sender=TaskAttachment)
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