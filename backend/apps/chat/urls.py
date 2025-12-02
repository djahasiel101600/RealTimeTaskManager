from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet, MessageViewSet

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='chat-rooms')
router.register(r'messages', MessageViewSet, basename='chat-messages')

urlpatterns = [
    path('', include(router.urls)),
]