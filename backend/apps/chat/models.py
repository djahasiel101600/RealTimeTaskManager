from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json


class ChatRoomManager(models.Manager):
    def get_or_create_direct(self, user1, user2):
        """Find or create a direct chat between two users."""
        # Find existing direct chat between two users
        rooms = self.filter(
            room_type='direct',
            participants=user1
        ).filter(participants=user2)
        
        if rooms.exists():
            return rooms.first(), False
        
        # Create new direct chat
        room = self.create(room_type='direct')
        room.participants.add(user1, user2)
        return room, True


class ChatRoom(models.Model):
    ROOM_TYPES = (
        ('direct', 'Direct Message'),
        ('task', 'Task Discussion'),
        ('group', 'Group Chat'),
    )
    
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES)
    name = models.CharField(max_length=255, blank=True, null=True)
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chat_rooms'
    )
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='chat_rooms'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = ChatRoomManager()
    
    class Meta:
        ordering = ['-updated_at']
        unique_together = ['room_type', 'task']
    
    def __str__(self):
        if self.room_type == 'direct':
            participants = list(self.participants.all())
            if len(participants) == 2:
                return f"Direct: {participants[0].username} & {participants[1].username}"
        elif self.room_type == 'task' and self.task:
            return f"Task: {self.task.title}"
        elif self.name:
            return self.name
        return f"Chat Room {self.id}"


class Message(models.Model):
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['room', 'timestamp']),
            models.Index(fields=['sender', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}"


class MessageAttachment(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='message_attachments/')
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField()
    mime_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.file_name