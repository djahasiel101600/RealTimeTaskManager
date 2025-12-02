#!/usr/bin/env python
import os
import django
import random
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'task_manager.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.tasks.models import Task, TaskAttachment, ActivityLog
from apps.chat.models import ChatRoom, Message
from apps.notifications.models import Notification

User = get_user_model()

def create_superuser():
    """Create superuser if it doesn't exist"""
    if not User.objects.filter(email='admin@taskmanager.com').exists():
        User.objects.create_superuser(
            username='admin',
            email='admin@taskmanager.com',
            password='admin123',
            role='supervisor'
        )
        print("Superuser created: admin / admin123")

def create_test_users():
    """Create test users for each role"""
    roles = ['clerk', 'atm', 'atl', 'supervisor']
    users = []
    
    for i, role in enumerate(roles, 1):
        username = f'test_{role}'
        email = f'{role}@taskmanager.com'
        
        if not User.objects.filter(email=email).exists():
            user = User.objects.create_user(
                username=username,
                email=email,
                password='test123',
                role=role,
                phone=f'+1 (555) 123-{4000 + i}'
            )
            users.append(user)
            print(f"Created user: {username} / test123 (Role: {role})")
    
    return users

def create_test_tasks(users):
    """Create test tasks"""
    priorities = ['low', 'normal', 'high', 'urgent']
    statuses = ['todo', 'in_progress', 'review', 'done']
    
    tasks = [
        {
            'title': 'Annual Financial Audit',
            'description': 'Complete the annual financial audit for Q4 2023',
            'priority': 'high',
            'status': 'in_progress',
            'due_date': datetime.now() + timedelta(days=14),
        },
        {
            'title': 'Update Security Protocols',
            'description': 'Review and update company security protocols',
            'priority': 'urgent',
            'status': 'todo',
            'due_date': datetime.now() + timedelta(days=7),
        },
        {
            'title': 'Client Meeting Preparation',
            'description': 'Prepare materials for upcoming client meeting',
            'priority': 'normal',
            'status': 'review',
            'due_date': datetime.now() + timedelta(days=3),
        },
        {
            'title': 'Database Migration',
            'description': 'Migrate legacy database to new cloud infrastructure',
            'priority': 'high',
            'status': 'done',
            'due_date': datetime.now() - timedelta(days=1),
        },
        {
            'title': 'Team Training Session',
            'description': 'Organize training session for new team members',
            'priority': 'low',
            'status': 'todo',
            'due_date': datetime.now() + timedelta(days=30),
        },
    ]
    
    created_tasks = []
    supervisor = User.objects.get(role='supervisor')
    
    for task_data in tasks:
        task = Task.objects.create(
            title=task_data['title'],
            description=task_data['description'],
            created_by=supervisor,
            priority=task_data['priority'],
            status=task_data['status'],
            due_date=task_data['due_date'],
        )
        
        # Assign random users to task
        assignees = random.sample(users, min(3, len(users)))
        task.assigned_to.add(*assignees)
        
        # Create activity log
        ActivityLog.objects.create(
            task=task,
            user=supervisor,
            action='created',
            details={'title': task.title}
        )
        
        created_tasks.append(task)
        print(f"Created task: {task.title}")
    
    return created_tasks

def create_test_chats(users, tasks):
    """Create test chat rooms and messages"""
    # Create direct chat between two users
    user1, user2 = users[0], users[1]
    direct_room = ChatRoom.objects.create(room_type='direct')
    direct_room.participants.add(user1, user2)
    
    # Create task chat for first task
    task_chat = ChatRoom.objects.create(room_type='task', task=tasks[0])
    task_chat.participants.add(*tasks[0].assigned_to.all())
    
    # Create sample messages
    messages = [
        (direct_room, user1, "Hello! How are you doing?"),
        (direct_room, user2, "Hi! I'm good, working on the audit report."),
        (direct_room, user1, "Great! Let me know if you need any help."),
        (task_chat, tasks[0].assigned_to.first(), "I've started working on the audit."),
        (task_chat, tasks[0].assigned_to.last(), "I'll review the financial statements tomorrow."),
    ]
    
    for room, sender, content in messages:
        Message.objects.create(
            room=room,
            sender=sender,
            content=content
        )
    
    print("Created test chats and messages")

def create_test_notifications(users):
    """Create test notifications"""
    notification_types = [
        ('task_assigned', 'New Task Assigned', 'You have been assigned to a new task'),
        ('task_updated', 'Task Updated', 'A task you are assigned to has been updated'),
        ('due_date', 'Due Date Reminder', 'Task due date is approaching'),
        ('chat_message', 'New Message', 'You have a new chat message'),
    ]
    
    for user in users:
        for i, (ntype, title, message) in enumerate(notification_types):
            Notification.objects.create(
                user=user,
                type=ntype,
                title=title,
                message=message,
                data={'test': True, 'index': i},
                is_read=random.choice([True, False])
            )
    
    print("Created test notifications")

def main():
    """Main function to seed database"""
    print("Starting database seeding...")
    
    # Create users
    create_superuser()
    users = create_test_users()
    
    # Create tasks
    tasks = create_test_tasks(users)
    
    # Create chats
    create_test_chats(users, tasks)
    
    # Create notifications
    create_test_notifications(users)
    
    print("\nDatabase seeding completed!")
    print("\nAvailable users:")
    for user in User.objects.all():
        print(f"- {user.username} ({user.role}): {user.email}")
    
    print("\nLogin credentials:")
    print("Supervisor: admin / admin123")
    print("Other users: test_{role} / test123")

if __name__ == '__main__':
    main()