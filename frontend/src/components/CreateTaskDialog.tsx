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
import { X, CalendarIcon, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/stores/task.store';
import { userService } from '@/services/api';
import type { User } from '@/types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
        ...formData,
        assigned_to: selectedUsers.map(u => u.id),
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
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter task title"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e:any) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter task description"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label>Due Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? (
                        format(formData.dueDate, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date:any) =>
                        setFormData({ ...formData, dueDate: date })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Assign Users */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Assign To</Label>
                <Popover open={isUsersOpen} onOpenChange={setIsUsersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add People
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredUsers.map((user) => (
                        <Button
                          key={user.id}
                          variant="ghost"
                          className="w-full justify-start p-3"
                          onClick={() => handleUserSelect(user)}
                          disabled={selectedUsers.some(u => u.id === user.id)}
                        >
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>
                              {user.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{user.username}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                          {selectedUsers.some(u => u.id === user.id) && (
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                          )}
                        </Button>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground">
                          No users found
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Badge
                      key={user.id}
                      variant="secondary"
                      className="pl-2 pr-1 py-1 flex items-center gap-1"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>
                          {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{user.username}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-3 w-3 ml-1"
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};