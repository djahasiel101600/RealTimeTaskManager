import json
import jwt
import logging
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatRoom, Message, MessageAttachment

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()  # safe inside method
        self.user = None
        query_string = self.scope['query_string'].decode()
        token = query_string.split('token=')[-1] if 'token=' in query_string else ''
        
        logger.info(f"Chat WebSocket connect attempt from {self.scope.get('client', 'unknown')}")

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = int(payload['user_id'])  # Convert to int since JWT may have it as string
            self.user = await database_sync_to_async(User.objects.get)(id=user_id)
            self.user.is_online = True
            await database_sync_to_async(self.user.save)()
            logger.info(f"Chat WebSocket authenticated for user {self.user.username} (id={user_id})")
        except jwt.ExpiredSignatureError:
            logger.warning("Chat WebSocket: Token expired")
            await self.close()
            return
        except jwt.InvalidTokenError as e:
            logger.warning(f"Chat WebSocket: Invalid token - {e}")
            await self.close()
            return
        except Exception as e:
            logger.error(f"Chat WebSocket: Authentication error - {e}")
            await self.close()
            return

        self.room_group_name = None
        await self.accept()
        logger.info(f"Chat WebSocket accepted for user {self.user.username}")

    async def disconnect(self, close_code):
        if self.user:
            self.user.is_online = False
            await database_sync_to_async(self.user.save)()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received from user {self.user.id if self.user else 'unknown'}")
            return
            
        message_type = data.get('type')

        if message_type == 'join_room':
            await self.join_room(data)
        elif message_type == 'leave_room':
            await self.leave_room(data)
        elif message_type == 'send_message':
            await self.handle_send_message(data)
        elif message_type == 'typing':
            await self.typing_indicator(data)
        else:
            logger.warning(f"Unknown message type: {message_type}")

    async def handle_send_message(self, data):
        """Wrapper to handle send_message with error handling"""
        try:
            logger.info(f"User {self.user.id} sending message: room_type={data.get('room_type')}, room_id={data.get('room_id')}")
            await self.send_message(data)
            logger.info(f"Message sent successfully by user {self.user.id}")
        except Exception as e:
            logger.error(f"Error sending message: {e}", exc_info=True)
            # Send error back to client
            await self.send(text_data=json.dumps({
                'type': 'error',
                'data': {
                    'message': 'Failed to send message',
                    'original_message': data.get('message', '')[:100]  # Truncate for safety
                }
            }))

    async def join_room(self, data):
        room_type = data.get('room_type')
        room_id = data.get('room_id')

        # For direct chats, we need to use a consistent group name
        # The client sends other_user_id, but we need to create a consistent group
        # that both users will join (sorted user IDs)
        if room_type == 'direct':
            # Get or create the actual room to get the consistent room ID
            actual_room_id = await self.get_or_create_direct_room_id(room_id)
            self.room_group_name = f'direct_{actual_room_id}'
        elif room_type == 'task':
            self.room_group_name = f'task_{room_id}'
        elif room_type == 'group':
            self.room_group_name = f'group_{room_id}'
        else:
            self.room_group_name = f'room_{room_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
    @database_sync_to_async
    def get_or_create_direct_room_id(self, other_user_id):
        """Get or create a direct chat room and return its ID"""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            other_user = User.objects.get(id=other_user_id)
            room, _ = ChatRoom.objects.get_or_create_direct(
                user1=self.user,
                user2=other_user
            )
            return room.id
        except User.DoesNotExist:
            # Fallback to using the provided ID if user not found
            return other_user_id

    async def leave_room(self, data):
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def send_message(self, data):
        message = data.get('message')
        room_type = data.get('room_type')
        room_id = data.get('room_id')

        # Save message to database and get the actual chat room
        chat_message, actual_room_id = await self.save_message(
            message=message,
            room_type=room_type,
            room_id=room_id
        )

        # Determine the correct group name for broadcasting
        # This handles the case where the user sends a message before explicitly joining
        if room_type == 'direct':
            broadcast_group = f'direct_{actual_room_id}'
        elif room_type == 'task':
            broadcast_group = f'task_{actual_room_id}'
        elif room_type == 'group':
            broadcast_group = f'group_{actual_room_id}'
        else:
            broadcast_group = f'room_{actual_room_id}'
        
        # Also ensure we're in the group (auto-join on send)
        if self.room_group_name != broadcast_group:
            if self.room_group_name:
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
            self.room_group_name = broadcast_group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

        # Broadcast to room
        await self.channel_layer.group_send(
            broadcast_group,
            {
                'type': 'chat_message',
                'message': {
                    'id': chat_message.id,
                    'content': chat_message.content,
                    'sender': {
                        'id': self.user.id,
                        'username': self.user.username,
                        'avatar': self.user.avatar.url if self.user.avatar and hasattr(self.user.avatar, 'url') else None
                    },
                    'timestamp': chat_message.timestamp.isoformat(),
                    'room_type': room_type,
                    'room_id': actual_room_id,
                    'attachments': []  # WebSocket messages don't have attachments (sent via HTTP)
                }
            }
        )

    @database_sync_to_async
    def save_message(self, message, room_type, room_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()  # safe inside method

        logger.info(f"save_message called: room_type={room_type}, room_id={room_id}, user={self.user.id}")

        if room_type == 'task':
            # room_id is the ChatRoom ID, not the Task ID
            # First try to find existing task chat room by ID
            try:
                room = ChatRoom.objects.get(id=room_id, room_type='task')
                logger.info(f"Found existing task chat room: {room.id}")
            except ChatRoom.DoesNotExist:
                # If not found, room_id might be the task ID (legacy behavior)
                logger.info(f"Task chat room {room_id} not found, trying as task ID")
                from apps.tasks.models import Task
                task = Task.objects.get(id=room_id)
                room, created = ChatRoom.objects.get_or_create(
                    task=task,
                    room_type='task'
                )
                logger.info(f"{'Created' if created else 'Found'} task chat room: {room.id} for task {task.id}")
                # Add task participants to the chat room if newly created
                if created:
                    participants = [task.created_by] + list(task.assigned_to.all())
                    room.participants.add(*participants)
            
            # Ensure current user is a participant
            if not room.participants.filter(id=self.user.id).exists():
                room.participants.add(self.user)
                logger.info(f"Added user {self.user.id} as participant to room {room.id}")
        elif room_type == 'direct':
            # room_id could be either the actual room ID or the other user's ID
            # Try to get the room first by ID
            try:
                room = ChatRoom.objects.get(id=room_id, room_type='direct')
            except ChatRoom.DoesNotExist:
                # If not found, assume it's the other user's ID and create/get the room
                other_user = User.objects.get(id=room_id)
                room, _ = ChatRoom.objects.get_or_create_direct(
                    user1=self.user,
                    user2=other_user
                )
        elif room_type == 'group':
            # For group chats, room_id is the actual room ID
            try:
                room = ChatRoom.objects.get(id=room_id, room_type='group')
            except ChatRoom.DoesNotExist:
                raise ValueError(f"Group chat room {room_id} does not exist")
        else:
            # Fallback - try to get room by ID
            room = ChatRoom.objects.get(id=room_id)

        msg = Message.objects.create(
            room=room,
            sender=self.user,
            content=message
        )
        
        logger.info(f"Message saved: id={msg.id}, room={room.id}, sender={self.user.id}, content_length={len(message)}")
        
        # Return both the message and the actual room ID
        return msg, room.id

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'data': event['message']
        }))

    async def typing_indicator(self, data):
        if not self.room_group_name:
            return  # Can't send typing if not in a room
            
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing',
                'user': {
                    'id': self.user.id,
                    'username': self.user.username
                },
                'is_typing': data.get('is_typing', False),
                'room_id': data.get('room_id')  # Include room_id for frontend filtering
            }
        )

    async def typing(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'data': event
        }))


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()  # safe inside method
        self.user = None
        self.user_group_name = None
        query_string = self.scope['query_string'].decode()
        token = query_string.split('token=')[-1] if 'token=' in query_string else ''
        
        logger.info(f"Notification WebSocket connect attempt from {self.scope.get('client', 'unknown')}")

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = int(payload['user_id'])  # Convert to int since JWT may have it as string
            self.user = await database_sync_to_async(User.objects.get)(id=user_id)
            self.user_group_name = f'notifications_{self.user.id}'
            logger.info(f"Notification WebSocket authenticated for user {self.user.username} (id={user_id})")
        except jwt.ExpiredSignatureError:
            logger.warning("Notification WebSocket: Token expired")
            await self.close()
            return
        except jwt.InvalidTokenError as e:
            logger.warning(f"Notification WebSocket: Invalid token - {e}")
            await self.close()
            return
        except Exception as e:
            logger.error(f"Notification WebSocket: Authentication error - {e}")
            await self.close()
            return

        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()
        logger.info(f"Notification WebSocket accepted for user {self.user.username}")

    async def disconnect(self, close_code):
        if self.user_group_name:
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))
