"""
Celery configuration for Task Manager project.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'task_manager.settings')

# Create the Celery app
app = Celery('task_manager')

# Load config from Django settings, using the CELERY namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

# Celery Beat schedule for periodic tasks
app.conf.beat_schedule = {
    # Check for upcoming deadlines every hour
    'check-deadline-reminders': {
        'task': 'apps.tasks.tasks.send_deadline_reminders',
        'schedule': crontab(minute=0),  # Run at the start of every hour
    },
    # Check for overdue tasks daily at 8 AM
    'check-overdue-tasks': {
        'task': 'apps.tasks.tasks.mark_overdue_tasks',
        'schedule': crontab(hour=8, minute=0),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to test Celery is working"""
    print(f'Request: {self.request!r}')
