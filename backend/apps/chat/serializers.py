from rest_framework import serializers
from django.conf import settings
from .models import ChatRoom, Message, MessageAttachment
from apps.users.serializers import UserSerializer
from apps.tasks.serializers import TaskSerializer


class MessageAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = MessageAttachment
        fields = ['id', 'file', 'file_url', 'file_name', 'file_size', 'mime_type', 'uploaded_at']
        read_only_fields = ['file_name', 'file_size', 'mime_type', 'uploaded_at']
    
    def get_file_url(self, obj):
        """Return the full URL for the file"""
        if obj.file:
            # Use BACKEND_URL from settings for consistent absolute URLs
            backend_url = getattr(settings, 'BACKEND_URL', '')
            if backend_url:
                return f"{backend_url.rstrip('/')}{obj.file.url}"
            # Fallback to request-based URL building
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Message
        fields = ['id', 'room', 'sender', 'content', 'attachments', 'timestamp', 'is_read']
        read_only_fields = ['sender', 'timestamp', 'is_read']


class MessageCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True, default='')
    
    class Meta:
        model = Message
        fields = ['room', 'content']


class ChatRoomSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    task = TaskSerializer(read_only=True)
    last_message = MessageSerializer(read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ChatRoom
        fields = [
            'id', 'room_type', 'name', 'task', 'participants',
            'last_message', 'unread_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ChatRoomCreateSerializer(serializers.Serializer):
    room_type = serializers.ChoiceField(choices=ChatRoom.ROOM_TYPES)
    name = serializers.CharField(required=False, allow_blank=True)
    task_id = serializers.IntegerField(required=False)
    other_user_id = serializers.IntegerField(required=False)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False
    )
    
    def validate(self, data):
        room_type = data.get('room_type')
        
        if room_type == 'direct' and not data.get('other_user_id'):
            raise serializers.ValidationError(
                {'other_user_id': 'This field is required for direct messages'}
            )
        
        if room_type == 'task' and not data.get('task_id'):
            raise serializers.ValidationError(
                {'task_id': 'This field is required for task chats'}
            )
        
        if room_type == 'group' and not data.get('name'):
            raise serializers.ValidationError(
                {'name': 'This field is required for group chats'}
            )
        
        return data