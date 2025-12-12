from typing import Callable
import logging

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


class TokenAuthWebSocketMiddleware:
    """ASGI middleware that reads `scope['auth_token']` (populated by
    CookieWebSocketAuthMiddleware) or Authorization header and validates it
    using rest_framework_simplejwt's JWTAuthentication. On success it sets
    scope['user'] to the authenticated user; on failure it leaves an
    AnonymousUser in scope and sets `scope['auth_error']` for debugging.
    """

    def __init__(self, app):
        self.app = app
        self._jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        if scope.get('type') == 'websocket':
            token = scope.get('auth_token')
            if not token:
                # Try Authorization header
                headers = dict((k.decode().lower(), v.decode()) for k, v in scope.get('headers', []))
                auth = headers.get('authorization') or headers.get('http_authorization')
                if auth and isinstance(auth, str) and auth.lower().startswith('bearer '):
                    token = auth.split(' ', 1)[1]

            if token:
                try:
                    # Validate token via simple-jwt
                    validated = self._jwt_auth.get_validated_token(token)
                    # get_user is synchronous & uses the ORM; use database_sync_to_async
                    user = await database_sync_to_async(self._jwt_auth.get_user)(validated)
                    scope['user'] = user
                    scope['auth_valid'] = True
                    logger.debug('TokenAuthWebSocketMiddleware: authenticated user id=%s', getattr(user, 'id', None))
                except (InvalidToken, TokenError) as e:
                    scope['user'] = AnonymousUser()
                    scope['auth_error'] = str(e)
                    logger.warning('TokenAuthWebSocketMiddleware: token validation failed: %s', e)
                except Exception as e:
                    scope['user'] = AnonymousUser()
                    scope['auth_error'] = str(e)
                    logger.exception('TokenAuthWebSocketMiddleware: unexpected error during auth')
            else:
                scope['user'] = AnonymousUser()
        return await self.app(scope, receive, send)
