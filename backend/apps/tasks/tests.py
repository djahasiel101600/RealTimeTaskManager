from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from unittest.mock import patch, Mock, AsyncMock
import datetime
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


class BulkTaskOperationsTests(APITestCase):
	def setUp(self):
		self.creator = User.objects.create_user(email='creator3@example.com', username='creator3', password='pass')
		self.assignee = User.objects.create_user(email='assignee3@example.com', username='assignee3', password='pass')
		self.supervisor = User.objects.create_user(email='sup2@example.com', username='sup2', password='pass')
		self.supervisor.role = 'supervisor'
		self.supervisor.save()

		self.atl = User.objects.create_user(email='atl@example.com', username='atl', password='pass')
		self.atl.role = 'atl'
		self.atl.save()

		# Create several tasks
		self.t1 = Task.objects.create(title='Bulk1', description='d', created_by=self.creator)
		self.t2 = Task.objects.create(title='Bulk2', description='d', created_by=self.creator)
		self.t3 = Task.objects.create(title='Bulk3', description='d', created_by=self.atl)

		self.client = APIClient()

	def test_supervisor_can_bulk_assign(self):
		self.client.force_authenticate(user=self.supervisor)
		url = '/api/tasks/bulk_assign/'
		resp = self.client.post(url, {'ids': [self.t1.id, self.t2.id], 'user_ids': [self.assignee.id]}, format='json')
		self.assertEqual(resp.status_code, 200)
		# Check assigned
		self.t1.refresh_from_db(); self.t2.refresh_from_db()
		self.assertTrue(self.t1.assigned_to.filter(id=self.assignee.id).exists())

	def test_atl_can_bulk_update_their_tasks(self):
		# ATL created t3; they should be able to update it
		self.client.force_authenticate(user=self.atl)
		url = '/api/tasks/bulk_update/'
		resp = self.client.post(url, {'ids': [self.t3.id], 'data': {'priority': 'high'}}, format='json')
		self.assertEqual(resp.status_code, 200)
		self.t3.refresh_from_db()
		self.assertEqual(self.t3.priority, 'high')

	def test_atl_cannot_bulk_delete(self):
		self.client.force_authenticate(user=self.atl)
		url = '/api/tasks/bulk_delete/'
		resp = self.client.post(url, {'ids': [self.t1.id]}, format='json')
		self.assertEqual(resp.status_code, 403)


