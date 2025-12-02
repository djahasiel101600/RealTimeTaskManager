from rest_framework import permissions
from django.contrib.auth import get_user_model
from .models import Task

User = get_user_model()


class IsSupervisorOrATL(permissions.BasePermission):
    """
    Permission check for Supervisor or Audit Team Leader roles.
    Supervisors and ATLs have elevated permissions.
    """
    
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['supervisor', 'atl']


class CanAssignTask(permissions.BasePermission):
    """
    Permission check for users who can assign tasks.
    Only Supervisors and ATLs can assign tasks to others.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Allow safe methods for everyone
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Only supervisors and ATLs can assign tasks
        return request.user.role in ['supervisor', 'atl']


class CanCreateTask(permissions.BasePermission):
    """
    Permission check for users who can create tasks.
    Only Supervisors and ATLs can create new tasks.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Allow safe methods for everyone
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Check if this is a create action
        if view.action == 'create':
            return request.user.role in ['supervisor', 'atl']
        
        return True


class CanViewTask(permissions.BasePermission):
    """
    Permission check for viewing specific tasks.
    Supervisors can view all tasks.
    ATLs can view tasks assigned to their team (clerks and ATMs).
    Clerks and ATMs can only view tasks assigned to them.
    """
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Supervisors can view everything
        if request.user.role == 'supervisor':
            return True
        
        # ATLs can view tasks assigned to clerks and ATMs in their team
        if request.user.role == 'atl':
            # Check if any assigned user is a clerk or ATM
            return obj.assigned_to.filter(role__in=['clerk', 'atm']).exists()
        
        # Clerks and ATMs can only view tasks assigned to them
        return obj.assigned_to.filter(id=request.user.id).exists()


class IsTaskAssignee(permissions.BasePermission):
    """
    Permission check for users assigned to a specific task.
    Allows task assignees to update their assigned tasks.
    """
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Supervisors and ATLs can update any task
        if request.user.role in ['supervisor', 'atl']:
            return True
        
        # Check if user is assigned to the task
        return obj.assigned_to.filter(id=request.user.id).exists()


class CanUpdateTaskStatus(permissions.BasePermission):
    """
    Permission check for updating task status.
    Task assignees can update status of their tasks.
    Supervisors and ATLs can update any task status.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # This permission is specific to status update action
        if view.action != 'update_status':
            return True
        
        return True
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Supervisors and ATLs can update any task
        if request.user.role in ['supervisor', 'atl']:
            return True
        
        # Check if user is assigned to the task
        return obj.assigned_to.filter(id=request.user.id).exists()


class CanAttachFiles(permissions.BasePermission):
    """
    Permission check for attaching files to tasks.
    Task assignees can attach files to their tasks.
    Supervisors and ATLs can attach files to any task.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # This permission is specific to file upload action
        if view.action != 'upload_attachment':
            return True
        
        return True
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Supervisors and ATLs can attach files to any task
        if request.user.role in ['supervisor', 'atl']:
            return True
        
        # Check if user is assigned to the task
        return obj.assigned_to.filter(id=request.user.id).exists()


class CanViewActivityLogs(permissions.BasePermission):
    """
    Permission check for viewing activity logs.
    Supervisors and ATLs can view all activity logs.
    Task assignees can view activity logs for their tasks.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # This permission is specific to activity logs action
        if view.action != 'activity_logs':
            return True
        
        return True
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Supervisors can view all activity logs
        if request.user.role == 'supervisor':
            return True
        
        # ATLs can view activity logs for tasks assigned to clerks and ATMs
        if request.user.role == 'atl':
            return obj.assigned_to.filter(role__in=['clerk', 'atm']).exists()
        
        # Task assignees can view activity logs for their tasks
        return obj.assigned_to.filter(id=request.user.id).exists()


class TaskPermissions(permissions.BasePermission):
    """
    Comprehensive task permission class that combines all permission checks.
    Used as the main permission class for TaskViewSet.
    """
    
    def has_permission(self, request, view):
        # Handle unauthenticated users
        if not request.user.is_authenticated:
            return False
        
        # Handle different actions
        if view.action == 'create':
            return CanCreateTask().has_permission(request, view)
        elif view.action in ['assign', 'update', 'partial_update', 'destroy']:
            return CanAssignTask().has_permission(request, view)
        elif view.action == 'update_status':
            return CanUpdateTaskStatus().has_permission(request, view)
        elif view.action == 'upload_attachment':
            return CanAttachFiles().has_permission(request, view)
        elif view.action == 'activity_logs':
            return CanViewActivityLogs().has_permission(request, view)
        
        # For list and retrieve actions, use object-level permission in has_object_permission
        return True
    
    def has_object_permission(self, request, view, obj):
        # Handle unauthenticated users
        if not request.user.is_authenticated:
            return False
        
        # Handle different actions
        if view.action in ['retrieve', 'list']:
            return CanViewTask().has_object_permission(request, view, obj)
        elif view.action in ['update', 'partial_update', 'destroy']:
            # Only supervisors, ATLs, or task creator can update/delete
            if request.user.role in ['supervisor', 'atl']:
                return True
            return obj.created_by == request.user
        elif view.action == 'update_status':
            return CanUpdateTaskStatus().has_object_permission(request, view, obj)
        elif view.action == 'upload_attachment':
            return CanAttachFiles().has_object_permission(request, view, obj)
        elif view.action == 'activity_logs':
            return CanViewActivityLogs().has_object_permission(request, view, obj)
        elif view.action == 'assign':
            return CanAssignTask().has_permission(request, view)
        
        return False


class TaskAttachmentPermissions(permissions.BasePermission):
    """
    Permission check for task attachments.
    Only task assignees can upload attachments.
    Only supervisors, ATLs, or uploader can delete attachments.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Handle different actions
        if view.action == 'create':
            # Check if user can upload attachments to the specified task
            task_id = request.data.get('task')
            if not task_id:
                return False
            
            try:
                from .models import Task
                task = Task.objects.get(id=task_id)
                
                # Supervisors and ATLs can upload to any task
                if request.user.role in ['supervisor', 'atl']:
                    return True
                
                # Check if user is assigned to the task
                return task.assigned_to.filter(id=request.user.id).exists()
            except Task.DoesNotExist:
                return False
        
        return True
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Supervisors and ATLs can do anything
        if request.user.role in ['supervisor', 'atl']:
            return True
        
        # For safe methods, check if user can view the task
        if request.method in permissions.SAFE_METHODS:
            return obj.task.assigned_to.filter(id=request.user.id).exists()
        
        # For delete, check if user is the uploader
        if view.action == 'destroy':
            return obj.uploaded_by == request.user
        
        return False