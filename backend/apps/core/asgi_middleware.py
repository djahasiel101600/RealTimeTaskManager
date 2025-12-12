from typing import Callable
from urllib.parse import parse_qs
from http.cookies import SimpleCookie
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _is_valid_token(token: str) -> bool:
    if not token or not isinstance(token, str):
        return False
    token = token.strip()
    if token.lower() in ('none', 'null', ''):
        return False
    # Basic JWT check - header.payload.signature
    return token.count('.') == 2


class CookieWebSocketAuthMiddleware:
    """ASGI middleware that extracts an `access` token from the Spring
    handshake and adds it to `scope['auth_token']` for subsequent middleware
    to verify and convert into a `scope['user']`.

    We support subprotocol token, HttpOnly cookie, and query token fallback.
    We intentionally do not attach an Authorization header here; instead we
    populate `scope['auth_token']` to keep ASGI scope headers stable.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get('type') != 'websocket':
            return await self.app(scope, receive, send)

        # normalize headers into a dict
        headers = dict((k.decode().lower(), v.decode()) for k, v in scope.get('headers', []))
        token = None

        # Subprotocol (preferred if present) -- ws client's first subprotocol entry
        subprotocols = scope.get('subprotocols') or []
        if subprotocols and isinstance(subprotocols, list):
            possible = subprotocols[0]
            if _is_valid_token(possible):
                token = possible
                logger.debug('CookieWebSocketAuthMiddleware: using subprotocol token (len=%d)', len(token))

        # Cookies
        if not token:
            cookie_header = headers.get('cookie')
            if cookie_header:
                try:
                    simple = SimpleCookie()
                    simple.load(cookie_header)
                    if 'access' in simple:
                        candidate = simple['access'].value
                        if _is_valid_token(candidate):
                            token = candidate
                            logger.debug('CookieWebSocketAuthMiddleware: extracted access token from cookie (len=%d)', len(token))
                except Exception:
                    logger.exception('CookieWebSocketAuthMiddleware: failed to parse cookie header')

        # Query string fallback
        if not token:
            query_string = scope.get('query_string', b'').decode()
            qs = parse_qs(query_string)
            token_list = qs.get('token') or []
            if token_list and _is_valid_token(token_list[0]):
                token = token_list[0]
                logger.debug('CookieWebSocketAuthMiddleware: extracted access token from query string (len=%d)', len(token))

        if token:
            scope['auth_token'] = token

        return await self.app(scope, receive, send)
