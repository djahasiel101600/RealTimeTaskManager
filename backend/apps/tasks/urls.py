from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, TaskAttachmentViewSet, TaskAssignmentViewSet

router = DefaultRouter()
# Register sub-resources first so they are not captured by the root TaskViewSet's detail route
router.register(r'attachments', TaskAttachmentViewSet, basename='task-attachments')
router.register(r'assignments', TaskAssignmentViewSet, basename='task-assignments')
# Register the root TaskViewSet last to avoid shadowing the above prefixes
router.register(r'', TaskViewSet, basename='tasks')

urlpatterns = [
    path('', include(router.urls)),
]