import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'task_manager.settings')

# Initialize Django ASGI application early to ensure AppRegistry is ready
django.setup()

# Now safe to import routing which imports consumers/models
import apps.chat.routing

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter(apps.chat.routing.websocket_urlpatterns)
    ),
})