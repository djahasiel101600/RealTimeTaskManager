from rest_framework import serializers
from .models import Task, TaskAttachment, ActivityLog, Comment
from .models import TaskAssignment
from apps.users.serializers import UserSerializer
from apps.users.models import User
from .models import Status
from rest_framework.validators import ValidationError


class CommentSerializer(serializers.ModelSerializer):
    """Serializer for task comments."""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'task', 'user', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'task', 'user', 'created_at', 'updated_at']


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
        source='assigned_to',
        required=False
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


class StatusUpdateSerializer(serializers.Serializer):
    """Serializer for the `update_status` action.

    Fields:
    - status: required; must be one of the valid Status choices.
    - reason: optional string; required for critical transitions (view enforces requirement).
    """
    status = serializers.ChoiceField(choices=Status.choices)
    reason = serializers.CharField(required=False, allow_blank=False)

    def validate(self, attrs):
        # Basic validation is handled here if needed in future.
        return attrs


class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'details', 'timestamp', 'ip_address']


class TaskAssignmentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    assigned_by = UserSerializer(read_only=True)

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'task', 'user', 'assigned_by', 'status', 'reason', 'created_at', 'responded_at'
        ]
        read_only_fields = ['id', 'task', 'assigned_by', 'status', 'created_at', 'responded_at']