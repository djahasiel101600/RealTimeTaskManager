from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class Priority(models.TextChoices):
    LOW = 'low', _('Low')
    NORMAL = 'normal', _('Normal')
    HIGH = 'high', _('High')
    URGENT = 'urgent', _('Urgent')


class Status(models.TextChoices):
    TODO = 'todo', _('To Do')
    IN_PROGRESS = 'in_progress', _('In Progress')
    REVIEW = 'review', _('Review')
    DONE = 'done', _('Done')
    CANCELLED = 'cancelled', _('Cancelled')


class Task(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_tasks'
    )
    assigned_to = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='assigned_tasks'
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO
    )
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class TaskAttachment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='task_attachments/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField()
    mime_type = models.CharField(max_length=100)


class ActivityLog(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    action = models.CharField(max_length=50)
    details = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-timestamp']