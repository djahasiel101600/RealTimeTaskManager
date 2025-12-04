import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Send, Paperclip, X, Loader2, MessageSquare, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/stores/auth.store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { MessageAttachment } from '@/types';

interface ChatWindowProps {
  roomId: number;
  roomType: 'direct' | 'task' | 'group';
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, roomType }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Array<{id: string; content: string; timestamp: Date}>>([]);
  const { messages, fetchMessages, sendMessage, typingUsers, isLoading } = useChatStore();
  const { user } = useAuthStore();
  const { joinRoom, leaveRoom, sendMessage: wsSendMessage, sendTypingIndicator, isChatConnected } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load messages when room changes
  useEffect(() => {
    if (roomId) {
      fetchMessages(roomId);
      // Only join if WebSocket is connected
      if (isChatConnected) {
        joinRoom(roomType, roomId);
      }
    }
    
    const currentRoomId = roomId;
    const currentRoomType = roomType;
    
    return () => {
      if (currentRoomId) {
        leaveRoom(currentRoomType, currentRoomId);
      }
      // Clear typing timeouts on cleanup
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = null;
      }
    };
  }, [roomId, roomType, isChatConnected, fetchMessages, joinRoom, leaveRoom]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debounced typing indicator with proper cleanup
  const sendDebouncedTypingIndicator = useCallback((typing: boolean) => {
    if (!isChatConnected) return;
    
    // Clear existing debounce
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    
    // Debounce the typing indicator to reduce WebSocket traffic
    typingDebounceRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        sendTypingIndicator(roomType, roomId, typing);
      }
    }, 100);
  }, [roomType, roomId, sendTypingIndicator, isChatConnected]);

  useEffect(() => {
    // Send typing indicator
    if (isTyping) {
      sendDebouncedTypingIndicator(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsTyping(false);
          sendDebouncedTypingIndicator(false);
        }
      }, 2000);
    }
  }, [isTyping, sendDebouncedTypingIndicator]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() && attachments.length === 0) return;
    if (isSending) return;

    const messageContent = message.trim();
    const messageAttachments = [...attachments];
    const tempId = `pending-${Date.now()}`;
    
    // Reset input immediately for better UX
    setMessage('');
    setAttachments([]);
    setIsTyping(false);
    setSendError(null);
    setIsSending(true);
    
    // Add optimistic message for text-only messages
    if (messageContent && messageAttachments.length === 0) {
      setPendingMessages(prev => [...prev, {
        id: tempId,
        content: messageContent,
        timestamp: new Date()
      }]);
    }
    
    // Stop typing indicator
    sendDebouncedTypingIndicator(false);

    try {
      // If there are attachments, use API (WebSocket doesn't handle binary files well)
      if (messageAttachments.length > 0) {
        await sendMessage(roomId, messageContent, messageAttachments);
      } else if (messageContent) {
        // For text-only messages, use WebSocket for real-time delivery
        if (isChatConnected) {
          wsSendMessage(roomType, roomId, messageContent);
        } else {
          // Fallback to API if WebSocket is disconnected
          await sendMessage(roomId, messageContent, []);
        }
      }
      
      // Remove pending message on success (it will be replaced by the real one)
      setPendingMessages(prev => prev.filter(m => m.id !== tempId));
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError('Failed to send message. Please try again.');
      // Remove pending message on error
      setPendingMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  }, [message, attachments, isSending, roomId, roomType, isChatConnected, sendMessage, wsSendMessage, sendDebouncedTypingIndicator]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Memoize typing users list to avoid recalculation on every render
  // Filter out current user's own typing status
  const typingUsersList = useMemo(() => {
    return Object.values(typingUsers).filter(
      (status) => status.roomId === roomId && status.isTyping && status.userId !== user?.id
    );
  }, [typingUsers, roomId, user?.id]);

  // Combine real messages with pending (optimistic) messages
  const displayMessages = useMemo(() => {
    const pending = pendingMessages.map(pm => ({
      id: pm.id as any,
      content: pm.content,
      sender: user!,
      timestamp: pm.timestamp.toISOString(),
      room: { id: roomId } as any,
      attachments: [],
      is_read: false,
      isPending: true
    }));
    return [...messages, ...pending].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages, pendingMessages, user, roomId]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-linear-to-b from-white to-slate-50/50">
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
              <p className="text-sm text-slate-500">Loading messages...</p>
            </div>
          </div>
        ) : displayMessages.length === 0 && pendingMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-violet-500" />
            </div>
            <p className="font-medium text-slate-700">No messages yet</p>
            <p className="text-sm text-slate-400 mt-1">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayMessages.map((msg: any) => {
              const isOwnMessage = msg.sender.id === user?.id;
              const isPending = msg.isPending;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    isOwnMessage ? "flex-row-reverse" : "",
                    isPending && "opacity-60"
                  )}
                >
                  <Avatar className={cn(
                    "h-8 w-8 shrink-0 ring-2",
                    isOwnMessage ? "ring-violet-200" : "ring-slate-100"
                  )}>
                    <AvatarImage src={msg.sender.avatar} />
                    <AvatarFallback className={cn(
                      "font-medium text-white",
                      isOwnMessage 
                        ? "bg-linear-to-br from-violet-500 to-fuchsia-500" 
                        : "bg-linear-to-br from-slate-400 to-slate-500"
                    )}>
                      {msg.sender.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl p-3 shadow-sm",
                      isOwnMessage
                        ? "bg-linear-to-r from-violet-600 to-fuchsia-600 text-white rounded-tr-md"
                        : "bg-white border border-slate-100 rounded-tl-md"
                    )}
                  >
                    <div className={cn(
                      "flex items-center gap-2 mb-1",
                      isOwnMessage ? "justify-end" : ""
                    )}>
                      <span className={cn(
                        "font-semibold text-sm",
                        isOwnMessage ? "text-white/90" : "text-slate-700"
                      )}>
                        {isOwnMessage ? 'You' : msg.sender.username}
                      </span>
                      <span className={cn(
                        "text-xs",
                        isOwnMessage ? "text-white/60" : "text-slate-400"
                      )}>
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap wrap-break-words">{msg.content}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((attachment: MessageAttachment) => (
                          <div
                            key={attachment.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg",
                              isOwnMessage 
                                ? "bg-white/10" 
                                : "bg-linear-to-r from-slate-50 to-violet-50"
                            )}
                          >
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm truncate">
                              {attachment.file_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {typingUsersList.length > 0 && (
              <div className="flex items-center gap-3 px-2">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-r from-slate-100 to-violet-50 rounded-full">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce" />
                    <div className="h-2 w-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="h-2 w-2 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                  <span className="text-sm text-slate-500 ml-1">
                    {typingUsersList.length === 1
                      ? 'Someone is typing...'
                      : `${typingUsersList.length} people are typing...`}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Connection status warning */}
      {!isChatConnected && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-amber-700">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">Reconnecting to chat...</span>
        </div>
      )}
      
      {/* Error message display */}
      {sendError && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-100 flex items-center justify-between">
          <span className="text-sm text-rose-700">{sendError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSendError(null)}
            className="h-6 text-rose-600 hover:text-rose-800 hover:bg-rose-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="border-t border-slate-200/50 p-4 bg-white/80 backdrop-blur-xl">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-linear-to-r from-violet-50 to-fuchsia-50 border border-violet-100 px-3 py-2 rounded-lg"
              >
                <Paperclip className="h-4 w-4 text-violet-500" />
                <span className="text-sm truncate max-w-[200px] text-slate-700">
                  {file.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-rose-100 hover:text-rose-600"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-500 hover:text-violet-600 hover:bg-violet-50"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <Input
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (!isTyping && e.target.value.trim()) {
                setIsTyping(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={isChatConnected ? "Type a message..." : "Waiting for connection..."}
            className="flex-1 bg-white border-slate-200 focus:border-violet-300 focus:ring-violet-200"
            disabled={isSending}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={(!message.trim() && attachments.length === 0) || isSending}
            size="icon"
            className="bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};