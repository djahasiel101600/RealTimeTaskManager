from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.utils import timezone
from .models import Notification
from .serializers import NotificationSerializer
import logging

logger = logging.getLogger(__name__)


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Mark notifications as read when they're fetched
        unread_notifications = Notification.objects.filter(
            user=user,
            is_read=False
        )
        unread_notifications.update(is_read=True)
        
        return Notification.objects.filter(user=user).order_by('-created_at')


class MarkNotificationAsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk=None):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        notification.is_read = True
        notification.save()
        
        return Response({'status': 'success'})


class MarkAllNotificationsAsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        updated = Notification.objects.filter(
            user=request.user,
            is_read=False
        ).update(is_read=True)
        
        logger.info(f"User {request.user.id} marked {updated} notifications as read")
        
        return Response({
            'status': 'success',
            'updated_count': updated
        })


class DeleteNotificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request, pk=None):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        notification.delete()
        
        return Response({'status': 'success'})


class ClearAllNotificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request):
        deleted_count, _ = Notification.objects.filter(user=request.user).delete()
        
        logger.info(f"User {request.user.id} deleted {deleted_count} notifications")
        
        return Response({
            'status': 'success',
            'deleted_count': deleted_count
        })