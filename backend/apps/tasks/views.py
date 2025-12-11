from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task, TaskAttachment, ActivityLog, Comment, Status, TaskAssignment
from .serializers import (
    TaskSerializer, TaskUpdateSerializer, 
    TaskAttachmentSerializer, ActivityLogSerializer,
    CommentSerializer, StatusUpdateSerializer
)
from .serializers import TaskAssignmentSerializer
from .permissions import (
    TaskPermissions, TaskAttachmentPermissions,
    CanUpdateTaskStatus, CanAttachFiles, CanViewActivityLogs
)
from apps.notifications.models import send_notification_ws
import logging
from django.conf import settings
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.chat.models import ChatRoom, Message as ChatMessage

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
        from django.db.models import Q
        user = self.request.user

        if user.role == 'supervisor':
            return Task.objects.all()
        elif user.role == 'atl':
            # ATLs can see tasks assigned to clerks and ATMs
            return Task.objects.filter(
                assigned_to__role__in=['clerk', 'atm']
            ).distinct()
        else:
            # Regular users can see tasks they created or are assigned to
            return Task.objects.filter(Q(assigned_to=user) | Q(created_by=user)).distinct()
    
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
        old_due = getattr(old_task, 'due_date', None)
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

        # Create a system message for due date changes
        try:
            new_due = getattr(task, 'due_date', None)
            if old_due != new_due:
                # human-readable content
                content = f"Due date changed to {new_due.isoformat() if new_due else 'none'} by {self.request.user.username}"
                self.create_system_message(task, content)
        except Exception:
            logger.exception('Failed to create system message for due date change')

    def create_system_message(self, task, content):
        """Create a persisted system chat message in the task's room and broadcast it.

        Returns the created ChatMessage or None on failure.
        """
        try:
            room = ChatRoom.objects.filter(room_type='task', task=task).first()
            if not room:
                return None

            # Use request.user when available, otherwise fall back to None
            sender = getattr(self, 'request', None) and getattr(self.request, 'user', None)

            chat_msg = ChatMessage.objects.create(
                room=room,
                sender=sender,
                content=content,
                is_read=True
            )

            # Build sender dict for websocket payload
            backend_url = getattr(settings, 'BACKEND_URL', '')
            avatar_url = None
            if sender and getattr(sender, 'avatar', None) and hasattr(sender.avatar, 'url'):
                if backend_url:
                    avatar_url = f"{backend_url.rstrip('/')}{sender.avatar.url}"
                else:
                    # request may be missing in some contexts
                    try:
                        avatar_url = self.request.build_absolute_uri(sender.avatar.url)
                    except Exception:
                        avatar_url = None

            sender_dict = None
            if sender:
                sender_dict = {
                    'id': sender.id,
                    'username': sender.username,
                    'avatar': avatar_url,
                }

            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f'task_{room.id}',
                    {
                        'type': 'chat_message',
                        'message': {
                            'id': chat_msg.id,
                            'content': chat_msg.content,
                            'sender': sender_dict,
                            'timestamp': chat_msg.timestamp.isoformat(),
                            'room_type': 'task',
                            'room_id': room.id,
                            'attachments': [],
                        }
                    }
                )

            return chat_msg
        except Exception as e:
            logger.error(f"Failed to create/broadcast system chat message for task {task.id}: {e}")
            return None
    
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

        # Create a system chat message for the assignment
        try:
            names = ', '.join([u.username for u in users]) if users else ''
            if request.data.get('replace', False):
                content = f"Assignments replaced: {names}"
            else:
                content = f"Assigned: {names}"
            self.create_system_message(task, content)
        except Exception:
            # Don't fail the API if system message creation fails
            logger.exception('Failed to create system message for assign')

        serializer = self.get_serializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def propose_assignment(self, request, pk=None):
        """Propose assignment(s) to user(s). Users must accept to become assigned."""
        task = self.get_object()
        user_ids = request.data.get('user_ids') or []
        if not user_ids:
            return Response({'error': 'user_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for uid in user_ids:
            try:
                user = User.objects.get(id=uid)
            except User.DoesNotExist:
                continue
            # Create or get pending assignment
            assignment, created_flag = task.assignments.get_or_create(
                user=user,
                defaults={'assigned_by': request.user}
            )
            if created_flag:
                created.append(assignment.id)
                # Notify user via websocket
                send_notification_ws(user.id, {
                    'type': 'assignment_proposed',
                    'title': 'Task Assignment Proposed',
                    'message': f'You have been proposed for task: {task.title}',
                    'task_id': task.id,
                    'assignment_id': assignment.id,
                })

        self.create_activity_log(task, 'assignment_proposed', {'user_ids': user_ids})
        return Response({'created_assignment_ids': created})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def respond_assignment(self, request, pk=None):
        """User accepts or rejects a pending assignment. Payload: assignment_id, action='accept'|'reject', optional reason."""
        # Use a direct lookup for task because the requester (the proposed user)
        # may not yet be in the Task queryset (not assigned or creator). We still
        # enforce assignment ownership when fetching the assignment below.
        from django.shortcuts import get_object_or_404
        task = get_object_or_404(Task, pk=pk)
        assignment_id = request.data.get('assignment_id')
        action_choice = request.data.get('action')
        reason = request.data.get('reason')

        if not assignment_id or action_choice not in ('accept', 'reject'):
            return Response({'error': 'assignment_id and action are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            assignment = task.assignments.get(id=assignment_id, user=request.user)
        except Exception:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

        if assignment.status != 'pending':
            return Response({'error': 'Assignment already responded'}, status=status.HTTP_400_BAD_REQUEST)

        if action_choice == 'accept':
            assignment.status = 'accepted'
            assignment.responded_at = timezone.now()
            assignment.reason = reason or ''
            assignment.save()
            # Add user to task.assigned_to
            task.assigned_to.add(request.user)
            # Create activity log and notify
            self.create_activity_log(task, 'assignment_accepted', {'assignment_id': assignment.id})
            send_notification_ws(assignment.assigned_by.id if assignment.assigned_by else request.user.id, {
                'type': 'assignment_accepted',
                'title': 'Assignment Accepted',
                'message': f'{request.user.username} accepted assignment for task: {task.title}',
                'task_id': task.id,
                'assignment_id': assignment.id,
            })
            # Create a system message announcing the acceptance
            try:
                content = f"{request.user.username} accepted assignment for task: {task.title}"
                self.create_system_message(task, content)
            except Exception:
                logger.exception('Failed to create system message for assignment acceptance')
        else:
            assignment.status = 'rejected'
            assignment.responded_at = timezone.now()
            assignment.reason = reason or ''
            assignment.save()
            self.create_activity_log(task, 'assignment_rejected', {'assignment_id': assignment.id, 'reason': reason})
            send_notification_ws(assignment.assigned_by.id if assignment.assigned_by else request.user.id, {
                'type': 'assignment_rejected',
                'title': 'Assignment Rejected',
                'message': f'{request.user.username} rejected assignment for task: {task.title}',
                'task_id': task.id,
                'assignment_id': assignment.id,
            })
            try:
                content = f"{request.user.username} rejected assignment for task: {task.title}"
                self.create_system_message(task, content)
            except Exception:
                logger.exception('Failed to create system message for assignment rejection')

        return Response({'status': assignment.status})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanUpdateTaskStatus])
    def update_status(self, request, pk=None):
        """Update task status"""
        task = self.get_object()
        # Validate input with serializer
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data.get('status')
        # Optional reason for status change (required for critical transitions)
        reason = serializer.validated_data.get('reason')
        
        if new_status not in dict(Status.choices):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce allowed transitions
        try:
            if not task.can_transition(new_status):
                return Response(
                    {'error': f'Invalid status transition from {task.status} to {new_status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception:
            # If can_transition is not available or errors, fall back to permissive behavior
            pass
        # Require a reason for critical transitions (cancelled, done)
        critical_statuses = ['cancelled', 'done']
        if new_status in critical_statuses and not reason:
            return Response(
                {'error': 'A reason is required for this status change'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = task.status
        task.status = new_status
        
        if new_status == 'done':
            task.completed_at = timezone.now()
        
        task.save()
        
        # Create activity log
        details = {
            'old_status': old_status,
            'new_status': new_status,
        }
        if reason:
            details['reason'] = reason

        self.create_activity_log(task, 'status_changed', details)
        
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
        # Create a system chat message in the task chat room and broadcast it
        try:
            system_content = f"Status changed to {new_status} by {request.user.username}"
            if reason:
                system_content = f"{system_content}. Reason: {reason}"
            self.create_system_message(task, system_content)
        except Exception as e:
            logger.error(f"Failed to create/broadcast task status chat message: {e}")
        
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

        # Create a system chat message about the attachment
        try:
            content = f'File attached: {file.name} by {request.user.username}'
            self.create_system_message(task, content)
        except Exception:
            logger.exception('Failed to create system message for attachment')

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
            
            # Create a system chat message about the attachment
            try:
                content = f'File attached: {file.name} by {request.user.username}'
                self.create_system_message(task, content)
            except Exception:
                logger.exception('Failed to create system message for attachment (attachments POST)')

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

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def bulk_update(self, request):
        """Bulk update multiple tasks.

        Payload: { ids: [1,2,3], data: { status: 'done', priority: 'high' } }
        - Supervisors may update any tasks.
        - ATLs may update tasks they created or tasks assigned to clerks/atm.
        - Regular users are forbidden.
        """
        ids = request.data.get('ids') or []
        data = request.data.get('data') or {}

        if not isinstance(ids, list) or not ids:
            return Response({'error': 'ids (non-empty list) required'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if user.role not in ('supervisor', 'atl'):
            return Response({'error': 'permission denied'}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Q
        from django.db import transaction

        # Use a locking select to avoid races and enforce transactional semantics
        with transaction.atomic():
            locked_qs = Task.objects.select_for_update().filter(id__in=ids)

            # If ATL, check permissions per-task in Python to avoid DISTINCT+FOR UPDATE errors
            if user.role == 'atl':
                permitted_tasks = []
                for t in locked_qs:
                    if t.created_by_id == user.id or t.assigned_to.filter(role__in=['clerk', 'atm']).exists():
                        permitted_tasks.append(t)
                tasks_to_update = permitted_tasks
            else:
                tasks_to_update = list(locked_qs)

            # Ignore non-existent or non-permitted ids; operate on tasks_to_update

            # Validate change payload with TaskUpdateSerializer
            # allow partial updates for bulk operations
            serializer = TaskUpdateSerializer(data=data, partial=True)
            if not serializer.is_valid():
                # log and return the errors to make debugging tests easier
                logger.error(f"bulk_update validation errors: {serializer.errors}")
                return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            updated_ids = []
            for task in tasks_to_update:
                for field, value in serializer.validated_data.items():
                    setattr(task, field, value)
                task.save()
                updated_ids.append(task.id)
                self.create_activity_log(task, 'bulk_updated', {'fields': list(serializer.validated_data.keys())})

            return Response({'updated_ids': updated_ids})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def bulk_assign(self, request):
        """Bulk assign users to multiple tasks.

        Payload: { ids: [1,2], user_ids: [5,6], replace: false }
        - Supervisors may assign any tasks.
        - ATLs may assign tasks they created or assigned to clerks/atm.
        """
        ids = request.data.get('ids') or []
        user_ids = request.data.get('user_ids') or []
        replace = bool(request.data.get('replace'))

        if not isinstance(ids, list) or not ids or not isinstance(user_ids, list) or not user_ids:
            return Response({'error': 'ids and user_ids (non-empty lists) required'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if user.role not in ('supervisor', 'atl'):
            return Response({'error': 'permission denied'}, status=status.HTTP_403_FORBIDDEN)

        users = User.objects.filter(id__in=user_ids)
        if not users.exists():
            return Response({'error': 'no valid users found'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db.models import Q
        from django.db import transaction

        with transaction.atomic():
            qs = Task.objects.select_for_update().filter(id__in=ids)
            if user.role == 'atl':
                qs = qs.filter(Q(created_by=user) | Q(assigned_to__role__in=['clerk', 'atm'])).distinct()

            assigned_task_ids = []
            for task in qs:
                if replace:
                    task.assigned_to.set(users)
                else:
                    task.assigned_to.add(*users)
                assigned_task_ids.append(task.id)
                self.create_activity_log(task, 'bulk_assigned', {'user_ids': [u.id for u in users], 'replace': replace})
                for u in users:
                    send_notification_ws(u.id, {
                        'type': 'task_assigned',
                        'title': 'Task Assigned',
                        'message': f'You were assigned to task: {task.title}',
                        'task_id': task.id,
                    })

            # Add a system message per task indicating assignment change
            try:
                names = ', '.join([u.username for u in users])
                content = f"Assigned: {names}"
                for task in qs:
                    self.create_system_message(task, content)
            except Exception:
                logger.exception('Failed to create system messages for bulk_assign')

            return Response({'assigned_task_ids': assigned_task_ids})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def bulk_delete(self, request):
        """Bulk delete tasks. Only supervisors allowed."""
        ids = request.data.get('ids') or []
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'ids (non-empty list) required'}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        if user.role != 'supervisor':
            return Response({'error': 'permission denied'}, status=status.HTTP_403_FORBIDDEN)

        from django.db import transaction
        with transaction.atomic():
            qs = Task.objects.select_for_update().filter(id__in=ids)

            # Ignore non-existent ids; delete any found
            deleted_ids = [t.id for t in qs]
            # create logs before deletion
            for t in qs:
                self.create_activity_log(t, 'bulk_deleted', {})
            qs.delete()
            return Response({'deleted_ids': deleted_ids})


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


class TaskAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve task assignment proposals.

    - Normal users see only their own proposals.
    - Supervisors can list proposals for any user via `?user_id=` and filter by `?status=`.
    """
    queryset = TaskAssignment.objects.all()
    serializer_class = TaskAssignmentSerializer
    # Return full lists (no pagination) for assignment proposals to match test expectations
    pagination_class = None
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from .models import TaskAssignment
        user = self.request.user
        qs = TaskAssignment.objects.all()
        if user.role == 'supervisor':
            user_id = self.request.query_params.get('user_id')
            if user_id:
                qs = qs.filter(user_id=user_id)
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
            return qs.order_by('-created_at')

        # regular users only see their own assignment proposals
        return qs.filter(user=user).order_by('-created_at')