from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class Role(models.TextChoices):
    CLERK = 'clerk', _('Clerk')
    ATM = 'atm', _('Audit Team Member')
    ATL = 'atl', _('Audit Team Leader')
    SUPERVISOR = 'supervisor', _('Supervisor')


class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLERK
    )
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'users'
    
    @property
    def is_supervisor_or_above(self):
        return self.role in [Role.SUPERVISOR, Role.ATL]
    
    def can_view_task(self, task):
        if self.role == Role.SUPERVISOR:
            return True
        if self.role == Role.ATL:
            return task.assigned_to.filter(role__in=[Role.CLERK, Role.ATM]).exists()
        return task.assigned_to.filter(id=self.id).exists()