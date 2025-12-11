from django.utils import timezone
from django.utils.crypto import get_random_string
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status, permissions, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from apps.users.serializers import UserRegistrationSerializer
from apps.tasks.models import ActivityLog
from rest_framework import serializers
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


# Custom Throttle Classes
class LoginRateThrottle(AnonRateThrottle):
    """Strict rate limiting for login attempts"""
    scope = 'login'


class PasswordResetRateThrottle(AnonRateThrottle):
    """Strict rate limiting for password reset requests"""
    scope = 'password_reset'


# Password Reset Serializers
class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            # Don't reveal whether email exists for security
            pass
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
    
    def validate_new_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)
    
    def validate_new_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value


# Activity Log Serializer
class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    task_title = serializers.SerializerMethodField()
    task_id = serializers.SerializerMethodField()
    
    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'details', 'timestamp', 'ip_address', 'task_title', 'task_id']
    
    def get_user(self, obj):
        if obj.user:
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'first_name': obj.user.first_name,
                'last_name': obj.user.last_name,
                'avatar': obj.user.avatar.url if obj.user.avatar else None,
            }
        return None
    
    def get_task_title(self, obj):
        return obj.task.title if obj.task else None
    
    def get_task_id(self, obj):
        return obj.task.id if obj.task else None


class CustomTokenObtainPairView(TokenObtainPairView):
    """Login view with rate limiting"""
    throttle_classes = [LoginRateThrottle]
    
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
        # If tokens present in response, also set them as HttpOnly cookies
        try:
            access = response.data.get('access')
            refresh = response.data.get('refresh')
            if access:
                response.set_cookie(
                    'access', access,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax',
                    path='/',
                    max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
                )
            if refresh:
                response.set_cookie(
                    'refresh', refresh,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax',
                    path='/',
                    max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
                )
        except Exception:
            # Don't fail login if cookie-setting fails
            logger.exception('Failed to set auth cookies on login')

        return response


class CustomTokenRefreshView(TokenRefreshView):
    """Refresh JWT and set access cookie."""
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        try:
            access = response.data.get('access')
            if access:
                response.set_cookie(
                    'access', access,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax',
                    path='/',
                    max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
                )
        except Exception:
            logger.exception('Failed to set access cookie on refresh')
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


class PasswordResetRequestView(APIView):
    """Request a password reset email"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetRateThrottle]
    
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                # Generate reset token
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                
                # Build reset URL (frontend should handle this route)
                reset_url = f"{request.scheme}://{request.get_host()}/reset-password/{uid}/{token}/"
                
                # Send email
                try:
                    send_mail(
                        subject='Password Reset Request - Task Manager',
                        message=f'''Hello {user.username},

You requested a password reset for your Task Manager account.

Click the link below to reset your password:
{reset_url}

If you didn't request this, please ignore this email.

This link will expire in 24 hours.

Best regards,
Task Manager Team''',
                        from_email=settings.DEFAULT_FROM_EMAIL or 'noreply@taskmanager.com',
                        recipient_list=[email],
                        fail_silently=False,
                    )
                    logger.info(f"Password reset email sent to {email}")
                except Exception as e:
                    logger.error(f"Failed to send password reset email: {e}")
                    # Still return success to not reveal if email exists
                    
            except User.DoesNotExist:
                # Don't reveal that email doesn't exist
                pass
            
            # Always return success to prevent email enumeration
            return Response({
                'detail': 'If an account with this email exists, you will receive a password reset link.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            try:
                uid = force_str(urlsafe_base64_decode(serializer.validated_data['uid']))
                user = User.objects.get(pk=uid)
                
                if default_token_generator.check_token(user, serializer.validated_data['token']):
                    user.set_password(serializer.validated_data['new_password'])
                    user.save()
                    logger.info(f"Password reset successful for user {user.id}")
                    return Response({
                        'detail': 'Password has been reset successfully.'
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'error': 'Invalid or expired reset token.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except (TypeError, ValueError, User.DoesNotExist):
                return Response({
                    'error': 'Invalid reset link.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """Change password for authenticated user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({
                    'error': 'Current password is incorrect.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            logger.info(f"Password changed for user {user.id}")
            
            return Response({
                'detail': 'Password changed successfully.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SendEmailVerificationView(APIView):
    """Send email verification link to user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        user = request.user
        
        if user.email_verified:
            return Response({
                'detail': 'Email is already verified.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate new verification token
        token = user.generate_verification_token()
        user.email_verification_sent_at = timezone.now()
        user.save()
        
        # Build verification URL
        verification_url = f"{request.scheme}://{request.get_host()}/verify-email/{token}/"
        
        # Send email
        try:
            send_mail(
                subject='Verify Your Email - Task Manager',
                message=f'''Hello {user.username},

Please verify your email address by clicking the link below:

{verification_url}

If you didn't create an account with Task Manager, please ignore this email.

This link will expire in 24 hours.

Best regards,
Task Manager Team''',
                from_email=settings.DEFAULT_FROM_EMAIL or 'noreply@taskmanager.com',
                recipient_list=[user.email],
                fail_silently=False,
            )
            logger.info(f"Verification email sent to {user.email}")
            
            return Response({
                'detail': 'Verification email sent successfully.'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")
            return Response({
                'error': 'Failed to send verification email. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyEmailView(APIView):
    """Verify email with token"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, token):
        try:
            user = User.objects.get(email_verification_token=token)
            
            # Check if token is expired (24 hours)
            if user.email_verification_sent_at:
                token_age = timezone.now() - user.email_verification_sent_at
                if token_age.total_seconds() > 86400:  # 24 hours
                    return Response({
                        'error': 'Verification link has expired. Please request a new one.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Mark email as verified
            user.email_verified = True
            user.email_verification_token = None
            user.save()
            
            logger.info(f"Email verified for user {user.id}")
            
            return Response({
                'detail': 'Email verified successfully.'
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({
                'error': 'Invalid verification link.'
            }, status=status.HTTP_400_BAD_REQUEST)


class ActivityLogListView(generics.ListAPIView):
    """List activity logs with filtering"""
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = ActivityLog.objects.select_related('user', 'task').order_by('-timestamp')
        
        # Role-based filtering
        if user.role == 'supervisor':
            pass  # Supervisors see all logs
        elif user.role == 'atl':
            # ATLs see logs for tasks assigned to clerks/ATMs
            from apps.tasks.models import Task
            task_ids = Task.objects.filter(
                assigned_to__role__in=['clerk', 'atm']
            ).values_list('id', flat=True).distinct()
            queryset = queryset.filter(task_id__in=task_ids)
        else:
            # Regular users see only their own activity
            from apps.tasks.models import Task
            task_ids = Task.objects.filter(
                assigned_to=user
            ).values_list('id', flat=True)
            queryset = queryset.filter(task_id__in=task_ids)
        
        # Apply filters from query params
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        task_id = self.request.query_params.get('task_id')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        
        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(timestamp__gte=from_date)
        
        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(timestamp__lte=to_date)
        
        return queryset