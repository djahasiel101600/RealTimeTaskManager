import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/stores/auth.store';
import { format } from 'date-fns';

interface ChatWindowProps {
  roomId: number;
  roomType: 'direct' | 'task' | 'group';
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, roomType }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const { messages, sendMessage, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const { sendMessage: wsSendMessage, sendTypingIndicator } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<number>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Send typing indicator
    if (isTyping) {
      sendTypingIndicator(roomType, roomId, true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendTypingIndicator(roomType, roomId, false);
      }, 2000);
    }
  }, [isTyping, roomType, roomId, sendTypingIndicator]);

  const handleSendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;

    try {
      if (message.trim()) {
        // Send via WebSocket for real-time
        wsSendMessage(roomType, roomId, message);
      }

      // Also send via API for persistence
      if (attachments.length > 0 || message.trim()) {
        await sendMessage(roomId, message, attachments);
      }

      setMessage('');
      setAttachments([]);
      setIsTyping(false);
      sendTypingIndicator(roomType, roomId, false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getTypingUsers = () => {
    const typingInRoom = Array.from(typingUsers.values()).filter(
      (status) => status.roomId === roomId && status.isTyping
    );
    return typingInRoom;
  };

  const typingUsersList = getTypingUsers();

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.sender.id === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.sender.avatar} />
                <AvatarFallback>
                  {msg.sender.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  msg.sender.id === user?.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">
                    {msg.sender.username}
                  </span>
                  <span className="text-xs opacity-70">
                    {format(new Date(msg.timestamp), 'HH:mm')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 p-2 bg-background/50 rounded"
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
          ))}
          {typingUsersList.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <div className="h-2 w-2 bg-current rounded-full animate-bounce" />
                <div className="h-2 w-2 bg-current rounded-full animate-bounce delay-150" />
                <div className="h-2 w-2 bg-current rounded-full animate-bounce delay-300" />
              </div>
              <span>
                {typingUsersList.length === 1
                  ? `${typingUsersList[0].userId} is typing...`
                  : `${typingUsersList.length} people are typing...`}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md"
              >
                <Paperclip className="h-4 w-4" />
                <span className="text-sm truncate max-w-[200px]">
                  {file.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
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
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={!message.trim() && attachments.length === 0}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};