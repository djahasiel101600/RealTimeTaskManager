from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count, Max
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, MessageAttachment
from .serializers import (
    ChatRoomSerializer, MessageSerializer, 
    MessageCreateSerializer, ChatRoomCreateSerializer
)
from apps.tasks.models import Task
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class ChatRoomViewSet(viewsets.ModelViewSet):
    queryset = ChatRoom.objects.all()
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-updated_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ChatRoomCreateSerializer
        return ChatRoomSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Get rooms where user is a participant
        rooms = ChatRoom.objects.filter(participants=user)
        
        # Annotate with last message time and unread count
        rooms = rooms.annotate(
            last_message_time=Max('messages__timestamp'),
            unread_count=Count(
                'messages',
                filter=Q(messages__is_read=False) & ~Q(messages__sender=user)
            )
        )
        
        return rooms.select_related('task').prefetch_related('participants')
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        room_type = serializer.validated_data.get('room_type')
        
        if room_type == 'direct':
            other_user_id = serializer.validated_data.get('other_user_id')
            
            try:
                other_user = User.objects.get(id=other_user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if direct room already exists
            existing_room = ChatRoom.objects.filter(
                room_type='direct',
                participants=request.user
            ).filter(participants=other_user).first()
            
            if existing_room:
                serializer = ChatRoomSerializer(existing_room)
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            room = ChatRoom.objects.create(room_type='direct')
            room.participants.add(request.user, other_user)
        
        elif room_type == 'task':
            task_id = serializer.validated_data.get('task_id')
            
            try:
                task = Task.objects.get(id=task_id)
            except Task.DoesNotExist:
                return Response(
                    {'error': 'Task not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if user has access to task
            if not request.user.can_view_task(task):
                return Response(
                    {'error': 'You do not have permission to chat about this task'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if task room already exists
            existing_room = ChatRoom.objects.filter(
                room_type='task',
                task=task
            ).first()
            
            if existing_room:
                # Add user to existing room if not already participant
                if not existing_room.participants.filter(id=request.user.id).exists():
                    existing_room.participants.add(request.user)
                serializer = ChatRoomSerializer(existing_room)
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            room = ChatRoom.objects.create(room_type='task', task=task)
            # Add all task participants to chat
            participants = [task.created_by] + list(task.assigned_to.all())
            room.participants.add(*participants)
        
        elif room_type == 'group':
            name = serializer.validated_data.get('name')
            participant_ids = serializer.validated_data.get('participant_ids', [])
            
            room = ChatRoom.objects.create(room_type='group', name=name)
            room.participants.add(request.user)
            
            if participant_ids:
                participants = User.objects.filter(id__in=participant_ids)
                room.participants.add(*participants)
        
        else:
            return Response(
                {'error': 'Invalid room type'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        room.save()
        serializer = ChatRoomSerializer(room)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def add_participant(self, request, pk=None):
        """Add participant to group chat"""
        room = self.get_object()
        
        if room.room_type != 'group':
            return Response(
                {'error': 'Only group chats can have participants added'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'User ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        room.participants.add(user)
        
        # Create system message about new participant
        Message.objects.create(
            room=room,
            sender=request.user,
            content=f"Added {user.username} to the chat",
            is_read=True
        )
        
        serializer = self.get_serializer(room)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark all messages in room as read"""
        room = self.get_object()
        
        # Mark all unread messages from other users as read
        Message.objects.filter(
            room=room,
            is_read=False
        ).exclude(sender=request.user).update(is_read=True)
        
        serializer = self.get_serializer(room)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get paginated messages for a chat room (newest first, reversed for display)"""
        room = self.get_object()
        
        # Check if user is participant
        if not room.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this chat'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get pagination parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 30))
        
        # Get total count for pagination info
        total_count = Message.objects.filter(room=room).count()
        
        # Order by newest first for pagination, then reverse for display
        messages = Message.objects.filter(room=room).select_related(
            'sender'
        ).prefetch_related('attachments').order_by('-timestamp')
        
        # Paginate
        start = (page - 1) * page_size
        end = start + page_size
        messages = messages[start:end]
        
        # Reverse to get chronological order for display
        messages = list(reversed(messages))
        
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        
        return Response({
            'results': serializer.data,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'has_more': end < total_count,
        })


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ['timestamp']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MessageCreateSerializer
        return MessageSerializer
    
    def get_queryset(self):
        user = self.request.user
        room_id = self.request.query_params.get('room_id')
        
        queryset = Message.objects.filter(room__participants=user)
        
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        
        return queryset.select_related('sender', 'room').prefetch_related('attachments')
    
    def create(self, request, *args, **kwargs):
        """Create a message with optional attachments"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save the message
        message = serializer.save(sender=request.user, is_read=True)
        
        # Handle file attachments - check multiple naming conventions
        # Frontend may send as attachments[0], attachments[1], etc. or just 'attachments'
        files = request.FILES.getlist('attachments')
        
        # Also check for indexed attachments (attachments[0], attachments[1], etc.)
        if not files:
            for key in request.FILES:
                if key.startswith('attachments['):
                    files.append(request.FILES[key])
        
        for file in files:
            MessageAttachment.objects.create(
                message=message,
                file=file,
                file_name=file.name,
                file_size=file.size,
                mime_type=file.content_type or 'application/octet-stream'
            )
        
        logger.info(f"User {request.user.id} sent message in room {message.room.id} with {len(files)} attachments")
        
        # Broadcast message via WebSocket to other participants
        self._broadcast_message_via_websocket(message, request)
        
        # Return full message with attachments - pass request context for absolute URLs
        output_serializer = MessageSerializer(message, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    def _broadcast_message_via_websocket(self, message, request):
        """Broadcast a message to the chat room via WebSocket"""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            logger.warning("Channel layer not available, skipping WebSocket broadcast")
            return
        
        room = message.room
        
        # Determine the group name based on room type
        if room.room_type == 'direct':
            group_name = f'direct_{room.id}'
        elif room.room_type == 'task':
            group_name = f'task_{room.id}'
        elif room.room_type == 'group':
            group_name = f'group_{room.id}'
        else:
            group_name = f'room_{room.id}'
        
        # Helper to build absolute URL using BACKEND_URL setting
        from django.conf import settings
        def build_absolute_url(file_url):
            backend_url = getattr(settings, 'BACKEND_URL', '')
            if backend_url:
                return f"{backend_url.rstrip('/')}{file_url}"
            return request.build_absolute_uri(file_url)
        
        # Serialize attachments
        attachments_data = []
        for att in message.attachments.all():
            att_data = {
                'id': att.id,
                'file': att.file.url if att.file else None,
                'file_url': build_absolute_url(att.file.url) if att.file else None,
                'file_name': att.file_name,
                'file_size': att.file_size,
                'mime_type': att.mime_type,
            }
            attachments_data.append(att_data)
        
        # Get sender avatar URL
        sender = message.sender
        avatar_url = None
        if sender.avatar and hasattr(sender.avatar, 'url'):
            avatar_url = build_absolute_url(sender.avatar.url)
        
        # Broadcast to room group
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': message.id,
                        'content': message.content,
                        'sender': {
                            'id': sender.id,
                            'username': sender.username,
                            'avatar': avatar_url,
                        },
                        'timestamp': message.timestamp.isoformat(),
                        'room_type': room.room_type,
                        'room_id': room.id,
                        'attachments': attachments_data,
                    }
                }
            )
            logger.info(f"Broadcast message {message.id} to group {group_name}")
        except Exception as e:
            logger.error(f"Failed to broadcast message via WebSocket: {e}")
    
    def perform_create(self, serializer):
        # This is kept for backward compatibility but create() is used instead
        message = serializer.save(sender=self.request.user)
        message.is_read = True
        message.save()
        logger.info(f"User {self.request.user.id} sent message in room {message.room.id}")
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a specific message as read"""
        message = self.get_object()
        
        # Only mark as read if user is not the sender
        if message.sender != request.user:
            message.is_read = True
            message.save()
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def upload_attachment(self, request):
        """Upload attachment for a message"""
        room_id = request.data.get('room_id')
        content = request.data.get('content', '')
        
        if not room_id:
            return Response(
                {'error': 'Room ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            room = ChatRoom.objects.get(id=room_id)
        except ChatRoom.DoesNotExist:
            return Response(
                {'error': 'Chat room not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is participant
        if not room.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this chat'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create message
        message = Message.objects.create(
            room=room,
            sender=request.user,
            content=content,
            is_read=True  # Read by sender
        )
        
        # Handle file attachments
        files = request.FILES.getlist('attachments')
        for file in files:
            MessageAttachment.objects.create(
                message=message,
                file=file,
                file_name=file.name,
                file_size=file.size,
                mime_type=file.content_type
            )
        
        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)