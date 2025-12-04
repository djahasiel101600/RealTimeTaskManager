import React, { useState, useEffect } from 'react';
import { Search, Users, Hash, MessageSquare, Loader2, User as UserIcon, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { userService, taskService } from '@/services/api';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { User, Task } from '@/types';

interface CreateChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateChatDialog: React.FC<CreateChatDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { user: currentUser } = useAuthStore();
  const { createDirectRoom, setActiveRoom, rooms } = useChatStore();
  
  const [activeTab, setActiveTab] = useState<'direct' | 'task'>('direct');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Fetch users and tasks when dialog opens
  useEffect(() => {
    if (open) {
      fetchData();
    } else {
      // Reset state when dialog closes
      setSearchTerm('');
      setSelectedUserId(null);
      setSelectedTaskId(null);
      setActiveTab('direct');
    }
  }, [open]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersData, tasksData] = await Promise.all([
        userService.getUsers(),
        taskService.getAll(),
      ]);
      // Filter out current user from users list
      setUsers(usersData.filter(u => u.id !== currentUser?.id));
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower)
    );
  });

  // Filter tasks based on search
  const filteredTasks = tasks.filter(task => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return task.title?.toLowerCase().includes(searchLower);
  });

  // Check if a direct chat with user already exists
  const hasExistingDirectChat = (userId: number) => {
    return rooms.some(room => 
      room.room_type === 'direct' && 
      room.participants?.some(p => p.id === userId)
    );
  };

  // Check if a task chat already exists
  const hasExistingTaskChat = (taskId: number) => {
    return rooms.some(room => 
      room.room_type === 'task' && 
      room.task?.id === taskId
    );
  };

  // Get existing room for a user
  const getExistingDirectRoom = (userId: number) => {
    return rooms.find(room => 
      room.room_type === 'direct' && 
      room.participants?.some(p => p.id === userId)
    );
  };

  // Get existing room for a task
  const getExistingTaskRoom = (taskId: number) => {
    return rooms.find(room => 
      room.room_type === 'task' && 
      room.task?.id === taskId
    );
  };

  // Handle creating or opening a direct chat
  const handleSelectUser = async (userId: number) => {
    setSelectedUserId(userId);
    setIsCreating(true);
    
    try {
      // Check if chat already exists
      const existingRoom = getExistingDirectRoom(userId);
      if (existingRoom) {
        setActiveRoom(existingRoom);
      } else {
        // Create new direct room
        const newRoom = await createDirectRoom(userId);
        setActiveRoom(newRoom);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create/open chat:', error);
      alert('Failed to start conversation');
    } finally {
      setIsCreating(false);
      setSelectedUserId(null);
    }
  };

  // Handle creating or opening a task chat
  const handleSelectTask = async (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsCreating(true);
    
    try {
      // Check if chat already exists
      const existingRoom = getExistingTaskRoom(taskId);
      if (existingRoom) {
        setActiveRoom(existingRoom);
      } else {
        // Create new task room using chat service
        const { chatService } = await import('@/services/api');
        const newRoom = await chatService.createTaskRoom(taskId);
        // Add to rooms list
        useChatStore.setState((state) => ({
          rooms: [newRoom, ...state.rooms],
        }));
        setActiveRoom(newRoom);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create/open task chat:', error);
      alert('Failed to start task conversation');
    } finally {
      setIsCreating(false);
      setSelectedTaskId(null);
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.username;
  };

  const getInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.username?.[0]?.toUpperCase() || '?';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'from-rose-500 to-red-500';
      case 'high': return 'from-orange-500 to-amber-500';
      case 'normal': return 'from-blue-500 to-indigo-500';
      case 'low': return 'from-slate-400 to-slate-500';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-linear-to-r from-violet-50 to-fuchsia-50 border-b border-violet-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold bg-linear-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                New Conversation
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5">
                Start a direct message or task discussion
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v:any) => setActiveTab(v as 'direct' | 'task')}>
            <TabsList className="w-full bg-slate-100/80 p-1 mb-4">
              <TabsTrigger 
                value="direct" 
                className="flex-1 data-[state=active]:bg-linear-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Direct Message
              </TabsTrigger>
              <TabsTrigger 
                value="task"
                className="flex-1 data-[state=active]:bg-linear-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <Hash className="h-4 w-4 mr-2" />
                Task Chat
              </TabsTrigger>
            </TabsList>

            {/* Search input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={activeTab === 'direct' ? 'Search users...' : 'Search tasks...'}
                className="pl-10 bg-white border-slate-200 focus:border-violet-300 focus:ring-violet-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Content */}
            <TabsContent value="direct" className="mt-0">
              <ScrollArea className="h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-linear-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                      <Users className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No users found</p>
                    <p className="text-sm text-slate-400 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map((user) => {
                      const hasExisting = hasExistingDirectChat(user.id);
                      const isSelected = selectedUserId === user.id;
                      
                      return (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user.id)}
                          disabled={isCreating}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left",
                            "hover:bg-linear-to-r hover:from-violet-50 hover:to-fuchsia-50",
                            isSelected && "bg-linear-to-r from-violet-100 to-fuchsia-100",
                            isCreating && !isSelected && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10 ring-2 ring-violet-100">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-linear-to-br from-violet-500 to-fuchsia-500 text-white font-medium text-sm">
                                {getInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            {user.is_online && (
                              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 border-2 border-white" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 truncate">
                                {getUserDisplayName(user)}
                              </p>
                              {hasExisting && (
                                <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 border-0">
                                  Existing
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 truncate">
                              {user.email}
                            </p>
                          </div>
                          
                          {isSelected && isCreating ? (
                            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                          ) : hasExisting ? (
                            <CheckCircle className="h-5 w-5 text-violet-500" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-slate-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="task" className="mt-0">
              <ScrollArea className="h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-linear-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                      <Hash className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No tasks found</p>
                    <p className="text-sm text-slate-400 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredTasks.map((task) => {
                      const hasExisting = hasExistingTaskChat(task.id);
                      const isSelected = selectedTaskId === task.id;
                      
                      return (
                        <button
                          key={task.id}
                          onClick={() => handleSelectTask(task.id)}
                          disabled={isCreating}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left",
                            "hover:bg-linear-to-r hover:from-violet-50 hover:to-fuchsia-50",
                            isSelected && "bg-linear-to-r from-violet-100 to-fuchsia-100",
                            isCreating && !isSelected && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-fuchsia-100 to-violet-100 flex items-center justify-center">
                            <Hash className="h-5 w-5 text-fuchsia-600" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 truncate">
                                {task.title}
                              </p>
                              {hasExisting && (
                                <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 border-0">
                                  Existing
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "text-xs border-0 text-white bg-linear-to-r",
                                  getPriorityColor(task.priority)
                                )}
                              >
                                {task.priority}
                              </Badge>
                              <span className="text-xs text-slate-400 capitalize">
                                {task.status?.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          
                          {isSelected && isCreating ? (
                            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                          ) : hasExisting ? (
                            <CheckCircle className="h-5 w-5 text-violet-500" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-slate-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-4 bg-linear-to-r from-slate-50 to-violet-50/50 border-t border-slate-100">
          <p className="text-xs text-slate-500 text-center">
            {activeTab === 'direct' 
              ? 'Click on a user to start a private conversation'
              : 'Click on a task to open or create a task discussion room'
            }
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
