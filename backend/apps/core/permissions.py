from rest_framework import permissions
from django.contrib.auth import get_user_model

User = get_user_model()


class IsSupervisorOrATL(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['supervisor', 'atl']


class CanAssignTask(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and request.user.role in ['supervisor', 'atl']


class CanViewTask(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'supervisor':
            return True
        if request.user.role == 'atl':
            return obj.assigned_to.filter(role__in=['clerk', 'atm']).exists()
        return obj.assigned_to.filter(id=request.user.id).exists()


class IsTaskAssignee(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.assigned_to.filter(id=request.user.id).exists()