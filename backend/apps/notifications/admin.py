from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'title', 'is_read', 'created_at')
    list_filter = ('type', 'is_read', 'created_at')
    search_fields = ('title', 'message', 'user__username')
    readonly_fields = ('created_at',)
    
    fieldsets = (
        (None, {
            'fields': ('user', 'type', 'title', 'message')
        }),
        ('Data', {
            'fields': ('data', 'is_read')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )