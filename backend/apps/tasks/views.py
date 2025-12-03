from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task, TaskAttachment, ActivityLog, Comment
from .serializers import (
    TaskSerializer, TaskUpdateSerializer, 
    TaskAttachmentSerializer, ActivityLogSerializer,
    CommentSerializer
)
from .permissions import (
    TaskPermissions, TaskAttachmentPermissions,
    CanUpdateTaskStatus, CanAttachFiles, CanViewActivityLogs
)
from apps.notifications.models import send_notification_ws
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    permission_classes = [IsAuthenticated, TaskPermissions]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'due_date', 'priority']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return TaskUpdateSerializer
        return TaskSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'supervisor':
            return Task.objects.all()
        elif user.role == 'atl':
            # ATLs can see tasks assigned to clerks and ATMs
            return Task.objects.filter(
                assigned_to__role__in=['clerk', 'atm']
            ).distinct()
        else:
            # Regular users can only see tasks assigned to them
            return Task.objects.filter(assigned_to=user)
    
    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        self.create_activity_log(task, 'created')
        
        # Send real-time notifications to assigned users
        for assigned_user in task.assigned_to.all():
            send_notification_ws(assigned_user.id, {
                'type': 'task_assigned',
                'title': 'New Task Assigned',
                'message': f'You have been assigned to task: {task.title}',
                'task_id': task.id,
            })
    
    def perform_update(self, serializer):
        old_task = self.get_object()
        old_status = old_task.status
        old_assigned = set(old_task.assigned_to.values_list('id', flat=True))
        
        task = serializer.save()
        new_assigned = set(task.assigned_to.values_list('id', flat=True))
        
        # Create activity log
        self.create_activity_log(task, 'updated')
        
        # Notify about status changes
        if task.status != old_status:
            for user in task.assigned_to.all():
                send_notification_ws(user.id, {
                    'type': 'status_change',
                    'title': 'Task Status Updated',
                    'message': f'Task "{task.title}" status changed to {task.status}',
                    'task_id': task.id,
                    'old_status': old_status,
                    'new_status': task.status,
                })
        
        # Notify newly assigned users
        newly_assigned = new_assigned - old_assigned
        for user_id in newly_assigned:
            send_notification_ws(user_id, {
                'type': 'task_assigned',
                'title': 'Task Assigned',
                'message': f'You have been assigned to task: {task.title}',
                'task_id': task.id,
            })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def assign(self, request, pk=None):
        """Assign task to users"""
        task = self.get_object()
        user_ids = request.data.get('user_ids', [])
        
        # Clear existing assignments or add new ones based on request
        if request.data.get('replace', False):
            task.assigned_to.clear()
        
        users = User.objects.filter(id__in=user_ids)
        task.assigned_to.add(*users)
        
        # Send notifications to newly assigned users
        for user in users:
            send_notification_ws(user.id, {
                'type': 'task_assigned',
                'title': 'Task Assigned',
                'message': f'You have been assigned to task: {task.title}',
                'task_id': task.id,
            })
        
        # Create activity log
        self.create_activity_log(task, 'assigned', {
            'user_ids': user_ids,
            'replace': request.data.get('replace', False)
        })
        
        serializer = self.get_serializer(task)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanUpdateTaskStatus])
    def update_status(self, request, pk=None):
        """Update task status"""
        task = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in dict(Task.Status.choices):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = task.status
        task.status = new_status
        
        if new_status == 'done':
            task.completed_at = timezone.now()
        
        task.save()
        
        # Create activity log
        self.create_activity_log(task, 'status_changed', {
            'old_status': old_status,
            'new_status': new_status
        })
        
        # Send notification to all assigned users
        for user in task.assigned_to.all():
            send_notification_ws(user.id, {
                'type': 'status_change',
                'title': 'Task Status Updated',
                'message': f'Task "{task.title}" status changed to {new_status}',
                'task_id': task.id,
                'old_status': old_status,
                'new_status': new_status,
            })
        
        serializer = self.get_serializer(task)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanAttachFiles])
    def upload_attachment(self, request, pk=None):
        """Upload attachment to task"""
        task = self.get_object()
        file = request.FILES.get('file')
        
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (max 50MB)
        if file.size > 50 * 1024 * 1024:
            return Response(
                {'error': 'File size exceeds 50MB limit'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file type
        allowed_types = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]
        
        if file.content_type not in allowed_types:
            return Response(
                {'error': 'File type not allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attachment = TaskAttachment.objects.create(
            task=task,
            file=file,
            uploaded_by=request.user,
            file_name=file.name,
            file_size=file.size,
            mime_type=file.content_type
        )
        
        # Create activity log
        self.create_activity_log(task, 'file_attached', {
            'file_name': file.name,
            'file_size': file.size,
        })
        
        # Send notification to all assigned users (except uploader)
        for user in task.assigned_to.all():
            if user.id != request.user.id:
                send_notification_ws(user.id, {
                    'type': 'file_attached',
                    'title': 'File Attached',
                    'message': f'New file attached to task "{task.title}"',
                    'task_id': task.id,
                    'file_name': file.name,
                })
        
        serializer = TaskAttachmentSerializer(attachment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated, CanViewActivityLogs])
    def activity_logs(self, request, pk=None):
        """Get activity logs for task"""
        task = self.get_object()
        logs = ActivityLog.objects.filter(task=task)
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticated])
    def attachments(self, request, pk=None):
        """Get or upload attachments for a task"""
        task = self.get_object()
        
        if request.method == 'GET':
            attachments = TaskAttachment.objects.filter(task=task)
            serializer = TaskAttachmentSerializer(attachments, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            file = request.FILES.get('file')
            
            if not file:
                return Response(
                    {'error': 'No file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file size (max 50MB)
            if file.size > 50 * 1024 * 1024:
                return Response(
                    {'error': 'File size exceeds 50MB limit'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            attachment = TaskAttachment.objects.create(
                task=task,
                file=file,
                uploaded_by=request.user,
                file_name=file.name,
                file_size=file.size,
                mime_type=file.content_type or 'application/octet-stream'
            )
            
            # Create activity log
            self.create_activity_log(task, 'file_attached', {
                'file_name': file.name,
                'file_size': file.size,
            })
            
            # Send notification to all assigned users (except uploader)
            for user in task.assigned_to.all():
                if user.id != request.user.id:
                    send_notification_ws(user.id, {
                        'type': 'file_attached',
                        'title': 'File Attached',
                        'message': f'New file attached to task "{task.title}"',
                        'task_id': task.id,
                        'file_name': file.name,
                    })
            
            serializer = TaskAttachmentSerializer(attachment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticated])
    def comments(self, request, pk=None):
        """Get or create comments for a task"""
        task = self.get_object()
        
        if request.method == 'GET':
            comments = Comment.objects.filter(task=task)
            serializer = CommentSerializer(comments, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            content = request.data.get('content', '').strip()
            
            if not content:
                return Response(
                    {'error': 'Comment content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            comment = Comment.objects.create(
                task=task,
                user=request.user,
                content=content
            )
            
            # Create activity log
            self.create_activity_log(task, 'comment_added', {
                'comment_id': comment.id,
                'content_preview': content[:50] + '...' if len(content) > 50 else content
            })
            
            # Send notification to all assigned users (except commenter)
            for user in task.assigned_to.all():
                if user.id != request.user.id:
                    send_notification_ws(user.id, {
                        'type': 'comment_added',
                        'title': 'New Comment',
                        'message': f'{request.user.first_name or request.user.username} commented on task "{task.title}"',
                        'task_id': task.id,
                        'comment_id': comment.id,
                    })
            
            # Also notify task creator if different from commenter and not assigned
            if task.created_by.id != request.user.id and task.created_by not in task.assigned_to.all():
                send_notification_ws(task.created_by.id, {
                    'type': 'comment_added',
                    'title': 'New Comment',
                    'message': f'{request.user.first_name or request.user.username} commented on task "{task.title}"',
                    'task_id': task.id,
                    'comment_id': comment.id,
                })
            
            serializer = CommentSerializer(comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def create_activity_log(self, task, action, details=None):
        """Helper method to create activity logs"""
        ActivityLog.objects.create(
            task=task,
            user=self.request.user,
            action=action,
            details=details or {},
            ip_address=self.get_client_ip()
        )
    
    def get_client_ip(self):
        """Get client IP address"""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = self.request.META.get('REMOTE_ADDR')
        return ip


class TaskAttachmentViewSet(viewsets.ModelViewSet):
    queryset = TaskAttachment.objects.all()
    serializer_class = TaskAttachmentSerializer
    permission_classes = [IsAuthenticated, TaskAttachmentPermissions]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'supervisor':
            return TaskAttachment.objects.all()
        elif user.role == 'atl':
            # ATLs can see attachments for tasks assigned to clerks and ATMs
            return TaskAttachment.objects.filter(
                task__assigned_to__role__in=['clerk', 'atm']
            ).distinct()
        else:
            # Regular users can only see attachments for tasks assigned to them
            return TaskAttachment.objects.filter(task__assigned_to=user)
    
    def perform_create(self, serializer):
        # File validation is handled in the task upload_attachment action
        # This view is mainly for retrieving and deleting attachments
        pass
    
    def perform_destroy(self, instance):
        task = instance.task
        # Create activity log before deletion
        ActivityLog.objects.create(
            task=task,
            user=self.request.user,
            action='file_removed',
            details={
                'file_name': instance.file_name,
                'file_size': instance.file_size,
            },
            ip_address=self.get_client_ip()
        )
        instance.delete()
    
    def get_client_ip(self):
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = self.request.META.get('REMOTE_ADDR')
        return ip