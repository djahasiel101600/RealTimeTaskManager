import React from 'react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Users, Plus, Hash, Lock, UserPlus, MoreVertical, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Card imports removed (not used in this page)
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatWindow } from '@/components/ChatWindow';
import { CreateChatDialog } from '@/components/CreateChatDialog';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';

type ChatView = 'all' | 'direct' | 'group' | 'task';

export const ChatPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { rooms, activeRoom, fetchRooms, setActiveRoom, isLoading } = useChatStore();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<ChatView>('all');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  
  const filteredRooms = rooms.filter(room => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (room.room_type === 'direct' && room.participants) {
        const otherUser = room.participants.find(p => p.id !== user?.id);
        return otherUser?.username.toLowerCase().includes(searchLower) ||
               otherUser?.email.toLowerCase().includes(searchLower);
      }
      if (room.task) {
        return room.task.title.toLowerCase().includes(searchLower);
      }
      return room.name?.toLowerCase().includes(searchLower);
    }
    
    if (view === 'all') return true;
    return room.room_type === view;
  });
  
  useEffect(() => {
    fetchRooms();
  }, []);
  
  useEffect(() => {
    if (roomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === parseInt(roomId));
      if (room) {
        setActiveRoom(room);
      }
    }
  }, [roomId, rooms]);
  
  const getRoomName = (room: any) => {
    if (room.room_type === 'direct' && room.participants) {
      const otherUser = room.participants.find((p: any) => p.id !== user?.id);
      return otherUser?.username || 'Unknown User';
    }
    if (room.room_type === 'task' && room.task) {
      return `# ${room.task.title}`;
    }
    return room.name || `${room.room_type} chat`;
  };
  
  const getRoomIcon = (room: any) => {
    switch (room.room_type) {
      case 'direct':
        return <Users className="h-4 w-4 text-violet-600" />;
      case 'task':
        return <Hash className="h-4 w-4 text-fuchsia-600" />;
      case 'group':
        return room.participants?.length > 2 ? <Users className="h-4 w-4 text-blue-600" /> : <Lock className="h-4 w-4 text-amber-600" />;
      default:
        return <Hash className="h-4 w-4 text-slate-500" />;
    }
  };
  
  const getLastMessageTime = (room: any) => {
    if (!room.last_message) return '';
    const date = new Date(room.last_message.timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm');
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return format(date, 'EEE');
    } else {
      return format(date, 'dd/MM');
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-gradient-to-br from-slate-50 via-violet-50/20 to-fuchsia-50/10 rounded-xl overflow-hidden border border-slate-200/50 shadow-xl shadow-slate-200/50">
      {/* Sidebar */}
      <div className="w-80 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 flex flex-col">
        <div className="p-4 border-b border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Messages</h2>
            </div>
            <Button
              size="icon"
              onClick={() => setShowNewChatModal(true)}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search conversations..."
              className="pl-10 bg-white/50 border-slate-200 focus:border-violet-300 focus:ring-violet-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-1 p-1 bg-slate-100/80 rounded-lg">
            {(['all', 'direct', 'task', 'group'] as ChatView[]).map((viewType) => (
              <Button
                key={viewType}
                variant={view === viewType ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView(viewType)}
                className={cn(
                  "capitalize flex-1 text-xs",
                  view === viewType 
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md" 
                    : "hover:bg-white/80 text-slate-600"
                )}
              >
                {viewType}
              </Button>
            ))}
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-600 border-t-transparent"></div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No conversations found</p>
              <p className="text-sm text-slate-400 mt-1">Start a new conversation</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredRooms.map((room) => {
                const isActive = activeRoom?.id === room.id;
                const otherUser = room.room_type === 'direct'
                  ? room.participants?.find(p => p.id !== user?.id)
                  : undefined;
                
                return (
                  <Button
                    key={room.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start p-3 h-auto mb-1 rounded-xl transition-all duration-200",
                      isActive 
                        ? "bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-200/50 shadow-sm" 
                        : "hover:bg-gradient-to-r hover:from-slate-50 hover:to-violet-50/50"
                    )}
                    onClick={() => setActiveRoom(room)}
                  >
                    <div className="flex items-start w-full gap-3">
                      <div className="relative">
                        {room.room_type === 'direct' && otherUser ? (
                          <Avatar className="ring-2 ring-violet-100">
                            <AvatarImage src={otherUser.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                              {otherUser.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                            {getRoomIcon(room)}
                          </div>
                        )}
                        {otherUser?.is_online && (
                          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-white shadow-sm" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <p className={cn(
                            "font-medium truncate",
                            isActive ? "text-violet-900" : "text-slate-700"
                          )}>
                            {getRoomName(room)}
                          </p>
                          {room.last_message && (
                            <span className="text-xs text-slate-400">
                              {getLastMessageTime(room)}
                            </span>
                          )}
                        </div>
                        
                        {room.last_message ? (
                          <p className="text-sm text-slate-500 truncate">
                            {room.last_message.sender.id === user?.id ? 'You: ' : ''}
                            {room.last_message.content}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No messages yet</p>
                        )}
                      </div>
                      
                      {room.unread_count > 0 && (
                        <Badge className="ml-2 h-5 min-w-5 p-0 flex items-center justify-center bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 text-xs">
                          {room.unread_count}
                        </Badge>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white/50">
        {activeRoom ? (
          <>
            {/* Chat header */}
            <div className="border-b border-slate-200/50 p-4 bg-white/80 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                      {activeRoom.room_type === 'direct' && activeRoom.participants ? (
                    <>
                      <Avatar className="ring-2 ring-violet-100">
                        {activeRoom.participants
                          .filter((p: any) => p.id !== user?.id)[0]
                          ?.avatar && (
                          <AvatarImage 
                            src={activeRoom.participants
                              .filter((p: any) => p.id !== user?.id)[0]
                              ?.avatar} 
                          />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                          {activeRoom.participants
                            .filter((p: any) => p.id !== user?.id)[0]
                            ?.username?.charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {getRoomName(activeRoom)}
                        </h3>
                        <p className={cn(
                          "text-sm flex items-center gap-1.5",
                          activeRoom.room_type === 'direct' &&
                            activeRoom.participants?.find((p: any) => p.id !== user?.id)?.is_online
                            ? "text-emerald-600"
                            : "text-slate-400"
                        )}>
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            activeRoom.room_type === 'direct' &&
                              activeRoom.participants?.find((p: any) => p.id !== user?.id)?.is_online
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          )} />
                          {activeRoom.room_type === 'direct' &&
                            activeRoom.participants?.find((p: any) => p.id !== user?.id)?.is_online
                            ? 'Online'
                            : 'Offline'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                        {getRoomIcon(activeRoom)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{getRoomName(activeRoom)}</h3>
                        <p className="text-sm text-slate-500 capitalize">
                          {activeRoom.room_type} chat
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {activeRoom.room_type === 'group' && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="hover:bg-violet-50 hover:text-violet-700"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="hover:bg-violet-50 hover:text-violet-700"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Chat messages */}
            <div className="flex-1">
              <ChatWindow 
                roomId={activeRoom.id}
                roomType={activeRoom.room_type}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="relative mb-6">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-violet-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No conversation selected</h3>
            <p className="text-slate-500 text-center mb-6 max-w-sm">
              Select a conversation from the sidebar or start a new one to begin chatting
            </p>
            <Button 
              onClick={() => setShowNewChatModal(true)}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25"
            >
              <Plus className="mr-2 h-4 w-4" />
              Start New Conversation
            </Button>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <CreateChatDialog 
        open={showNewChatModal} 
        onOpenChange={setShowNewChatModal} 
      />
    </div>
  );
};