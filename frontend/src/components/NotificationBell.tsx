import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Loader2, BellOff, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationStore } from '@/stores/notification.store';
import { formatDistanceToNow, isValid } from 'date-fns';
import type { Notification } from '@/types';

// Helper to safely format dates
const formatTimeAgo = (dateString: string | undefined | null): string => {
  if (!dateString) return 'Just now';
  
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return 'Just now';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Just now';
  }
};

const NotificationIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    task_assigned: '📋',
    task_updated: '✏️',
    due_date: '⏰',
    chat_message: '💬',
    file_attached: '📎',
    status_change: '🔄',
    task_completed: '✅',
    mention: '👋',
  };
  return <span className="text-xl">{icons[type] || '🔔'}</span>;
};

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    isLoading,
    fetchNotifications,
    markAsRead, 
    markAllAsRead, 
    removeNotification 
  } = useNotificationStore();

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications().catch(console.error);
  }, []);

  // Refresh notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications().catch(console.error);
    }
  }, [isOpen]);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications().catch(console.error);
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }
      
      // Navigate to relevant page based on notification type/data
      if (notification.data?.task_id) {
        navigate(`/tasks/${notification.data.task_id}`);
      } else if (notification.data?.chat_room_id) {
        navigate(`/chat/${notification.data.chat_room_id}`);
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to handle notification click:', error);
    }
  };

  const handleRemove = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    try {
      await removeNotification(notificationId);
    } catch (error) {
      console.error('Failed to remove notification:', error);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-violet-50 rounded-xl">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[10px] font-bold text-white shadow-lg shadow-violet-500/30 animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 border-violet-100 shadow-xl shadow-violet-500/10" align="end">
        <div className="flex items-center justify-between p-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-xs font-medium">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-100"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse" />
                <Loader2 className="h-10 w-10 animate-spin text-violet-500 relative" />
              </div>
              <p className="text-sm text-slate-500 mt-4">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="p-5 bg-gradient-to-br from-violet-100 to-fuchsia-100 rounded-2xl mb-4">
                <BellOff className="h-10 w-10 text-violet-500" />
              </div>
              <p className="font-semibold text-slate-800 mb-1">All caught up!</p>
              <p className="text-sm text-slate-500 text-center">
                You don't have any notifications right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-violet-50">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group p-4 hover:bg-violet-50/50 cursor-pointer transition-all duration-200 ${
                    !notification.is_read ? 'bg-violet-50/30 border-l-3 border-l-violet-500' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 p-1.5 bg-violet-100 rounded-lg">
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'} line-clamp-1`}>
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 transition-all"
                          onClick={(e) => handleRemove(e, notification.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <div className="h-2 w-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-3 border-t border-violet-100 bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-sm text-violet-600 hover:text-violet-700 hover:bg-violet-100"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};