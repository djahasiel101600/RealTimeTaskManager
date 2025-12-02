from django.urls import path
from .views import RegisterView, LogoutView, HealthCheckView, CustomTokenObtainPairView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
]