class BulkTaskOperationsEdgeTests(APITestCase):
	"""Edge-case tests for bulk task operations."""
	def setUp(self):
		self.creator = User.objects.create_user(email='creator4@example.com', username='creator4', password='pass')
		self.other = User.objects.create_user(email='other@example.com', username='other', password='pass')
		# make 'other' a supervisor so ATL should NOT have permission via assigned role
		self.other.role = 'supervisor'
		self.other.save()
		self.supervisor = User.objects.create_user(email='sup3@example.com', username='sup3', password='pass')
		self.supervisor.role = 'supervisor'
		self.supervisor.save()

		self.atl = User.objects.create_user(email='atl2@example.com', username='atl2', password='pass')
		self.atl.role = 'atl'
		self.atl.save()

		# Tasks: t1 created by creator, t2 created by other, t3 created by atl
		self.t1 = Task.objects.create(title='E1', description='d', created_by=self.creator)
		self.t2 = Task.objects.create(title='E2', description='d', created_by=self.other)
		self.t3 = Task.objects.create(title='E3', description='d', created_by=self.atl)

		# t1 initially assigned to other
		self.t1.assigned_to.add(self.other)

		self.client = APIClient()

	def test_bulk_update_invalid_payload_returns_errors(self):
		# supervisor tries to set invalid status value
		self.client.force_authenticate(user=self.supervisor)
		resp = self.client.post('/api/tasks/bulk_update/', {'ids': [self.t1.id], 'data': {'status': 'nope'}}, format='json')
		self.assertEqual(resp.status_code, 400)
		self.assertIn('errors', resp.data)
		self.assertIn('status', resp.data['errors'])

	def test_bulk_assign_no_valid_users(self):
		self.client.force_authenticate(user=self.supervisor)
		# use an ID that doesn't exist
		resp = self.client.post('/api/tasks/bulk_assign/', {'ids': [self.t1.id], 'user_ids': [99999]}, format='json')
		self.assertEqual(resp.status_code, 400)

	def test_bulk_assign_replace_replaces_existing_assignees(self):
		self.client.force_authenticate(user=self.supervisor)
		# t1 currently has 'other' assigned, replace with 'creator'
		resp = self.client.post('/api/tasks/bulk_assign/', {'ids': [self.t1.id], 'user_ids': [self.creator.id], 'replace': True}, format='json')
		self.assertEqual(resp.status_code, 200)
		self.t1.refresh_from_db()
		self.assertTrue(self.t1.assigned_to.filter(id=self.creator.id).exists())
		self.assertFalse(self.t1.assigned_to.filter(id=self.other.id).exists())

	def test_atl_partial_permission_only_updates_their_tasks(self):
		# ATL should only update tasks they created (t3) or tasks assigned to clerks/atm
		self.client.force_authenticate(user=self.atl)
		# try to update t1 (not theirs) and t3 (theirs)
		resp = self.client.post('/api/tasks/bulk_update/', {'ids': [self.t1.id, self.t3.id], 'data': {'priority': 'urgent'}}, format='json')
		self.assertEqual(resp.status_code, 200)
		updated_ids = resp.data.get('updated_ids', [])
		self.assertIn(self.t3.id, updated_ids)
		self.assertNotIn(self.t1.id, updated_ids)

	def test_bulk_delete_supervisor_deletes(self):
		self.client.force_authenticate(user=self.supervisor)
		resp = self.client.post('/api/tasks/bulk_delete/', {'ids': [self.t2.id]}, format='json')
		self.assertEqual(resp.status_code, 200)
		self.assertFalse(Task.objects.filter(id=self.t2.id).exists())

	def test_bulk_delete_non_supervisor_forbidden(self):
		self.client.force_authenticate(user=self.creator)
		resp = self.client.post('/api/tasks/bulk_delete/', {'ids': [self.t3.id]}, format='json')
		self.assertEqual(resp.status_code, 403)

	def test_bulk_update_with_nonexistent_id_ignored(self):
		self.client.force_authenticate(user=self.supervisor)
		# include a non-existent id
		resp = self.client.post('/api/tasks/bulk_update/', {'ids': [self.t1.id, 999999], 'data': {'priority': 'low'}}, format='json')
		self.assertEqual(resp.status_code, 200)
		updated_ids = resp.data.get('updated_ids', [])
		self.assertIn(self.t1.id, updated_ids)
		self.assertNotIn(999999, updated_ids)

	def test_bulk_assign_to_multiple_users(self):
		self.client.force_authenticate(user=self.supervisor)
		u1 = User.objects.create_user(email='m1@example.com', username='m1', password='pass')
		u2 = User.objects.create_user(email='m2@example.com', username='m2', password='pass')
		resp = self.client.post('/api/tasks/bulk_assign/', {'ids': [self.t1.id], 'user_ids': [u1.id, u2.id]}, format='json')
		self.assertEqual(resp.status_code, 200)
		self.t1.refresh_from_db()
		self.assertTrue(self.t1.assigned_to.filter(id=u1.id).exists())
		self.assertTrue(self.t1.assigned_to.filter(id=u2.id).exists())

	def test_bulk_assign_idempotent(self):
		self.client.force_authenticate(user=self.supervisor)
		u = User.objects.create_user(email='u1@example.com', username='u1', password='pass')
		# assign twice
		resp1 = self.client.post('/api/tasks/bulk_assign/', {'ids': [self.t2.id], 'user_ids': [u.id]}, format='json')
		resp2 = self.client.post('/api/tasks/bulk_assign/', {'ids': [self.t2.id], 'user_ids': [u.id]}, format='json')
		self.assertEqual(resp1.status_code, 200)
		self.assertEqual(resp2.status_code, 200)
		self.t2.refresh_from_db()
		self.assertEqual(self.t2.assigned_to.filter(id=u.id).count(), 1)

	def test_bulk_assign_rolls_back_on_exception(self):
		"""If an exception occurs during bulk_assign, the DB changes should rollback."""
		from unittest.mock import patch

		self.client.force_authenticate(user=self.supervisor)
		u = User.objects.create_user(email='rb@example.com', username='rb', password='pass')

		# Prepare two tasks to assign
		tasks = [self.t1, self.t2]

		call_count = {'n': 0}

		def flaky_notify(user_id, payload):
			call_count['n'] += 1
			# raise on the second notification to simulate a mid-transaction failure
			if call_count['n'] == 2:
				raise Exception('simulated notification failure')

		with patch('apps.tasks.views.send_notification_ws', side_effect=flaky_notify):
			# perform the bulk_assign; it may raise due to our patched notifier
			try:
				self.client.post('/api/tasks/bulk_assign/', {'ids': [t.id for t in tasks], 'user_ids': [u.id]}, format='json')
			except Exception:
				# swallow: we expect the operation to fail and roll back
				pass

		# Reload tasks and assert user was not assigned to any (rolled back)
		for t in tasks:
			t.refresh_from_db()
			self.assertFalse(t.assigned_to.filter(id=u.id).exists())

	def test_bulk_update_rolls_back_on_exception(self):
		"""If an exception occurs during bulk_update, the DB changes should rollback."""
		from unittest.mock import patch

		self.client.force_authenticate(user=self.supervisor)

		# Set explicit priorities so we can detect changes
		self.t1.priority = 'normal'
		self.t2.priority = 'normal'
		self.t1.save(); self.t2.save()

		tasks = [self.t1, self.t2]

		call_count = {'n': 0}

		def flaky_create_log(self_obj, task, action, details=None):
			call_count['n'] += 1
			# raise on second log to simulate mid-transaction failure
			if call_count['n'] == 2:
				raise Exception('simulated activity log failure')

		with patch('apps.tasks.views.TaskViewSet.create_activity_log', side_effect=flaky_create_log):
			try:
				self.client.post('/api/tasks/bulk_update/', {'ids': [t.id for t in tasks], 'data': {'priority': 'low'}}, format='json')
			except Exception:
				# swallow: failure expected
				pass

		# Reload tasks and ensure none were changed to 'low'
		for t in tasks:
			t.refresh_from_db()
			self.assertNotEqual(t.priority, 'low')

	def test_bulk_delete_rolls_back_on_exception(self):
		"""If an exception occurs during bulk_delete, the DB changes should rollback (no deletions)."""
		from unittest.mock import patch

		self.client.force_authenticate(user=self.supervisor)

		# Prepare two tasks
		tasks = [self.t1, self.t2]

		call_count = {'n': 0}

		def flaky_create_log(self_obj, task, action, details=None):
			call_count['n'] += 1
			# raise on first invocation to simulate failure before deletes
			if call_count['n'] == 1:
				raise Exception('simulated activity log failure')

		with patch('apps.tasks.views.TaskViewSet.create_activity_log', side_effect=flaky_create_log):
			try:
				self.client.post('/api/tasks/bulk_delete/', {'ids': [t.id for t in tasks]}, format='json')
			except Exception:
				# swallow expected failure
				pass

		# Ensure both tasks still exist (rolled back)
		for t in tasks:
			t.refresh_from_db()
			self.assertTrue(Task.objects.filter(id=t.id).exists())

	def test_bulk_delete_with_nonexistent_id(self):
		self.client.force_authenticate(user=self.supervisor)
		resp = self.client.post('/api/tasks/bulk_delete/', {'ids': [self.t2.id, 999999]}, format='json')
		self.assertEqual(resp.status_code, 200)
		self.assertFalse(Task.objects.filter(id=self.t2.id).exists())


