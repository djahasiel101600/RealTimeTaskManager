import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatRoom, Message } from '../types';
import { chatService } from '@/services/api';

interface TypingStatus {
  userId: number;
  isTyping: boolean;
  roomId: number;
  roomType: string;
  timestamp: number;
}

interface ChatState {
  rooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: Message[];
  typingUsers: Map<number, TypingStatus>;
  isLoading: boolean;
  
  fetchRooms: () => Promise<void>;
  fetchRoom: (roomId: number) => Promise<ChatRoom>;
  fetchMessages: (roomId: number) => Promise<Message[]>;
  setActiveRoom: (room: ChatRoom | null) => void;
  addMessage: (message: Message) => void;
  sendMessage: (roomId: number, content: string, attachments?: File[]) => Promise<Message>;
  createDirectRoom: (userId: number) => Promise<ChatRoom>;
  markMessagesAsRead: (roomId: number) => Promise<void>;
  updateTypingStatus: (userId: number, isTyping: boolean, roomId?: number) => void;
  clearChatState: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      rooms: [],
      activeRoom: null,
      messages: [],
      typingUsers: new Map(),
      isLoading: false,
      
      fetchRooms: async () => {
        set({ isLoading: true });
        try {
          const rooms = await chatService.getRooms();
          set({ rooms, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      fetchRoom: async (roomId: number) => {
        const room = await chatService.getRoom(roomId);
        set((state) => ({
          rooms: state.rooms.map(r => r.id === room.id ? room : r),
        }));
        return room;
      },
      
      fetchMessages: async (roomId: number) => {
        set({ isLoading: true });
        try {
          const messages = await chatService.getMessages(roomId);
          set({ messages, isLoading: false });
          return messages;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      setActiveRoom: (room) => {
        if (room) {
          // Mark room as read when activated
          chatService.markRoomAsRead(room.id).catch(console.error);
        }
        set({ activeRoom: room, messages: [] });
      },
      
      addMessage: (message: Message) => {
        set((state) => {
          // Check if message already exists
          if (state.messages.some(m => m.id === message.id)) {
            return state;
          }
          
          // Update room's last message
          const updatedRooms = state.rooms.map(room => {
            if (room.id === message.room.id) {
              return {
                ...room,
                last_message: message,
                unread_count: room.id === state.activeRoom?.id ? 0 : room.unread_count + 1,
              };
            }
            return room;
          });
          
          // Only add message if it belongs to active room
          const shouldAddMessage = state.activeRoom?.id === message.room.id;
          const updatedMessages = shouldAddMessage
            ? [...state.messages, message].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
            : state.messages;
          
          return {
            rooms: updatedRooms,
            messages: updatedMessages,
          };
        });
      },
      
      sendMessage: async (roomId: number, content: string, attachments: File[] = []) => {
        const message = await chatService.sendMessage(roomId, content, attachments);
        get().addMessage(message);
        return message;
      },
      
      createDirectRoom: async (userId: number) => {
        const room = await chatService.createDirectRoom(userId);
        set((state) => ({
          rooms: [room, ...state.rooms],
        }));
        return room;
      },
      
      markMessagesAsRead: async (roomId: number) => {
        await chatService.markMessagesAsRead(roomId);
        set((state) => ({
          rooms: state.rooms.map(room =>
            room.id === roomId ? { ...room, unread_count: 0 } : room
          ),
        }));
      },
      
      updateTypingStatus: (userId: number, isTyping: boolean, roomId?: number) => {
        set((state) => {
          const newTypingUsers = new Map(state.typingUsers);
          
          if (isTyping) {
            newTypingUsers.set(userId, {
              userId,
              isTyping,
              roomId: roomId || state.activeRoom?.id || 0,
              roomType: 'direct',
              timestamp: Date.now(),
            });
          } else {
            newTypingUsers.delete(userId);
          }
          
          // Clean up old typing statuses (older than 5 seconds)
          const now = Date.now();
          newTypingUsers.forEach((status, key) => {
            if (now - status.timestamp > 5000) {
              newTypingUsers.delete(key);
            }
          });
          
          return { typingUsers: newTypingUsers };
        });
      },
      
      clearChatState: () => {
        set({
          rooms: [],
          activeRoom: null,
          messages: [],
          typingUsers: new Map(),
        });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        rooms: state.rooms,
      }),
    }
  )
);