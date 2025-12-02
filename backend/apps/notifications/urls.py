from django.urls import path
from .views import (
    NotificationListView,
    MarkNotificationAsReadView,
    MarkAllNotificationsAsReadView,
    DeleteNotificationView,
    ClearAllNotificationsView
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('<int:pk>/read/', MarkNotificationAsReadView.as_view(), name='notification-read'),
    path('mark-all-read/', MarkAllNotificationsAsReadView.as_view(), name='notification-mark-all-read'),
    path('<int:pk>/', DeleteNotificationView.as_view(), name='notification-delete'),
    path('clear-all/', ClearAllNotificationsView.as_view(), name='notification-clear-all'),
]