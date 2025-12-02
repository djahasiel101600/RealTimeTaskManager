from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from apps.users.serializers import UserRegistrationSerializer
from apps.users.models import User
import logging

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Get user data to include in response
            email = request.data.get('email')
            try:
                user = User.objects.get(email=email)
                user.is_online = True
                user.save()
                
                # Add user data to response
                from apps.users.serializers import UserSerializer
                user_data = UserSerializer(user).data
                response.data['user'] = user_data
                
                logger.info(f"User {user.id} logged in successfully")
            except User.DoesNotExist:
                pass
        
        return response


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            logger.info(f"New user registered: {user.id} - {user.email}")
            
            return Response({
                'user': UserRegistrationSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            # Mark user as offline
            request.user.is_online = False
            request.user.save()
            
            # Blacklist refresh token
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            logger.info(f"User {request.user.id} logged out")
            
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout error: {e}")
            return Response({"detail": "Error during logout."}, status=status.HTTP_400_BAD_REQUEST)


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        return Response({
            'status': 'healthy',
            'timestamp': timezone.now().isoformat(),
            'service': 'task-manager-backend',
        })