import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationStore } from '../stores/notification.store';
import { useChatStore } from '../stores/chat.store';
import type { Message, Notification } from '../types';

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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationReconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatStatus, setChatStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [notificationStatus, setNotificationStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const getWsBaseUrl = useCallback(() => {
    // Try to get from environment, fallback to constructing from current location
    const envUrl = (import.meta as any).env?.VITE_WS_URL;
    if (envUrl && envUrl !== 'undefined') {
      return envUrl.replace(/\/$/, '');
    }
    // Fallback: construct from window.location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }, []);

  const connectChat = useCallback(() => {
    if (!token) {
      console.log('No token, skipping WebSocket connection');
      return;
    }
    
    // Don't create new connection if one is already open or connecting
    if (socketRef.current?.readyState === WebSocket.OPEN || 
        socketRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const baseUrl = getWsBaseUrl();
    const wsUrl = `${baseUrl}/ws/chat/?token=${token}`;
    console.log('Connecting to Chat WebSocket:', wsUrl);
    
    setChatStatus('connecting');
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Chat WebSocket connected');
      setChatStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'chat_message':
            // Transform WebSocket message to match Message type
            // Backend sends room_id/room_type, but frontend expects room: { id }
            const wsMessage = message.data;
            const transformedMessage: Message = {
              id: wsMessage.id,
              content: wsMessage.content,
              sender: wsMessage.sender,
              timestamp: wsMessage.timestamp,
              room: { id: wsMessage.room_id, room_type: wsMessage.room_type } as any,
              attachments: wsMessage.attachments || [],
              is_read: false,
            };
            addMessage(transformedMessage);
            break;
          case 'typing':
            updateTypingStatus(
              message.data.user.id,
              message.data.is_typing,
              message.data.room_id
            );
            break;
          case 'error':
            // Handle error messages from the backend
            console.error('Chat WebSocket error from server:', message.data?.message || message.data);
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    socket.onclose = (event) => {
      console.log('Chat WebSocket disconnected', event.code, event.reason);
      setChatStatus('disconnected');
      socketRef.current = null;
      
      // Reconnect after delay if we have a token
      if (token) {
        reconnectTimeoutRef.current = setTimeout(connectChat, 3000);
      }
    };

    socket.onerror = (error) => {
      console.error('Chat WebSocket error:', error);
    };

    socketRef.current = socket;
  }, [token, getWsBaseUrl, addMessage, updateTypingStatus]);

  const connectNotifications = useCallback(() => {
    if (!token) {
      console.log('No token, skipping Notification WebSocket connection');
      return;
    }
    
    // Don't create new connection if one is already open or connecting
    if (notificationSocketRef.current?.readyState === WebSocket.OPEN || 
        notificationSocketRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Clear any pending reconnect
    if (notificationReconnectTimeoutRef.current) {
      clearTimeout(notificationReconnectTimeoutRef.current);
      notificationReconnectTimeoutRef.current = null;
    }

    const baseUrl = getWsBaseUrl();
    const wsUrl = `${baseUrl}/ws/notifications/?token=${token}`;
    console.log('Connecting to Notification WebSocket:', wsUrl);
    
    setNotificationStatus('connecting');
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Notification WebSocket connected');
      setNotificationStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'notification') {
          addNotification(message.data as Notification);
        }
      } catch (e) {
        console.error('Failed to parse notification message:', e);
      }
    };

    socket.onclose = (event) => {
      console.log('Notification WebSocket disconnected', event.code, event.reason);
      setNotificationStatus('disconnected');
      notificationSocketRef.current = null;
      
      // Reconnect after delay if we have a token
      if (token) {
        notificationReconnectTimeoutRef.current = setTimeout(connectNotifications, 3000);
      }
    };

    socket.onerror = (error) => {
      console.error('Notification WebSocket error:', error);
    };

    notificationSocketRef.current = socket;
  }, [token, getWsBaseUrl, addNotification]);

  // Connect when token is available
  useEffect(() => {
    if (token) {
      connectChat();
      connectNotifications();
    }

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (notificationReconnectTimeoutRef.current) {
        clearTimeout(notificationReconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (notificationSocketRef.current) {
        notificationSocketRef.current.close();
        notificationSocketRef.current = null;
      }
    };
  }, [token]); // Only depend on token, not on the connect functions

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

  return {
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTypingIndicator,
    chatStatus,
    notificationStatus,
    isChatConnected: chatStatus === 'connected',
    isNotificationsConnected: notificationStatus === 'connected',
  };
};