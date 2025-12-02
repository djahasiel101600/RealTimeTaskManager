from django.contrib import admin
from .models import ChatRoom, Message, MessageAttachment


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('sender', 'content', 'timestamp')


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'room_type', 'name', 'task', 'created_at')
    list_filter = ('room_type', 'created_at')
    filter_horizontal = ('participants',)
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'room', 'short_content', 'timestamp', 'is_read')
    list_filter = ('is_read', 'timestamp', 'room__room_type')
    search_fields = ('content', 'sender__username', 'room__name')
    
    def short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    short_content.short_description = 'Content'


@admin.register(MessageAttachment)
class MessageAttachmentAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'message', 'file_size', 'uploaded_at')
    list_filter = ('uploaded_at', 'mime_type')