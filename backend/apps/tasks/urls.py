from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, TaskAttachmentViewSet

router = DefaultRouter()
router.register(r'', TaskViewSet, basename='tasks')
router.register(r'attachments', TaskAttachmentViewSet, basename='task-attachments')

urlpatterns = [
    path('', include(router.urls)),
]