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
        """Get all messages for a chat room"""
        room = self.get_object()
        
        # Check if user is participant
        if not room.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this chat'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        messages = Message.objects.filter(room=room).select_related(
            'sender'
        ).prefetch_related('attachments').order_by('timestamp')
        
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)


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
    
    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        
        # Mark message as read for sender
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
        
        serializer = MessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)