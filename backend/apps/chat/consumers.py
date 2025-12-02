import json
import jwt
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatRoom, Message, MessageAttachment


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()  # safe inside method
        self.user = None
        token = self.scope['query_string'].decode().split('token=')[-1]

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            self.user = await database_sync_to_async(User.objects.get)(id=payload['user_id'])
            self.user.is_online = True
            await database_sync_to_async(self.user.save)()
        except:
            await self.close()
            return

        self.room_group_name = None
        await self.accept()

    async def disconnect(self, close_code):
        if self.user:
            self.user.is_online = False
            await database_sync_to_async(self.user.save)()

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'join_room':
            await self.join_room(data)
        elif message_type == 'leave_room':
            await self.leave_room(data)
        elif message_type == 'send_message':
            await self.send_message(data)
        elif message_type == 'typing':
            await self.typing_indicator(data)

    async def join_room(self, data):
        room_type = data.get('room_type')
        room_id = data.get('room_id')

        if room_type == 'direct':
            self.room_group_name = f'direct_{room_id}'
        elif room_type == 'task':
            self.room_group_name = f'task_{room_id}'
        elif room_type == 'group':
            self.room_group_name = f'group_{room_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

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

        # Save message to database
        chat_message = await self.save_message(
            message=message,
            room_type=room_type,
            room_id=room_id
        )

        # Broadcast to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': chat_message.id,
                    'content': chat_message.content,
                    'sender': {
                        'id': self.user.id,
                        'username': self.user.username,
                        'avatar': getattr(self.user, 'avatar', None) and self.user.avatar.url
                    },
                    'timestamp': chat_message.timestamp.isoformat(),
                    'room_type': room_type,
                    'room_id': room_id
                }
            }
        )

    @database_sync_to_async
    def save_message(self, message, room_type, room_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()  # safe inside method

        if room_type == 'task':
            from apps.tasks.models import Task
            task = Task.objects.get(id=room_id)
            room, _ = ChatRoom.objects.get_or_create(
                task=task,
                room_type='task'
            )
        elif room_type == 'direct':
            other_user = User.objects.get(id=room_id)
            room, _ = ChatRoom.objects.get_or_create_direct(
                user1=self.user,
                user2=other_user
            )
        elif room_type == 'group':
            room, _ = ChatRoom.objects.get_or_create(
                role_group=room_id,
                room_type='group'
            )

        return Message.objects.create(
            room=room,
            sender=self.user,
            content=message
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'data': event['message']
        }))

    async def typing_indicator(self, data):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing',
                'user': {
                    'id': self.user.id,
                    'username': self.user.username
                },
                'is_typing': data.get('is_typing', False)
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
        token = self.scope['query_string'].decode().split('token=')[-1]

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            self.user = await database_sync_to_async(User.objects.get)(id=payload['user_id'])
            self.user_group_name = f'notifications_{self.user.id}'
        except:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )

    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))
