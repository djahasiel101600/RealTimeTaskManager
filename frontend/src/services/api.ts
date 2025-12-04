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
    api.post<{ access: string; refresh: string; user: User }>('/users/auth/login/', {
      email,
      password,
    }).then(res => res.data),

  register: (data: any) =>
    api.post<User>('/users/auth/register/', data).then(res => res.data),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/token/refresh/', { refresh }).then(res => res.data),

  logout: () => api.post('/users/auth/logout/'),
};

// Paginated response type
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Task Service
export const taskService = {
  getAll: (filters?: any) =>
    api.get<PaginatedResponse<Task> | Task[]>('/tasks/', { params: filters }).then(res => {
      // Handle both paginated and non-paginated responses
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      // Paginated response
      return data.results;
    }),

  getTasks: (filters?: any) =>
    api.get<PaginatedResponse<Task> | Task[]>('/tasks/', { params: filters }).then(res => res.data),

  getById: (id: number) =>
    api.get<Task>(`/tasks/${id}/`).then(res => res.data),

  getTask: (id: number) =>
    api.get<Task>(`/tasks/${id}/`).then(res => res.data),

  create: (data: any) =>
    api.post<Task>('/tasks/', data).then(res => res.data),

  createTask: (data: any) =>
    api.post<Task>('/tasks/', data).then(res => res.data),

  update: (id: number, data: any) =>
    api.patch<Task>(`/tasks/${id}/`, data).then(res => res.data),

  updateTask: (id: number, data: any) =>
    api.patch<Task>(`/tasks/${id}/`, data).then(res => res.data),

  delete: (id: number) =>
    api.delete(`/tasks/${id}/`).then(res => res.data),

  deleteTask: (id: number) =>
    api.delete(`/tasks/${id}/`).then(res => res.data),

  updateTaskStatus: (id: number, status: string) =>
    api.post<Task>(`/tasks/${id}/update_status/`, { status }).then(res => res.data),

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
    api.get<PaginatedResponse<Notification> | Notification[]>('/notifications/').then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      return data.results;
    }),

  markAsRead: (id: number) =>
    api.post(`/notifications/${id}/read/`).then(res => res.data),

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
    api.get<PaginatedResponse<ChatRoom> | ChatRoom[]>('/chat/rooms/').then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      return data.results;
    }),

  getRoom: (id: number) =>
    api.get<ChatRoom>(`/chat/rooms/${id}/`).then(res => res.data),

  getMessages: (roomId: number, params?: any) =>
    api.get<PaginatedResponse<Message> | Message[]>(`/chat/rooms/${roomId}/messages/`, { params })
      .then(res => {
        const data = res.data;
        if (Array.isArray(data)) {
          return data;
        }
        return data.results;
      }),

  sendMessage: (roomId: number, content: string, attachments: File[] = []) => {
    const formData = new FormData();
    formData.append('room', String(roomId));
    formData.append('content', content);
    attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });
    
    return api.post<Message>(`/chat/messages/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  createDirectRoom: (userId: number) =>
    api.post<ChatRoom>('/chat/rooms/', { room_type: 'direct', other_user_id: userId }).then(res => res.data),

  createTaskRoom: (taskId: number) =>
    api.post<ChatRoom>('/chat/rooms/', { room_type: 'task', task_id: taskId }).then(res => res.data),

  markMessagesAsRead: (roomId: number) =>
    api.post(`/chat/rooms/${roomId}/mark_read/`).then(res => res.data),

  markRoomAsRead: (roomId: number) =>
    api.post(`/chat/rooms/${roomId}/mark_read/`).then(res => res.data),
};

// User Service
export const userService = {
  getUsers: (params?: any) =>
    api.get<PaginatedResponse<User> | User[]>('/users/', { params }).then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      return data.results;
    }),

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
    api.get<PaginatedResponse<User> | User[]>('/users/search/', { params: { q: query } }).then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      return data.results;
    }),
};

// Attachment Service
import type { TaskAttachment } from '@/types';

export const attachmentService = {
  getByTask: (taskId: number) =>
    api.get<PaginatedResponse<TaskAttachment> | TaskAttachment[]>(`/tasks/${taskId}/attachments/`).then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      return data.results;
    }),

  upload: (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<TaskAttachment>(`/tasks/${taskId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  delete: (attachmentId: number) =>
    api.delete(`/attachments/${attachmentId}/`).then(res => res.data),
};

// Activity Log Service
export interface ActivityLog {
  id: number;
  action: string;
  user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
  };
  details: Record<string, any>;
  timestamp: string;
  task_title?: string;
  task_id?: number;
}

export const activityLogService = {
  getLogs: (params?: { 
    action?: string; 
    user_id?: number; 
    task_id?: number;
    from_date?: string;
    to_date?: string;
    page?: number;
    page_size?: number;
  }) =>
    api.get<PaginatedResponse<ActivityLog> | ActivityLog[]>('/activity-logs/', { params }).then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return { results: data, count: data.length };
      }
      return { results: data.results, count: data.count };
    }),

  getByTask: (taskId: number) =>
    api.get<PaginatedResponse<ActivityLog> | ActivityLog[]>(`/tasks/${taskId}/activity/`).then(res => {
      const data = res.data;
      if (Array.isArray(data)) {
        return data;
      }
      return data.results;
    }),
};

// Comment Service
export interface Comment {
  id: number;
  task: number;
  user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
  };
  content: string;
  created_at: string;
  updated_at: string;
}

export const commentService = {
  getByTask: (taskId: number) =>
    api.get<Comment[]>(`/tasks/${taskId}/comments/`).then(res => res.data),

  create: (taskId: number, content: string) =>
    api.post<Comment>(`/tasks/${taskId}/comments/`, { content }).then(res => res.data),
};

export default api;