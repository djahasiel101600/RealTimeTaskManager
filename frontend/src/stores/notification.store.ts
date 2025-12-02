import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification } from '../types';
import { notificationService } from '@/services/api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      
      fetchNotifications: async () => {
        set({ isLoading: true });
        try {
          const notifications = await notificationService.getNotifications();
          const unreadCount = notifications.filter(n => !n.is_read).length;
          set({ notifications, unreadCount, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      markAsRead: async (id: number) => {
        await notificationService.markAsRead(id);
        set((state) => {
          const updatedNotifications = state.notifications.map(notification =>
            notification.id === id ? { ...notification, is_read: true } : notification
          );
          const unreadCount = updatedNotifications.filter(n => !n.is_read).length;
          return {
            notifications: updatedNotifications,
            unreadCount,
          };
        });
      },
      
      markAllAsRead: async () => {
        await notificationService.markAllAsRead();
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, is_read: true })),
          unreadCount: 0,
        }));
      },
      
      addNotification: (notification: Notification) => {
        set((state) => {
          // Don't add duplicate notifications
          if (state.notifications.some(n => n.id === notification.id)) {
            return state;
          }
          
          const updatedNotifications = [notification, ...state.notifications].slice(0, 100);
          const unreadCount = notification.is_read ? state.unreadCount : state.unreadCount + 1;
          
          return {
            notifications: updatedNotifications,
            unreadCount,
          };
        });
      },
      
      removeNotification: async (id: number) => {
        await notificationService.deleteNotification(id);
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          const updatedNotifications = state.notifications.filter(n => n.id !== id);
          const unreadCount = notification?.is_read 
            ? state.unreadCount 
            : Math.max(0, state.unreadCount - 1);
          
          return {
            notifications: updatedNotifications,
            unreadCount,
          };
        });
      },
      
      clearAll: async () => {
        await notificationService.clearAll();
        set({
          notifications: [],
          unreadCount: 0,
        });
      },
    }),
    {
      name: 'notification-storage',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);