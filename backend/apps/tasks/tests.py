from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth import get_user_model
from .models import Task, ActivityLog
from apps.chat.models import ChatRoom, Message as ChatMessage

User = get_user_model()


class UpdateStatusReasonTests(APITestCase):
	def setUp(self):
		# Create users
		self.creator = User.objects.create_user(email='creator@example.com', username='creator', password='pass')
		self.assignee = User.objects.create_user(email='assignee@example.com', username='assignee', password='pass')
		# Ensure assignee has a role that allows status updates (default is clerk)
		self.assignee.role = 'clerk'
		self.assignee.save()

		# Create a task and assign
		self.task = Task.objects.create(title='Test Task', description='desc', created_by=self.creator)
		self.task.assigned_to.add(self.assignee)

		# Ensure a chat room for task exists
		self.room = ChatRoom.objects.create(room_type='task', task=self.task)
		self.room.participants.add(self.creator, self.assignee)

		self.client = APIClient()
		self.client.force_authenticate(user=self.assignee)

	def test_update_to_cancelled_requires_reason(self):
		url = f'/api/tasks/{self.task.id}/update_status/'
		resp = self.client.post(url, {'status': 'cancelled'}, format='json')
		self.assertEqual(resp.status_code, 400)
		self.assertIn('reason', resp.data.get('error', '') or '')

	def test_update_to_cancelled_with_reason_succeeds_and_logs(self):
		url = f'/api/tasks/{self.task.id}/update_status/'
		reason_text = 'No longer needed'
		resp = self.client.post(url, {'status': 'cancelled', 'reason': reason_text}, format='json')
		self.assertEqual(resp.status_code, 200)

		# Reload task
		self.task.refresh_from_db()
		self.assertEqual(self.task.status, 'cancelled')

		# Check activity log contains the reason
		logs = ActivityLog.objects.filter(task=self.task, action='status_changed')
		self.assertTrue(logs.exists())
		log = logs.order_by('-timestamp').first()
		self.assertIn('reason', log.details)
		self.assertEqual(log.details.get('reason'), reason_text)

		# Check a chat message was created in the task room mentioning the reason
		messages = ChatMessage.objects.filter(room=self.room).order_by('-timestamp')
		self.assertTrue(messages.exists())
		latest = messages.first()
		self.assertIn('Status changed to', latest.content)
		self.assertIn('Reason:', latest.content)


class TaskAssignmentTests(APITestCase):
	def setUp(self):
		self.creator = User.objects.create_user(email='creator2@example.com', username='creator2', password='pass')
		self.assignee = User.objects.create_user(email='assignee2@example.com', username='assignee2', password='pass')
		self.supervisor = User.objects.create_user(email='sup@example.com', username='sup', password='pass')
		self.supervisor.role = 'supervisor'
		self.supervisor.save()

		self.task = Task.objects.create(title='Assignment Task', description='desc', created_by=self.creator)

		self.client = APIClient()

	def test_propose_assignment_creates_pending_and_not_assign(self):
		# creator proposes assignment
		self.client.force_authenticate(user=self.creator)
		url = f'/api/tasks/{self.task.id}/propose_assignment/'
		resp = self.client.post(url, {'user_ids': [self.assignee.id]}, format='json')
		self.assertEqual(resp.status_code, 200)
		created_ids = resp.data.get('created_assignment_ids', [])
		self.assertTrue(len(created_ids) >= 1)

		# assignment exists and is pending
		from .models import TaskAssignment
		assignment = TaskAssignment.objects.filter(task=self.task, user=self.assignee).first()
		self.assertIsNotNone(assignment)
		self.assertEqual(assignment.status, 'pending')

		# assignee is not yet in task.assigned_to
		self.assertFalse(self.task.assigned_to.filter(id=self.assignee.id).exists())

	def test_user_can_list_their_assignments(self):
		# prepare assignment
		from .models import TaskAssignment
		assignment = TaskAssignment.objects.create(task=self.task, user=self.assignee, assigned_by=self.creator)

		# assignee lists assignments
		self.client.force_authenticate(user=self.assignee)
		resp = self.client.get('/api/tasks/assignments/')
		
		self.assertEqual(resp.status_code, 200)
		data = resp.data
		# ensure at least one assignment present and belongs to assignee
		ids = [a.get('id') for a in data]
		self.assertIn(assignment.id, ids)

	def test_user_can_accept_assignment_and_be_added(self):
		from .models import TaskAssignment
		assignment = TaskAssignment.objects.create(task=self.task, user=self.assignee, assigned_by=self.creator)

		# assignee accepts
		self.client.force_authenticate(user=self.assignee)
		url = f'/api/tasks/{self.task.id}/respond_assignment/'
		resp = self.client.post(url, {'assignment_id': assignment.id, 'action': 'accept'}, format='json')
		self.assertEqual(resp.status_code, 200)

		assignment.refresh_from_db()
		self.assertEqual(assignment.status, 'accepted')
		# and user is added to task.assigned_to
		self.assertTrue(self.task.assigned_to.filter(id=self.assignee.id).exists())

	def test_supervisor_can_filter_assignments(self):
		from .models import TaskAssignment
		assignment = TaskAssignment.objects.create(task=self.task, user=self.assignee, assigned_by=self.creator)

		self.client.force_authenticate(user=self.supervisor)
		resp = self.client.get(f'/api/tasks/assignments/?user_id={self.assignee.id}&status=pending')
		
		self.assertEqual(resp.status_code, 200)
		# Expect our assignment in the list
		ids = [a.get('id') for a in resp.data]
		self.assertIn(assignment.id, ids)
