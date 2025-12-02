from django.contrib import admin
from .models import Task, TaskAttachment, ActivityLog


class TaskAttachmentInline(admin.TabularInline):
    model = TaskAttachment
    extra = 0


class ActivityLogInline(admin.TabularInline):
    model = ActivityLog
    extra = 0
    readonly_fields = ('user', 'action', 'details', 'timestamp', 'ip_address')
    can_delete = False


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'status', 'priority', 'due_date', 'created_at')
    list_filter = ('status', 'priority', 'created_at')
    search_fields = ('title', 'description')
    filter_horizontal = ('assigned_to',)
    inlines = [TaskAttachmentInline, ActivityLogInline]
    
    fieldsets = (
        (None, {
            'fields': ('title', 'description', 'created_by')
        }),
        ('Assignment', {
            'fields': ('assigned_to', 'priority', 'status')
        }),
        ('Dates', {
            'fields': ('due_date', 'completed_at')
        }),
    )


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'task', 'uploaded_by', 'uploaded_at')
    list_filter = ('uploaded_at', 'mime_type')
    search_fields = ('file_name', 'task__title')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('task', 'user', 'action', 'timestamp')
    list_filter = ('action', 'timestamp')
    search_fields = ('task__title', 'user__username')
    readonly_fields = ('task', 'user', 'action', 'details', 'timestamp', 'ip_address')