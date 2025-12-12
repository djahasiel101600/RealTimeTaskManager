import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationStore } from '../stores/notification.store';
import { useChatStore } from '../stores/chat.store';
import type { Message, Notification } from '../types';
import { getWsSubprotocolToken } from '../services/api';

interface WebSocketMessage {
  type: string;
  data: any;
}

// Shared module-level sockets/references so multiple hook instances don't create
// duplicate connections. We maintain a reference count to only close when no
// components are using the hook anymore.
let moduleChatSocket: WebSocket | null = null;
let moduleNotificationSocket: WebSocket | null = null;
let moduleChatRefCount = 0;
let moduleNotificationRefCount = 0;

export const useWebSocket = () => {
  const { isAuthenticated } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const { addMessage, updateTypingStatus } = useChatStore();
  const socketRef = useRef<WebSocket | null>(null);
  const notificationSocketRef = useRef<WebSocket | null>(null);
  const chatReconnectAttemptsRef = useRef<number>(0);
  const notificationReconnectAttemptsRef = useRef<number>(0);
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
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping WebSocket connection');
      return;
    }
    
    // Don't create if a module-level socket already exists and is open/connecting
    if ((moduleChatSocket && (moduleChatSocket.readyState === WebSocket.OPEN || moduleChatSocket.readyState === WebSocket.CONNECTING)) ||
        (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING)) {
      // If a module-level socket exists, bind it to this hook's ref
      if (moduleChatSocket) {
        socketRef.current = moduleChatSocket;
      }
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const baseUrl = getWsBaseUrl();
    let wsUrl = `${baseUrl}/ws/chat/`;
    const useSubprotocol = (import.meta as any).env?.VITE_WS_USE_SUBPROTOCOL === 'true';
    let wsToken = useSubprotocol ? getWsSubprotocolToken() : null;
    const isValidJwt = (t: string | null | undefined) => {
      if (!t || typeof t !== 'string') return false;
      const parts = t.split('.');
      return parts.length === 3 && parts.every(Boolean);
    };
    if (!isValidJwt(wsToken as string)) {
      wsToken = null;
    }
    console.log('Connecting to Chat WebSocket', wsUrl, '(cookies)');
    
    setChatStatus('connecting');
    // Use cookie-based authentication for WebSocket; do not pass the token as a subprotocol
    const socketId = Math.random().toString(36).slice(2, 9);
    // If a subprotocol token isn't being used, optionally append the token as a query param
    const allowQueryToken = (import.meta as any).env?.VITE_WS_ALLOW_QUERY_TOKEN === 'true';
    const fallbackToken = getWsSubprotocolToken();
    if (!wsToken && allowQueryToken && isValidJwt(fallbackToken)) {
      const token = encodeURIComponent(fallbackToken as string);
      wsUrl = `${wsUrl}?token=${token}`;
    }
    const socket = wsToken ? new WebSocket(wsUrl, [wsToken]) : new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`Chat WebSocket connected [${socketId}]`);
      setChatStatus('connected');
      // reset reconnect attempts on success
      chatReconnectAttemptsRef.current = 0;
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
              is_system: !!wsMessage.is_system,
            };
            addMessage(transformedMessage);
            break;
          case 'system_message':
            // System-level messages (from backend) follow same payload but may be flagged
            const sys = message.data;
            const transformedSys: Message = {
              id: sys.id,
              content: sys.content,
              sender: sys.sender || { id: 0, username: 'System', email: '', role: 'clerk', is_online: false } as any,
              timestamp: sys.timestamp,
              room: { id: sys.room_id, room_type: sys.room_type } as any,
              attachments: sys.attachments || [],
              is_read: false,
              is_system: true,
            };
            addMessage(transformedSys);
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
      console.log(`Chat WebSocket disconnected [${socketId}]`, event.code, event.reason, 'wasClean=', event.wasClean);
      setChatStatus('disconnected');
      socketRef.current = null;
      
      // Reconnect with exponential backoff if still authenticated
      if (isAuthenticated) {
        chatReconnectAttemptsRef.current += 1;
        const attempt = chatReconnectAttemptsRef.current;
        const jitter = Math.floor(Math.random() * 300);
        const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 6))) + jitter;
        reconnectTimeoutRef.current = setTimeout(connectChat, delay);
        console.info(`Chat WS reconnect attempt ${attempt} scheduled in ${delay}ms`);
      }
    };

    socket.onerror = (error) => {
      console.error(`Chat WebSocket error [${socketId}]:`, error);
    };

    // Store on both module and local refs, and increase module ref count
    moduleChatSocket = socket;
    socketRef.current = socket;
    moduleChatRefCount += 1;
  }, [isAuthenticated, getWsBaseUrl, addMessage, updateTypingStatus]);

  const connectNotifications = useCallback(() => {
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping Notification WebSocket connection');
      return;
    }
    
    // Don't create if a module-level socket already exists and is open/connecting
    if ((moduleNotificationSocket && (moduleNotificationSocket.readyState === WebSocket.OPEN || moduleNotificationSocket.readyState === WebSocket.CONNECTING)) ||
        (notificationSocketRef.current?.readyState === WebSocket.OPEN || notificationSocketRef.current?.readyState === WebSocket.CONNECTING)) {
      if (moduleNotificationSocket) {
        notificationSocketRef.current = moduleNotificationSocket;
      }
      return;
    }

    // Clear any pending reconnect
    if (notificationReconnectTimeoutRef.current) {
      clearTimeout(notificationReconnectTimeoutRef.current);
      notificationReconnectTimeoutRef.current = null;
    }

    const baseUrl = getWsBaseUrl();
    let wsUrl = `${baseUrl}/ws/notifications/`;
    const useSubprotocol = (import.meta as any).env?.VITE_WS_USE_SUBPROTOCOL === 'true';
    let wsToken = useSubprotocol ? getWsSubprotocolToken() : null;
    const isValidJwt = (t: string | null | undefined) => {
      if (!t || typeof t !== 'string') return false;
      const parts = t.split('.');
      return parts.length === 3 && parts.every(Boolean);
    };
    if (!isValidJwt(wsToken as string)) {
      wsToken = null;
    }
    console.log('Connecting to Notification WebSocket', wsUrl, '(cookies)', useSubprotocol ? '(subprotocol fallback enabled)' : '');
    
    setNotificationStatus('connecting');
    // Use cookie-based authentication for notification socket handshake
    const socketId = Math.random().toString(36).slice(2, 9);
    const allowQueryToken = (import.meta as any).env?.VITE_WS_ALLOW_QUERY_TOKEN === 'true';
    const fallbackToken = getWsSubprotocolToken();
    if (!wsToken && allowQueryToken && isValidJwt(fallbackToken)) {
      const token = encodeURIComponent(fallbackToken as string);
      wsUrl = `${wsUrl}?token=${token}`;
    }
    const socket = wsToken ? new WebSocket(wsUrl, [wsToken]) : new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`Notification WebSocket connected [${socketId}]`);
      setNotificationStatus('connected');
      // reset reconnect attempts on success
      notificationReconnectAttemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        // Support both 'notification' and legacy 'send_notification' envelopes
        const msgType = message.type || (message.data && message.data.type) || '';

        if (msgType === 'notification' || msgType === 'send_notification') {
          // Backend sends notification payload under `data`
          addNotification(message.data as Notification);
          return;
        }

        // Unknown message types are ignored here (chat socket handles chat-specific types)
      } catch (e) {
        console.error('Failed to parse notification message:', e);
      }
    };

    socket.onclose = (event) => {
      console.log(`Notification WebSocket disconnected [${socketId}]`, event.code, event.reason, 'wasClean=', event.wasClean);
      setNotificationStatus('disconnected');
      notificationSocketRef.current = null;
      
      // Reconnect with exponential backoff if still authenticated
      if (isAuthenticated) {
        notificationReconnectAttemptsRef.current += 1;
        const attempt = notificationReconnectAttemptsRef.current;
        const jitter = Math.floor(Math.random() * 300);
        const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 6))) + jitter;
        notificationReconnectTimeoutRef.current = setTimeout(connectNotifications, delay);
        console.info(`Notification WS reconnect attempt ${attempt} scheduled in ${delay}ms`);
      }
    };

    socket.onerror = (error) => {
      console.error(`Notification WebSocket error [${socketId}]:`, error);
    };

    // Store on both module and local refs, and increase module ref count
    moduleNotificationSocket = socket;
    notificationSocketRef.current = socket;
    moduleNotificationRefCount += 1;
  }, [isAuthenticated, getWsBaseUrl, addNotification]);

  // Connect when authentication state is available
  useEffect(() => {
    if (isAuthenticated) {
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
        try {
          moduleChatRefCount = Math.max(0, moduleChatRefCount - 1);
        } catch (e) {}
        // Only close the module-level socket when no refs remain
        if (moduleChatRefCount === 0 && moduleChatSocket) {
          moduleChatSocket.close();
          moduleChatSocket = null;
        }
        socketRef.current = null;
      }
      if (notificationSocketRef.current) {
        try {
          moduleNotificationRefCount = Math.max(0, moduleNotificationRefCount - 1);
        } catch (e) {}
        if (moduleNotificationRefCount === 0 && moduleNotificationSocket) {
          moduleNotificationSocket.close();
          moduleNotificationSocket = null;
        }
        notificationSocketRef.current = null;
      }
    };
  }, [isAuthenticated]); // Only depend on authentication state, not on the connect functions

  const joinRoom = useCallback((roomType: string, roomId: number) => {
    const sock = socketRef.current || moduleChatSocket;
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({
        type: 'join_room',
        room_type: roomType,
        room_id: roomId
      }));
    }
  }, []);

  const leaveRoom = useCallback((roomType: string, roomId: number) => {
    const sock = socketRef.current || moduleChatSocket;
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({
        type: 'leave_room',
        room_type: roomType,
        room_id: roomId
      }));
    }
  }, []);

  const sendMessage = useCallback((roomType: string, roomId: number, content: string) => {
    const sock = socketRef.current || moduleChatSocket;
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({
        type: 'send_message',
        room_type: roomType,
        room_id: roomId,
        message: content
      }));
    }
  }, []);

  const sendTypingIndicator = useCallback((roomType: string, roomId: number, isTyping: boolean) => {
    const sock = socketRef.current || moduleChatSocket;
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({
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