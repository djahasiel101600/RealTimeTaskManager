from django.urls import path, re_path
from .consumers import ChatConsumer, NotificationConsumer

websocket_urlpatterns = [
    # General chat connection (join rooms dynamically via messages)
    path("ws/chat/", ChatConsumer.as_asgi()),
    # Legacy: room-specific connection
    re_path(r"ws/chat/(?P<room_id>\w+)/$", ChatConsumer.as_asgi()),
    # Notifications
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
