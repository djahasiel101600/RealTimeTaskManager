export type UserRole = 'clerk' | 'atm' | 'atl' | 'supervisor';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  is_online: boolean;
  last_seen?: string;
}

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface Task {
  id: number;
  title: string;
  description: string;
  created_by: User;
  assigned_to: User[];
  priority: Priority;
  status: TaskStatus;
  due_date?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  attachments: TaskAttachment[];
}

export interface TaskAttachment {
  id: number;
  file: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: User;
  uploaded_at: string;
}

export interface Notification {
  id: number;
  user: User;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface ChatRoom {
  id: number;
  room_type: 'direct' | 'task' | 'group';
  name?: string;
  participants?: User[];
  task?: Task;
  last_message?: Message;
  unread_count: number;
}

export interface Message {
  id: number;
  content: string;
  sender: User;
  room: ChatRoom;
  attachments: MessageAttachment[];
  timestamp: string;
  is_read: boolean;
}

export interface MessageAttachment {
  id: number;
  file: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  user?: User;
  details: Record<string, any>;
  timestamp: string;
  ip_address?: string;
}