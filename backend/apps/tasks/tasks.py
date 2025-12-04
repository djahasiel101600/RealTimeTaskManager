"""
Celery tasks for task management.
"""
from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_deadline_reminders(self):
    """
    Send reminder notifications for tasks approaching their deadline.
    Runs hourly via Celery Beat.
    """
    from apps.tasks.models import Task
    from apps.notifications.models import Notification
    
    now = timezone.now()
    
    # Remind for tasks due in the next 24 hours that haven't been reminded yet
    reminder_threshold = now + timedelta(hours=24)
    
    tasks_due_soon = Task.objects.filter(
        due_date__lte=reminder_threshold,
        due_date__gt=now,
        status__in=['pending', 'in_progress'],
    ).select_related('assigned_to', 'created_by')
    
    channel_layer = get_channel_layer()
    notifications_sent = 0
    
    for task in tasks_due_soon:
        # Check if we already sent a reminder for this task today
        existing_reminder = Notification.objects.filter(
            user=task.assigned_to,
            title__contains='Deadline Reminder',
            created_at__date=now.date(),
        ).filter(message__contains=task.title).exists()
        
        if existing_reminder:
            continue
        
        # Calculate time until deadline
        time_left = task.due_date - now
        hours_left = int(time_left.total_seconds() / 3600)
        
        # Create notification
        notification = Notification.objects.create(
            user=task.assigned_to,
            title='Deadline Reminder',
            message=f'Task "{task.title}" is due in {hours_left} hours!',
            notification_type='deadline',
        )
        
        # Send real-time notification via WebSocket
        try:
            async_to_sync(channel_layer.group_send)(
                f"notifications_{task.assigned_to.id}",
                {
                    'type': 'notification_message',
                    'notification': {
                        'id': notification.id,
                        'title': notification.title,
                        'message': notification.message,
                        'notification_type': notification.notification_type,
                        'is_read': notification.is_read,
                        'created_at': notification.created_at.isoformat(),
                    }
                }
            )
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification: {e}")
        
        # Send email notification
        if task.assigned_to.email:
            try:
                send_mail(
                    subject=f'Deadline Reminder: {task.title}',
                    message=f'''Hello {task.assigned_to.username},

This is a reminder that your task "{task.title}" is due in {hours_left} hours.

Task Details:
- Title: {task.title}
- Due Date: {task.due_date.strftime("%Y-%m-%d %H:%M")}
- Priority: {task.priority}
- Status: {task.status}

Please log in to the Task Manager to complete this task.

Best regards,
Task Manager Team''',
                    from_email=settings.DEFAULT_FROM_EMAIL or 'noreply@taskmanager.com',
                    recipient_list=[task.assigned_to.email],
                    fail_silently=True,
                )
            except Exception as e:
                logger.error(f"Failed to send deadline email: {e}")
        
        notifications_sent += 1
    
    logger.info(f"Sent {notifications_sent} deadline reminder notifications")
    return f"Sent {notifications_sent} deadline reminders"


@shared_task(bind=True, max_retries=3)
def mark_overdue_tasks(self):
    """
    Mark tasks that are past their deadline as overdue.
    Runs daily at 8 AM via Celery Beat.
    """
    from apps.tasks.models import Task
    from apps.notifications.models import Notification
    
    now = timezone.now()
    channel_layer = get_channel_layer()
    
    # Find overdue tasks that are still pending or in progress
    overdue_tasks = Task.objects.filter(
        due_date__lt=now,
        status__in=['pending', 'in_progress'],
    ).select_related('assigned_to', 'created_by')
    
    overdue_count = 0
    
    for task in overdue_tasks:
        # Check if we already notified about this overdue task
        already_notified = Notification.objects.filter(
            user=task.assigned_to,
            title='Task Overdue',
        ).filter(message__contains=task.title).exists()
        
        if already_notified:
            continue
        
        # Create notification
        notification = Notification.objects.create(
            user=task.assigned_to,
            title='Task Overdue',
            message=f'Task "{task.title}" is now overdue!',
            notification_type='overdue',
        )
        
        # Also notify the task creator
        if task.created_by and task.created_by != task.assigned_to:
            Notification.objects.create(
                user=task.created_by,
                title='Assigned Task Overdue',
                message=f'Task "{task.title}" assigned to {task.assigned_to.username} is overdue.',
                notification_type='overdue',
            )
        
        # Send real-time notification
        try:
            async_to_sync(channel_layer.group_send)(
                f"notifications_{task.assigned_to.id}",
                {
                    'type': 'notification_message',
                    'notification': {
                        'id': notification.id,
                        'title': notification.title,
                        'message': notification.message,
                        'notification_type': notification.notification_type,
                        'is_read': notification.is_read,
                        'created_at': notification.created_at.isoformat(),
                    }
                }
            )
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification: {e}")
        
        overdue_count += 1
    
    logger.info(f"Marked {overdue_count} tasks as overdue and sent notifications")
    return f"Processed {overdue_count} overdue tasks"


@shared_task
def send_task_notification(user_id: int, title: str, message: str, notification_type: str = 'info'):
    """
    Helper task to send a notification to a specific user.
    Can be called from anywhere in the application.
    """
    from apps.notifications.models import Notification
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return
    
    # Create notification
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
    )
    
    # Send via WebSocket
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)(
            f"notifications_{user_id}",
            {
                'type': 'notification_message',
                'notification': {
                    'id': notification.id,
                    'title': notification.title,
                    'message': notification.message,
                    'notification_type': notification.notification_type,
                    'is_read': notification.is_read,
                    'created_at': notification.created_at.isoformat(),
                }
            }
        )
    except Exception as e:
        logger.warning(f"Failed to send WebSocket notification: {e}")
    
    return f"Notification sent to user {user_id}"
