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
  typingUsers: Record<number, TypingStatus>;  // Changed from Map to Record for serialization
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  
  fetchRooms: () => Promise<void>;
  fetchRoom: (roomId: number) => Promise<ChatRoom>;
  fetchMessages: (roomId: number) => Promise<Message[]>;
  loadMoreMessages: (roomId: number) => Promise<void>;
  setActiveRoom: (room: ChatRoom | null) => void;
  addMessage: (message: Message) => void;
  sendMessage: (roomId: number, content: string, attachments?: File[]) => Promise<Message>;
  createDirectRoom: (userId: number) => Promise<ChatRoom>;
  markMessagesAsRead: (roomId: number) => Promise<void>;
  updateTypingStatus: (userId: number, isTyping: boolean, roomId?: number) => void;
  clearChatState: () => void;
  clearError: () => void;
}

// Helper to clean up old typing statuses
const cleanupTypingStatuses = (typingUsers: Record<number, TypingStatus>): Record<number, TypingStatus> => {
  const now = Date.now();
  const cleaned: Record<number, TypingStatus> = {};
  
  Object.entries(typingUsers).forEach(([key, status]) => {
    if (now - status.timestamp <= 5000) {
      cleaned[Number(key)] = status;
    }
  });
  
  return cleaned;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      rooms: [],
      activeRoom: null,
      messages: [],
      typingUsers: {},
      isLoading: false,
      isLoadingMore: false,
      error: null,
      currentPage: 1,
      hasMore: false,
      
      fetchRooms: async () => {
        set({ isLoading: true, error: null });
        try {
          const rooms = await chatService.getRooms();
          set({ rooms, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch rooms';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },
      
      fetchRoom: async (roomId: number) => {
        try {
          const room = await chatService.getRoom(roomId);
          set((state) => ({
            rooms: state.rooms.map(r => r.id === room.id ? room : r),
            error: null,
          }));
          return room;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch room';
          set({ error: errorMessage });
          throw error;
        }
      },
      
      fetchMessages: async (roomId: number) => {
        set({ isLoading: true, error: null, currentPage: 1, hasMore: false });
        try {
          const response = await chatService.getMessages(roomId, { page: 1, page_size: 30 });
          set({ 
            messages: response.results, 
            isLoading: false,
            currentPage: 1,
            hasMore: response.has_more,
          });
          return response.results;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch messages';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },
      
      loadMoreMessages: async (roomId: number) => {
        const { isLoadingMore, hasMore, currentPage, messages } = get();
        if (isLoadingMore || !hasMore) return;
        
        set({ isLoadingMore: true });
        try {
          const nextPage = currentPage + 1;
          const response = await chatService.getMessages(roomId, { page: nextPage, page_size: 30 });
          set({ 
            // Prepend older messages to the beginning
            messages: [...response.results, ...messages], 
            isLoadingMore: false,
            currentPage: nextPage,
            hasMore: response.has_more,
          });
        } catch (error) {
          set({ isLoadingMore: false });
          console.error('Failed to load more messages:', error);
        }
      },
      
      setActiveRoom: (room) => {
        if (room) {
          // Mark room as read when activated (fire and forget)
          chatService.markRoomAsRead(room.id).catch(console.error);
        }
        set({ activeRoom: room, messages: [], error: null });
      },
      
      addMessage: (message: Message) => {
        set((state) => {
          // Check if message already exists (prevent duplicates)
          if (state.messages.some(m => m.id === message.id)) {
            return state;
          }
          
          // Get room ID - handle both number and object formats
          const messageRoomId = typeof message.room === 'number' 
            ? message.room 
            : message.room?.id;
          
          // Update room's last message and unread count
          const updatedRooms = state.rooms.map(room => {
            if (room.id === messageRoomId) {
              return {
                ...room,
                last_message: message,
                unread_count: room.id === state.activeRoom?.id ? 0 : (room.unread_count || 0) + 1,
              };
            }
            return room;
          });
          
          // Only add message to UI if it belongs to active room
          const shouldAddMessage = state.activeRoom?.id === messageRoomId;
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
        try {
          const message = await chatService.sendMessage(roomId, content, attachments);
          get().addMessage(message);
          return message;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
          set({ error: errorMessage });
          throw error;
        }
      },
      
      createDirectRoom: async (userId: number) => {
        try {
          const room = await chatService.createDirectRoom(userId);
          set((state) => ({
            // Avoid duplicates - check if room already exists
            rooms: state.rooms.some(r => r.id === room.id) 
              ? state.rooms 
              : [room, ...state.rooms],
            error: null,
          }));
          return room;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create room';
          set({ error: errorMessage });
          throw error;
        }
      },
      
      markMessagesAsRead: async (roomId: number) => {
        try {
          await chatService.markMessagesAsRead(roomId);
          set((state) => ({
            rooms: state.rooms.map(room =>
              room.id === roomId ? { ...room, unread_count: 0 } : room
            ),
          }));
        } catch (error) {
          // Non-critical error, just log it
          console.error('Failed to mark messages as read:', error);
        }
      },
      
      updateTypingStatus: (userId: number, isTyping: boolean, roomId?: number) => {
        set((state) => {
          // Clean up old typing statuses first
          const cleanedTypingUsers = cleanupTypingStatuses(state.typingUsers);
          
          if (isTyping) {
            cleanedTypingUsers[userId] = {
              userId,
              isTyping,
              roomId: roomId || state.activeRoom?.id || 0,
              roomType: 'direct',
              timestamp: Date.now(),
            };
          } else {
            delete cleanedTypingUsers[userId];
          }
          
          return { typingUsers: cleanedTypingUsers };
        });
      },
      
      clearChatState: () => {
        set({
          rooms: [],
          activeRoom: null,
          messages: [],
          typingUsers: {},
          error: null,
        });
      },
      
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        rooms: state.rooms,
        // Don't persist typingUsers, activeRoom, messages, or isLoading
      }),
    }
  )
);