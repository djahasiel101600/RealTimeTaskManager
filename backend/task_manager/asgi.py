import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from apps.core.asgi_middleware import CookieWebSocketAuthMiddleware
from apps.core.token_auth_middleware import TokenAuthWebSocketMiddleware
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'task_manager.settings')

# Initialize Django ASGI application early to ensure AppRegistry is ready
django.setup()

# Now safe to import routing which imports consumers/models
import apps.chat.routing

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': CookieWebSocketAuthMiddleware(
        TokenAuthWebSocketMiddleware(
            AuthMiddlewareStack(
                URLRouter(apps.chat.routing.websocket_urlpatterns)
            )
        )
    ),
})