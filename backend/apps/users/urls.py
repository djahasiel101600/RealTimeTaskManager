from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet
from ..core.views import (
    CustomTokenObtainPairView,
    RegisterView,
    LogoutView,
    HealthCheckView
)

router = DefaultRouter()
router.register(r'', UserViewSet, basename='users')

urlpatterns = [
    # Auth endpoints
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    
    # User management
    path('', include(router.urls)),
    
    # Health check
    path('health/', HealthCheckView.as_view(), name='health-check'),
]