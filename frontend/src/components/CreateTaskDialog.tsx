import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, CalendarIcon, UserPlus, Sparkles, AlertCircle, Flag, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/stores/task.store';
import { userService } from '@/services/api';
import type { User } from '@/types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityConfig = {
  low: { label: 'Low', color: 'text-slate-500', bg: 'from-slate-400 to-slate-500' },
  normal: { label: 'Normal', color: 'text-blue-500', bg: 'from-blue-500 to-indigo-500' },
  high: { label: 'High', color: 'text-amber-500', bg: 'from-amber-500 to-orange-500' },
  urgent: { label: 'Urgent', color: 'text-rose-500', bg: 'from-rose-500 to-red-500' },
};

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { createTask } = useTaskStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUsersOpen, setIsUsersOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal' as const,
    dueDate: undefined as Date | undefined,
    assignedTo: [] as number[],
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
      resetForm();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const fetchedUsers = await userService.getUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'normal',
      dueDate: undefined,
      assignedTo: [],
    });
    setSelectedUsers([]);
    setUserSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createTask({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        assigned_to_ids: selectedUsers.map(u => u.id),
        due_date: formData.dueDate ? format(formData.dueDate, 'yyyy-MM-dd') : undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserSelect = (selectedUser: User) => {
    if (!selectedUsers.some(u => u.id === selectedUser.id)) {
      setSelectedUsers([...selectedUsers, selectedUser]);
      setFormData(prev => ({
        ...prev,
        assignedTo: [...prev.assignedTo, selectedUser.id],
      }));
    }
    setUserSearch('');
    setIsUsersOpen(false);
  };

  const removeSelectedUser = (userId: number) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.filter(id => id !== userId),
    }));
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-0 shadow-2xl shadow-slate-300/50 overflow-hidden bg-white">
        {/* Gradient header accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-fuchsia-500 to-violet-500" />
        
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              Create New Task
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-700 font-medium">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter task title"
                required
                className="border-slate-200 focus:border-violet-300 focus:ring-violet-200 text-base"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-700 font-medium">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e:any) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter task description"
                rows={4}
                className="border-slate-200 focus:border-violet-300 focus:ring-violet-200 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-slate-700 font-medium flex items-center gap-2">
                  <Flag className="h-4 w-4 text-slate-400" />
                  Priority
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger className="border-slate-200 focus:border-violet-300 focus:ring-violet-200">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full bg-linear-to-r", config.bg)} />
                          <span className={config.color}>{config.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                  Due Date (Optional)
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'w-full flex items-center justify-start text-left font-normal border-slate-200 hover:bg-violet-50 hover:border-violet-300 px-3 py-2 rounded-md',
                          !formData.dueDate && 'text-slate-400'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dueDate ? (
                          format(formData.dueDate, 'PPP')
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </div>
                    </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0 shadow-xl">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date:any) =>
                        setFormData({ ...formData, dueDate: date })
                      }
                      initialFocus
                      className="rounded-xl"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Assign Users */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 font-medium flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-slate-400" />
                  Assign To
                </Label>
                <Popover open={isUsersOpen} onOpenChange={setIsUsersOpen}>
                  <PopoverTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-transparent hover:bg-violet-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add People
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 border-0 shadow-xl overflow-hidden" align="end">
                    <div className="p-3 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
                      <Input
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="border-slate-200 focus:border-violet-300 focus:ring-violet-200"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredUsers.map((user) => (
                        <Button
                          key={user.id}
                          variant="ghost"
                          className="w-full justify-start p-3 rounded-none hover:bg-linear-to-r hover:from-violet-50 hover:to-fuchsia-50"
                          onClick={() => handleUserSelect(user)}
                          disabled={selectedUsers.some(u => u.id === user.id)}
                        >
                          <Avatar className="h-8 w-8 mr-3 ring-2 ring-violet-100">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-linear-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-medium">
                              {user.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <div className="font-medium text-slate-700">{user.username}</div>
                            <div className="text-xs text-slate-400">
                              {user.email}
                            </div>
                          </div>
                          {selectedUsers.some(u => u.id === user.id) && (
                            <div className="h-2 w-2 rounded-full bg-linear-to-r from-emerald-400 to-emerald-500" />
                          )}
                        </Button>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="p-6 text-center">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-slate-500">No users found</p>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-linear-to-r from-violet-50/50 to-fuchsia-50/50 border border-violet-100">
                  {selectedUsers.map((user) => (
                    <Badge
                      key={user.id}
                      className="pl-2 pr-1 py-1.5 flex items-center gap-1.5 bg-white border border-violet-200 text-slate-700 shadow-sm"
                    >
                      <Avatar className="h-5 w-5 ring-1 ring-violet-100">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-linear-to-br from-violet-500 to-fuchsia-500 text-white text-xs">
                          {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{user.username}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-0.5 hover:bg-rose-100 hover:text-rose-600 rounded-full"
                        onClick={() => removeSelectedUser(user.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};