import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationStore } from '../stores/notification.store';
import { useChatStore } from '../stores/chat.store';
import type { Notification, Message } from '../types';

interface WebSocketMessage {
  type: string;
  data: any;
}

export const useWebSocket = () => {
  const { token } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const { addMessage, updateTypingStatus } = useChatStore();
  const socketRef = useRef<WebSocket | null>(null);
  const notificationSocketRef = useRef<WebSocket | null>(null);

  const connectChat = useCallback(() => {
    if (!token || socketRef.current?.readyState === WebSocket.OPEN) return;

    const baseUrl = (import.meta as any).env?.VITE_WS_URL;
    if (!baseUrl) {
      console.error('WebSocket base URL not configured');
      return;
    }
    const wsUrl = `${baseUrl.replace(/\/$/, '')}/ws/chat/?token=${token}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Chat WebSocket connected');
    };

    socket.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'chat_message':
          addMessage(message.data as Message);
          break;
        case 'typing':
          updateTypingStatus(
            message.data.user.id,
            message.data.is_typing,
            message.data.room_id
          );
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    };

    socket.onclose = () => {
      console.log('Chat WebSocket disconnected');
      setTimeout(connectChat, 3000);
    };

    socket.onerror = (error) => {
      console.error('Chat WebSocket error:', error);
    };

    socketRef.current = socket;
  }, [token, addMessage, updateTypingStatus]);

  const connectNotifications = useCallback(() => {
    if (!token || notificationSocketRef.current?.readyState === WebSocket.OPEN) return;

    const baseUrl = (import.meta as any).env?.VITE_WS_URL;
    if (!baseUrl) {
      console.error('WebSocket base URL not configured');
      return;
    }
    const wsUrl = `${baseUrl.replace(/\/$/, '')}/ws/notifications/?token=${token}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Notification WebSocket connected');
    };

    socket.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      if (message.type === 'notification') {
        addNotification(message.data as Notification);
      }
    };

    socket.onclose = () => {
      console.log('Notification WebSocket disconnected');
      setTimeout(connectNotifications, 3000);
    };

    socket.onerror = (error) => {
      console.error('Notification WebSocket error:', error);
    };

    notificationSocketRef.current = socket;
  }, [token, addNotification]);

  const joinRoom = useCallback((roomType: string, roomId: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'join_room',
        room_type: roomType,
        room_id: roomId
      }));
    }
  }, []);

  const leaveRoom = useCallback((roomType: string, roomId: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'leave_room',
        room_type: roomType,
        room_id: roomId
      }));
    }
  }, []);

  const sendMessage = useCallback((roomType: string, roomId: number, content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'send_message',
        room_type: roomType,
        room_id: roomId,
        message: content
      }));
    }
  }, []);

  const sendTypingIndicator = useCallback((roomType: string, roomId: number, isTyping: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'typing',
        room_type: roomType,
        room_id: roomId,
        is_typing: isTyping
      }));
    }
  }, []);

  useEffect(() => {
    connectChat();
    connectNotifications();

    return () => {
      socketRef.current?.close();
      notificationSocketRef.current?.close();
    };
  }, [connectChat, connectNotifications]);

  return {
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTypingIndicator,
    isChatConnected: socketRef.current?.readyState === WebSocket.OPEN,
    isNotificationsConnected: notificationSocketRef.current?.readyState === WebSocket.OPEN,
  };
};