class SystemMessageTests(APITestCase):
	"""Tests that system chat messages are created and broadcast for task events."""
	def setUp(self):
		self.creator = User.objects.create_user(email='creator_sys@example.com', username='creator_sys', password='pass')
		self.assignee = User.objects.create_user(email='assignee_sys@example.com', username='assignee_sys', password='pass')
		self.supervisor = User.objects.create_user(email='sup_sys@example.com', username='sup_sys', password='pass')
		self.supervisor.role = 'supervisor'
		self.supervisor.save()

		# Tasks
		self.task = Task.objects.create(title='SysMsg Task', description='desc', created_by=self.creator)
		# Ensure a room exists for the task
		self.room = ChatRoom.objects.create(room_type='task', task=self.task)

		self.client = APIClient()

	def _last_group_message(self, mock_layer):
		# Helper to retrieve last group_send payload
		assert mock_layer.group_send.call_count >= 1
		args, kwargs = mock_layer.group_send.call_args
		return args[1].get('message')

	def test_assign_creates_system_message_and_broadcast(self):
		self.client.force_authenticate(user=self.creator)
		with patch('apps.tasks.views.get_channel_layer') as mock_gcl:
			mock_layer = Mock()
			mock_layer.group_send = AsyncMock()
			mock_gcl.return_value = mock_layer

			resp = self.client.post(f'/api/tasks/{self.task.id}/assign/', {'user_ids': [self.assignee.id]}, format='json')
			self.assertEqual(resp.status_code, 200)

			# Check DB message created
			msgs = ChatMessage.objects.filter(room=self.room).order_by('-timestamp')
			self.assertTrue(msgs.exists())
			latest = msgs.first()
			self.assertIn('Assigned', latest.content)

			# Check broadcast payload
			message = self._last_group_message(mock_layer)
			self.assertIn('content', message)
			self.assertIn('Assigned', message['content'])

	def test_bulk_assign_creates_system_messages_and_broadcasts(self):
		# create an additional task
		t2 = Task.objects.create(title='SysMsg Task 2', description='desc', created_by=self.creator)
		ChatRoom.objects.create(room_type='task', task=t2)

		self.client.force_authenticate(user=self.supervisor)
		with patch('apps.tasks.views.get_channel_layer') as mock_gcl:
			mock_layer = Mock()
			mock_layer.group_send = AsyncMock()
			mock_gcl.return_value = mock_layer

			resp = self.client.post('/api/tasks/bulk_assign/', {'ids': [self.task.id, t2.id], 'user_ids': [self.assignee.id]}, format='json')
			self.assertEqual(resp.status_code, 200)

			# Both rooms should have messages
			m1 = ChatMessage.objects.filter(room__task=self.task).exists()
			m2 = ChatMessage.objects.filter(room__task=t2).exists()
			self.assertTrue(m1)
			self.assertTrue(m2)

			# group_send was called at least once
			self.assertTrue(mock_layer.group_send.call_count >= 1)

	def test_upload_attachment_creates_system_message_and_broadcast(self):
		# Use a supervisor (has broad permissions) to avoid permission checks
		self.client.force_authenticate(user=self.supervisor)
		with patch('apps.tasks.views.get_channel_layer') as mock_gcl:
			mock_layer = Mock()
			mock_layer.group_send = AsyncMock()
			mock_gcl.return_value = mock_layer

			from django.core.files.uploadedfile import SimpleUploadedFile
			# use an allowed mime type (pdf) to pass file validation
			f = SimpleUploadedFile('test.pdf', b'%%PDF-1.4\n%', content_type='application/pdf')
			resp = self.client.post(f'/api/tasks/{self.task.id}/upload_attachment/', {'file': f}, format='multipart')
			self.assertEqual(resp.status_code, 201)

			msgs = ChatMessage.objects.filter(room=self.room).order_by('-timestamp')
			self.assertTrue(msgs.exists())
			self.assertIn('File attached', msgs.first().content)
			message = self._last_group_message(mock_layer)
			self.assertIn('content', message)

	def test_update_status_creates_system_message_and_broadcast(self):
		# Use a supervisor (bypass attach permission edge cases)
		self.client.force_authenticate(user=self.supervisor)
		with patch('apps.tasks.views.get_channel_layer') as mock_gcl:
			mock_layer = Mock()
			mock_layer.group_send = AsyncMock()
			mock_gcl.return_value = mock_layer

			# use an allowed transition from default 'todo' -> 'in_progress'
			resp = self.client.post(f'/api/tasks/{self.task.id}/update_status/', {'status': 'in_progress'}, format='json')
			self.assertEqual(resp.status_code, 200)

			msgs = ChatMessage.objects.filter(room=self.room).order_by('-timestamp')
			self.assertTrue(msgs.exists())
			self.assertIn('Status changed', msgs.first().content)
			message = self._last_group_message(mock_layer)
			self.assertIn('content', message)

	def test_broadcast_payload_full_shape(self):
		"""Assert the broadcast payload contains the exact expected shape and types."""
		self.client.force_authenticate(user=self.creator)
		with patch('apps.tasks.views.get_channel_layer') as mock_gcl:
			mock_layer = Mock()
			mock_layer.group_send = AsyncMock()
			mock_gcl.return_value = mock_layer

			resp = self.client.post(f'/api/tasks/{self.task.id}/assign/', {'user_ids': [self.assignee.id]}, format='json')
			self.assertEqual(resp.status_code, 200)

			# Inspect the last broadcast payload
			message = self._last_group_message(mock_layer)
			expected_keys = {'id', 'content', 'sender', 'timestamp', 'room_type', 'room_id', 'attachments'}
			self.assertEqual(set(message.keys()), expected_keys)

			# Basic type checks
			self.assertIsInstance(message['id'], int)
			self.assertIn('Assigned', message['content'])

			if message['sender'] is not None:
				self.assertIsInstance(message['sender'], dict)
				self.assertIn('id', message['sender'])
				self.assertIn('username', message['sender'])
				self.assertIn('avatar', message['sender'])

			# Timestamp should be ISO-formatted parseable
			ts = datetime.datetime.fromisoformat(message['timestamp'])
			self.assertIsNotNone(ts)

			self.assertEqual(message['room_type'], 'task')
			self.assertEqual(message['room_id'], self.room.id)
			self.assertIsInstance(message['attachments'], list)
