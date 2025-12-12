from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import reverse


class RegisterTestCase(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.url = '/api/users/auth/register/'

	def test_register_sets_cookies(self):
		payload = {
			'username': 'testuser',
			'email': 'testuser@example.com',
			'password': 'ComplexPass!23',
			'role': 'clerk'
		}
		response = self.client.post(self.url, payload, format='json')
		self.assertEqual(response.status_code, 201)
		# Verify cookies are present in response
		self.assertIn('access', response.cookies)
		self.assertIn('refresh', response.cookies)
