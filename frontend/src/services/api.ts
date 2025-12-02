import axios from 'axios';
import type { Task, User, Notification, ChatRoom, Message } from '../types';
import { useAuthStore } from '../stores/auth.store';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: (email: string, password: string) =>
    api.post<{ access: string; refresh: string; user: User }>('/auth/login/', {
      email,
      password,
    }).then(res => res.data),

  register: (data: any) =>
    api.post<User>('/auth/register/', data).then(res => res.data),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/refresh/', { refresh }).then(res => res.data),

  logout: () => api.post('/auth/logout/'),
};

// Task Service
export const taskService = {
  getTasks: (filters?: any) =>
    api.get<Task[]>('/tasks/', { params: filters }).then(res => res.data),

  getTask: (id: number) =>
    api.get<Task>(`/tasks/${id}/`).then(res => res.data),

  createTask: (data: any) =>
    api.post<Task>('/tasks/', data).then(res => res.data),

  updateTask: (id: number, data: any) =>
    api.patch<Task>(`/tasks/${id}/`, data).then(res => res.data),

  deleteTask: (id: number) =>
    api.delete(`/tasks/${id}/`).then(res => res.data),

  updateTaskStatus: (id: number, status: string) =>
    api.post<Task>(`/tasks/${id}/status/`, { status }).then(res => res.data),

  assignTask: (taskId: number, userIds: number[]) =>
    api.post<Task>(`/tasks/${taskId}/assign/`, { user_ids: userIds }).then(res => res.data),

  uploadAttachment: (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/tasks/${taskId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  deleteAttachment: (taskId: number, attachmentId: number) =>
    api.delete(`/tasks/${taskId}/attachments/${attachmentId}/`).then(res => res.data),
};

// Notification Service
export const notificationService = {
  getNotifications: () =>
    api.get<Notification[]>('/notifications/').then(res => res.data),

  markAsRead: (id: number) =>
    api.patch(`/notifications/${id}/read/`).then(res => res.data),

  markAllAsRead: () =>
    api.post('/notifications/mark-all-read/').then(res => res.data),

  deleteNotification: (id: number) =>
    api.delete(`/notifications/${id}/`).then(res => res.data),

  clearAll: () =>
    api.delete('/notifications/clear-all/').then(res => res.data),
};

// Chat Service
export const chatService = {
  getRooms: () =>
    api.get<ChatRoom[]>('/chat/rooms/').then(res => res.data),

  getRoom: (id: number) =>
    api.get<ChatRoom>(`/chat/rooms/${id}/`).then(res => res.data),

  getMessages: (roomId: number, params?: any) =>
    api.get<Message[]>(`/chat/rooms/${roomId}/messages/`, { params })
      .then(res => res.data),

  sendMessage: (roomId: number, content: string, attachments: File[] = []) => {
    const formData = new FormData();
    formData.append('content', content);
    attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });
    
    return api.post<Message>(`/chat/rooms/${roomId}/messages/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  createDirectRoom: (userId: number) =>
    api.post<ChatRoom>('/chat/rooms/direct/', { user_id: userId }).then(res => res.data),

  createTaskRoom: (taskId: number) =>
    api.post<ChatRoom>('/chat/rooms/task/', { task_id: taskId }).then(res => res.data),

  markMessagesAsRead: (roomId: number) =>
    api.post(`/chat/rooms/${roomId}/mark-read/`).then(res => res.data),

  markRoomAsRead: (roomId: number) =>
    api.patch<ChatRoom>(`/chat/rooms/${roomId}/read/`).then(res => res.data),
};

// User Service
export const userService = {
  getUsers: (params?: any) =>
    api.get<User[]>('/users/', { params }).then(res => res.data),

  getUser: (id: number) =>
    api.get<User>(`/users/${id}/`).then(res => res.data),

  updateProfile: (data: any) =>
    api.patch<User>('/users/profile/', data).then(res => res.data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.patch<User>('/users/profile/avatar/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },
  // NEW: Update user role (for supervisors/ATLs only)
  updateUserRole: (userId: number, role: string) =>
    api.post<User>(`/users/${userId}/change_role/`, { role }).then(res => res.data),

  // NEW: Delete user (for supervisors only)
  deleteUser: (userId: number) =>
    api.delete(`/users/${userId}/`).then(res => res.data),

  // NEW: Get user statistics
  getStats: () =>
    api.get('/users/stats/').then(res => res.data),

  // NEW: Search users
  searchUsers: (query: string) =>
    api.get<User[]>('/users/search/', { params: { q: query } }).then(res => res.data),
};

export default api;