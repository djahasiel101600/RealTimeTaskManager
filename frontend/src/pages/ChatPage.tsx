import React from 'react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Users, Plus, Hash, Lock, UserPlus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Card imports removed (not used in this page)
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatWindow } from '@/components/ChatWindow';
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
  const [_showNewChatModal, setShowNewChatModal] = useState(false);
  
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
        return <Users className="h-4 w-4" />;
      case 'task':
        return <Hash className="h-4 w-4" />;
      case 'group':
        return room.participants?.length > 2 ? <Users className="h-4 w-4" /> : <Lock className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
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
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Messages</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowNewChatModal(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'direct', 'task', 'group'] as ChatView[]).map((viewType) => (
              <Button
                key={viewType}
                variant={view === viewType ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView(viewType)}
                className="capitalize"
              >
                {viewType}
              </Button>
            ))}
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No conversations found
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
                      "w-full justify-start p-3 h-auto mb-1",
                      isActive && "bg-accent"
                    )}
                    onClick={() => setActiveRoom(room)}
                  >
                    <div className="flex items-start w-full gap-3">
                      <div className="relative">
                        {room.room_type === 'direct' && otherUser ? (
                          <Avatar>
                            <AvatarImage src={otherUser.avatar} />
                            <AvatarFallback>
                              {otherUser.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            {getRoomIcon(room)}
                          </div>
                        )}
                        {otherUser?.is_online && (
                          <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">
                            {getRoomName(room)}
                          </p>
                          {room.last_message && (
                            <span className="text-xs text-muted-foreground">
                              {getLastMessageTime(room)}
                            </span>
                          )}
                        </div>
                        
                        {room.last_message ? (
                          <p className="text-sm text-muted-foreground truncate">
                            {room.last_message.sender.id === user?.id ? 'You: ' : ''}
                            {room.last_message.content}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No messages yet</p>
                        )}
                      </div>
                      
                      {room.unread_count > 0 && (
                        <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
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
      <div className="flex-1 flex flex-col">
        {activeRoom ? (
          <>
            {/* Chat header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                      {activeRoom.room_type === 'direct' && activeRoom.participants ? (
                    <>
                      <Avatar>
                        {activeRoom.participants
                          .filter((p: any) => p.id !== user?.id)[0]
                          ?.avatar && (
                          <AvatarImage 
                            src={activeRoom.participants
                              .filter((p: any) => p.id !== user?.id)[0]
                              ?.avatar} 
                          />
                        )}
                        <AvatarFallback>
                          {activeRoom.participants
                            .filter((p: any) => p.id !== user?.id)[0]
                            ?.username?.charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          {getRoomName(activeRoom)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {activeRoom.room_type === 'direct' &&
                            activeRoom.participants?.find((p: any) => p.id !== user?.id)?.is_online
                            ? 'Online'
                            : 'Offline'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        {getRoomIcon(activeRoom)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{getRoomName(activeRoom)}</h3>
                        <p className="text-sm text-muted-foreground capitalize">
                          {activeRoom.room_type} chat
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {activeRoom.room_type === 'group' && (
                    <Button variant="ghost" size="icon">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon">
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
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No conversation selected</h3>
            <p className="text-muted-foreground text-center mb-6">
              Select a conversation from the sidebar or start a new one
            </p>
            <Button onClick={() => setShowNewChatModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Start New Conversation
            </Button>
          </div>
        )}
      </div>
    </div>
    
  );
};