import axios from 'axios';
// Intentionally avoid importing axios types here to keep build-time type checks simpler
import type { Task, User, Notification, ChatRoom, Message } from '../types';
import { useAuthStore } from '../stores/auth.store';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000/api';

// Note: We now rely on HttpOnly cookies for authentication. The backend sets
// `access` and `refresh` cookies on login and refresh endpoints. These cookies
// are HttpOnly and cannot be accessed from JavaScript; axios will send them
// automatically when `withCredentials` is true.
// Optional in-memory token that is used only for WebSocket subprotocols when the
// server returns a token in login/refresh payload. This is only a fallback and
// doesn't change the cookie-backed auth flow.
let wsSubprotocolToken: string | null = null;
export const getWsSubprotocolToken = () => wsSubprotocolToken;
export const setWsSubprotocolToken = (token: string | null) => { wsSubprotocolToken = token; };
export const clearTokens = () => { /* no-op: tokens are cookie-backed */ wsSubprotocolToken = null; };

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Attach Authorization header when in-memory access token exists.
// use a permissive `any` here to avoid strict axios internal type mismatches during build
// With HttpOnly cookie-based authentication we do not add Authorization via JS.
// Keep interceptor to return config unchanged and ensure `withCredentials`.
api.interceptors.request.use((config: any) => {
  config.withCredentials = true;
  return config;
});

// Token refresh handling with queue to avoid multiple simultaneous refresh calls.
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach(({ resolve, reject, config }: any) => {
    if (error) {
      reject(error);
    } else {
      resolve(api.request(config));
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const originalRequest: any = error.config;

    // If unauthorized, try refresh flow once
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue the request and return a promise that resolves once refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      isRefreshing = true;

      try {
        // Rely on cookie-based refresh: server will set HttpOnly `access` cookie.
        await axios.post(`${API_URL}/auth/token/refresh/`, {}, { withCredentials: true });
        processQueue(null);
        isRefreshing = false;
        // Retry original request; the cookie set by the refresh response will be sent.
        return api.request(originalRequest);
      } catch (err) {
        processQueue(err);
        isRefreshing = false;
        // On refresh failure, clear auth state and tokens
        try {
          useAuthStore.getState().logout();
        } catch (e) {
          // ignore
        }
        clearTokens();
        return Promise.reject(err);
      }
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
    }).then(res => {
      // Server sets HttpOnly `access` and `refresh` cookies; don't store in JS.
      // But save the access token in a short-lived in-memory variable only if
      // it's included in the response to support optional WS subprotocol use.
      if (res.data?.access) setWsSubprotocolToken(res.data.access);
      return res.data;
    }),

  register: (data: any) =>
    api.post<{ access?: string; refresh?: string; user: User }>('/users/auth/register/', data).then(res => {
      if (res?.data?.access) setWsSubprotocolToken(res.data.access);
      return res.data;
    }),

  refreshToken: () =>
    api.post<{ access: string; refresh?: string }>('/auth/token/refresh/', {}, { withCredentials: true }).then(res => {
      if (res?.data?.access) setWsSubprotocolToken(res.data.access);
      return res.data;
    }),

  logout: () => {
    clearTokens();
    return api.post('/users/auth/logout/');
  },
  // Account management
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/change-password/', { old_password: oldPassword, new_password: newPassword }).then(res => res.data),

  passwordResetRequest: (email: string) =>
    api.post('/password-reset/', { email }).then(res => res.data),

  passwordResetConfirm: (token: string, newPassword: string) =>
    api.post('/password-reset/confirm/', { token, new_password: newPassword }).then(res => res.data),

  sendVerificationEmail: () =>
    api.post('/send-verification-email/').then(res => res.data),

  verifyEmail: (token: string) =>
    api.get(`/verify-email/${token}/`).then(res => res.data),
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

  updateTaskStatus: (id: number, status: string, reason?: string) =>
    api.post<Task>(`/tasks/${id}/update_status/`, reason ? { status, reason } : { status }).then(res => res.data),

  assignTask: (taskId: number, userIds: number[]) =>
    api.post<Task>(`/tasks/${taskId}/assign/`, { user_ids: userIds }).then(res => res.data),

  // Get assignment proposals (current user's proposals or supervisor view)
  getAssignments: () =>
    api.get(`/tasks/assignments/`).then(res => res.data),

  uploadAttachment: (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/tasks/${taskId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  deleteAttachment: (taskId: number, attachmentId: number) =>
    api.delete(`/tasks/${taskId}/attachments/${attachmentId}/`).then(res => res.data),

  // Propose assignment(s) to user(s)
  proposeAssignment: (taskId: number, userIds: number[]) =>
    api.post(`/tasks/${taskId}/propose_assignment/`, { user_ids: userIds }).then(res => res.data),

  // Respond to a proposed assignment: action = 'accept' | 'reject', optional reason
  respondAssignment: (taskId: number, assignmentId: number, action: 'accept' | 'reject', reason?: string) =>
    api.post(`/tasks/${taskId}/respond_assignment/`, { assignment_id: assignmentId, action, reason }).then(res => res.data),

  // Bulk operations
  bulkUpdate: (ids: number[], data: any) =>
    api.post(`/tasks/bulk_update/`, { ids, data }).then(res => res.data),

  bulkAssign: (ids: number[], userIds: number[], replace: boolean = false) =>
    api.post(`/tasks/bulk_assign/`, { ids, user_ids: userIds, replace }).then(res => res.data),

  bulkDelete: (ids: number[]) =>
    api.post(`/tasks/bulk_delete/`, { ids }).then(res => res.data),
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
export interface MessagesPaginatedResponse {
  results: Message[];
  count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

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

  getMessages: (roomId: number, params?: { page?: number; page_size?: number }) =>
    api.get<MessagesPaginatedResponse>(`/chat/rooms/${roomId}/messages/`, { params })
      .then(res => res.data),

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
    api.delete(`/tasks/attachments/${attachmentId}/`).then(res => res.data),
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
    api.get<PaginatedResponse<ActivityLog> | ActivityLog[]>(`/tasks/${taskId}/activity_logs/`).then(res => {
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