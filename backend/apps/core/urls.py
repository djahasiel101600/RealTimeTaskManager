from django.urls import path
from .views import (
    RegisterView, 
    LogoutView, 
    HealthCheckView, 
    CustomTokenObtainPairView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    ChangePasswordView,
    ActivityLogListView,
    SendEmailVerificationView,
    VerifyEmailView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('activity-logs/', ActivityLogListView.as_view(), name='activity-logs'),
    path('send-verification-email/', SendEmailVerificationView.as_view(), name='send-verification-email'),
    path('verify-email/<uuid:token>/', VerifyEmailView.as_view(), name='verify-email'),
]
