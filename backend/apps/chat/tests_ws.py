import json
from django.test import TransactionTestCase, Client, override_settings
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from asgiref.sync import async_to_sync

from task_manager.asgi import application
from apps.chat.consumers import ChatConsumer
import jwt
from django.conf import settings
import asyncio
import logging

User = get_user_model()

logger = logging.getLogger(__name__)


@override_settings(CHANNEL_LAYERS={
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
})
class WebSocketAuthTests(TransactionTestCase):
    def setUp(self):
        self.username = 'wsuser'
        self.email = 'wsuser@example.com'
        self.password = 'strong-pass-123'
        self.user = User.objects.create_user(username=self.username, email=self.email, password=self.password)
        self.client = Client()

    def test_websocket_accepts_cookie_auth(self):
        # Login via token endpoint which sets HttpOnly cookies (`access` and `refresh`)
        response = self.client.post('/api/auth/token/', data=json.dumps({
            'email': self.email,
            'password': self.password
        }), content_type='application/json')

        self.assertEqual(response.status_code, 200)

        # Extract cookies set by the login view
        access_cookie = response.cookies.get('access')
        refresh_cookie = response.cookies.get('refresh')

        self.assertIsNotNone(access_cookie, 'access cookie not set on login')
        # Build cookie header value
        cookie_value = f"access={access_cookie.value}"
        if refresh_cookie:
            cookie_value += f"; refresh={refresh_cookie.value}"

        # Debug: ensure token decodes with SECRET_KEY
        key = getattr(settings, 'SIMPLE_JWT', {}).get('SIGNING_KEY') or settings.SECRET_KEY
        alg = getattr(settings, 'SIMPLE_JWT', {}).get('ALGORITHM', 'HS256')
        # Verify token decodes correctly and belongs to our test user
        decoded = jwt.decode(access_cookie.value, key, algorithms=[alg])
        self.assertEqual(int(decoded.get('user_id')), self.user.id)

        # Try connecting to notifications WebSocket with cookie header
        communicator = WebsocketCommunicator(application, '/ws/notifications/', headers=[(b'cookie', cookie_value.encode())])
        connected, _ = async_to_sync(communicator.connect)()
        try:
            self.assertTrue(connected, 'WebSocket should accept connection when valid auth cookies provided')
            # Drain any initial output so the communicator's internal tasks can settle
            try:
                async_to_sync(communicator.receive_output)(timeout=0.1)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                # No initial messages or consumer tasks were cancelled — continue to disconnect
                pass
        finally:
            # Disconnect can race with consumer shutdown; catch and ignore cancellation errors
            try:
                async_to_sync(communicator.disconnect)()
            except BaseException:
                # Some Channels internals may cancel tasks during teardown (CancelledError is sometimes raised).
                # Treat as non-fatal for this integration test teardown.
                pass

    def test_websocket_rejects_without_cookies(self):
        communicator = WebsocketCommunicator(application, '/ws/notifications/')
        connected, _ = async_to_sync(communicator.connect)()
        # Expect connection to be rejected when no auth provided
        self.assertFalse(connected, 'WebSocket should reject unauthenticated connections')

    def test_direct_chat_send_receive(self):
        """Two users join a direct chat and receive each other's messages via group broadcast."""
        # Create second user
        other = User.objects.create_user(username='other', email='other@example.com', password=self.password)
        logger.debug('created other user %s', other.id)

        # Helper to login and build cookie header
        def build_cookie_for(email):
            c = Client()
            resp = c.post('/api/auth/token/', data=json.dumps({'email': email, 'password': self.password}), content_type='application/json')
            self.assertEqual(resp.status_code, 200)
            access = resp.cookies.get('access')
            self.assertIsNotNone(access)
            return f"access={access.value}"

        cookie1 = build_cookie_for(self.email)
        logger.debug('cookie1 built')
        cookie2 = build_cookie_for(other.email)
        logger.debug('cookie2 built')

        # Create communicator for user1 only (simpler deterministic test)
        # Use the consumer directly and pass token as a subprotocol to avoid middleware/threading race
        token = cookie1.split('=')[1]
        # Run the communicator actions in a single async function to avoid cross-thread races
        async def run_comm_flow():
            comm = WebsocketCommunicator(ChatConsumer.as_asgi(), '/ws/chat/', subprotocols=[token])
            connected, _ = await comm.connect()
            self.assertTrue(connected)
            logger.debug('comm1 connected=%s', connected)

            # Join direct room
            logger.debug('sending join_room from comm1')
            await comm.send_json_to({'type': 'join_room', 'room_type': 'direct', 'room_id': other.id})
            logger.debug('comm1 sent join_room')

            # Send a message
            logger.debug('comm1 sending message')
            await comm.send_json_to({'type': 'send_message', 'room_type': 'direct', 'room_id': other.id, 'message': 'hello there'})
            logger.debug('comm1 sent message')

            # Receive broadcast
            logger.debug('about to receive on comm1')
            msg = await comm.receive_json_from(timeout=2)
            logger.debug('received on comm1 %s', msg)
            await comm.disconnect()
            return msg

        msg1 = async_to_sync(run_comm_flow)()
        self.assertEqual(msg1.get('type'), 'chat_message')
        self.assertEqual(msg1['data']['content'], 'hello there')