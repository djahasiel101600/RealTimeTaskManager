from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from django.utils import timezone
from .serializers import UserSerializer, UserProfileSerializer
from apps.core.permissions import IsSupervisorOrATL
from apps.notifications.models import send_notification_ws
import logging
from rest_framework import serializers

logger = logging.getLogger(__name__)
User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined', 'last_login']
    ordering = ['username']
    
    def get_permissions(self):
        if self.action in ['create', 'destroy', 'update', 'partial_update', 'change_role']:
            return [permissions.IsAuthenticated(), IsSupervisorOrATL()]
        elif self.action in ['profile', 'update_profile', 'upload_avatar']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'supervisor':
            return User.objects.all()
        elif user.role == 'atl':
            # ATLs can see clerks and ATMs
            return User.objects.filter(role__in=['clerk', 'atm'])
        else:
            # Regular users can only see themselves
            return User.objects.filter(id=user.id)
    
    def perform_destroy(self, instance):
        # Prevent users from deleting themselves
        if instance == self.request.user:
            raise serializers.ValidationError("You cannot delete your own account")
        
        # Prevent deleting last supervisor
        if instance.role == 'supervisor' and User.objects.filter(role='supervisor').count() <= 1:
            raise serializers.ValidationError("Cannot delete the last supervisor")
        
        # Log the deletion
        logger.warning(f"User {self.request.user.id} deleted user {instance.id}")
        instance.delete()
    
    @action(detail=False, methods=['get', 'patch'])
    def profile(self, request):
        """Get or update the current user's profile"""
        user = request.user
        
        if request.method == 'GET':
            serializer = UserProfileSerializer(user)
            return Response(serializer.data)
        
        elif request.method == 'PATCH':
            serializer = UserProfileSerializer(
                user, 
                data=request.data, 
                partial=True
            )
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='profile/avatar')
    def upload_avatar(self, request):
        """Upload avatar for current user"""
        user = request.user
        
        if 'avatar' not in request.FILES:
            return Response(
                {'error': 'No avatar file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (max 5MB)
        if request.FILES['avatar'].size > 5 * 1024 * 1024:
            return Response(
                {'error': 'Avatar size exceeds 5MB limit'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif']
        if request.FILES['avatar'].content_type not in allowed_types:
            return Response(
                {'error': 'Invalid image format. Use JPEG, PNG, or GIF'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.avatar = request.FILES['avatar']
        user.save()
        
        serializer = UserProfileSerializer(user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        """Change user role (supervisor/ATL only)"""
        user = self.get_object()
        new_role = request.data.get('role')
        
        if new_role not in dict(User.Role.choices):
            return Response(
                {'error': 'Invalid role'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions
        if new_role == 'supervisor' and request.user.role != 'supervisor':
            return Response(
                {'error': 'Only supervisors can assign supervisor role'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Prevent demoting last supervisor
        if user.role == 'supervisor' and new_role != 'supervisor':
            supervisor_count = User.objects.filter(role='supervisor').count()
            if supervisor_count <= 1:
                return Response(
                    {'error': 'Cannot demote the last supervisor'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        old_role = user.role
        user.role = new_role
        user.save()
        
        # Send notification to user about role change
        send_notification_ws(user.id, {
            'type': 'role_changed',
            'title': 'Role Updated',
            'message': f'Your role has been changed from {old_role} to {new_role}',
            'old_role': old_role,
            'new_role': new_role,
        })
        
        logger.info(f"User {request.user.id} changed role of user {user.id} from {old_role} to {new_role}")
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get user statistics"""
        if request.user.role not in ['supervisor', 'atl']:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        stats = {
            'total_users': User.objects.count(),
            'online_users': User.objects.filter(is_online=True).count(),
            'users_by_role': User.objects.values('role').annotate(count=Count('id')),
            'recent_users': User.objects.filter(
                date_joined__gte=timezone.now() - timezone.timedelta(days=30)
            ).count(),
        }
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search users with various filters"""
        query = request.query_params.get('q', '')
        role = request.query_params.get('role')
        is_online = request.query_params.get('is_online')
        
        queryset = self.get_queryset()
        
        if query:
            queryset = queryset.filter(
                Q(username__icontains=query) |
                Q(email__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query)
            )
        
        if role:
            queryset = queryset.filter(role=role)
        
        if is_online is not None:
            is_online_bool = is_online.lower() == 'true'
            queryset = queryset.filter(is_online=is_online_bool)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)