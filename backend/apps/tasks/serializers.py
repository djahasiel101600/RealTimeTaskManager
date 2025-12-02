from rest_framework import serializers
from .models import Task, TaskAttachment, ActivityLog
from apps.users.serializers import UserSerializer
from apps.users.models import User


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    
    class Meta:
        model = TaskAttachment
        fields = [
            'id', 'file', 'file_name', 'file_size', 
            'mime_type', 'uploaded_by', 'uploaded_at'
        ]
        read_only_fields = ['uploaded_by', 'file_name', 'file_size', 'mime_type']


class TaskSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(many=True, read_only=True)
    assigned_to_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        write_only=True,
        source='assigned_to'
    )
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'created_by', 'assigned_to',
            'assigned_to_ids', 'priority', 'status', 'due_date',
            'created_at', 'updated_at', 'completed_at', 'attachments'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at']
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TaskUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['title', 'description', 'priority', 'status', 'due_date']
        extra_kwargs = {
            'status': {'required': False},
            'due_date': {'required': False, 'allow_null': True},
        }


class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'details', 'timestamp', 'ip_address']