from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid


class User(AbstractUser):
    class Role(models.TextChoices):
        CLERK = 'clerk', _('Clerk')
        ATM = 'atm', _('Audit Team Member')
        ATL = 'atl', _('Audit Team Leader')
        SUPERVISOR = 'supervisor', _('Supervisor')
    
    # Override email to make it unique (required for USERNAME_FIELD)
    email = models.EmailField(_('email address'), unique=True)
    
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLERK
    )
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    # Email verification
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.UUIDField(default=uuid.uuid4, null=True, blank=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Use email as the login field instead of username
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'users'
    
    @property
    def is_supervisor_or_above(self):
        return self.role in [self.Role.SUPERVISOR, self.Role.ATL]
    
    def can_view_task(self, task):
        """Check if user can view/access a task."""
        # Supervisors can view all tasks
        if self.role == self.Role.SUPERVISOR:
            return True
        
        # Task creator can always view their own task
        if task.created_by_id == self.id:
            return True
        
        # Users assigned to the task can view it
        if task.assigned_to.filter(id=self.id).exists():
            return True
        
        # ATL can view tasks assigned to Clerks/ATMs (team oversight)
        if self.role == self.Role.ATL:
            return task.assigned_to.filter(role__in=[self.Role.CLERK, self.Role.ATM]).exists()
        
        return False
    
    def generate_verification_token(self):
        """Generate a new email verification token"""
        self.email_verification_token = uuid.uuid4()
        self.email_verification_sent_at = None
        self.save(update_fields=['email_verification_token', 'email_verification_sent_at'])
        return self.email_verification_token


# Keep Role as module-level for backward compatibility
Role = User.Role