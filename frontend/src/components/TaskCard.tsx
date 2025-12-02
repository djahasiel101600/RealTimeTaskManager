import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Calendar, 
  User, 
  AlertCircle, 
  MoreVertical, 
  Paperclip,
  MessageSquare,
  CheckCircle,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Task, TaskStatus } from '@/types';
import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const statusColors: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-800 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  review: 'bg-purple-100 text-purple-800 border-purple-300',
  done: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  todo: <Clock className="h-3 w-3" />,
  in_progress: <Clock className="h-3 w-3" />,
  review: <AlertCircle className="h-3 w-3" />,
  done: <CheckCircle className="h-3 w-3" />,
  cancelled: <AlertCircle className="h-3 w-3" />,
};

const priorityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800',
  normal: 'bg-green-100 text-green-800',
  high: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-800',
};

const priorityText: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const { updateTaskStatus } = useTaskStore();
  const { user } = useAuthStore();

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateTaskStatus(task.id, newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const getStatusOptions = () => {
    const baseOptions: { label: string; value: TaskStatus }[] = [
      { label: 'To Do', value: 'todo' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Review', value: 'review' },
      { label: 'Done', value: 'done' },
    ];

    if (user?.role === 'supervisor' || user?.role === 'atl') {
      baseOptions.push({ label: 'Cancelled', value: 'cancelled' });
    }

    return baseOptions.filter(option => option.value !== task.status);
  };

  const canEditTask = user?.role === 'supervisor' || 
    user?.role === 'atl' || 
    task.assigned_to.some(u => u.id === user?.id);

  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <Card 
      className={cn(
        'hover:shadow-lg transition-shadow cursor-pointer',
        isOverdue && 'border-red-300 border-2'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-1">
              {task.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          </div>
          {canEditTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {getStatusOptions().map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={(e:any) => {
                      e.stopPropagation();
                      handleStatusChange(option.value);
                    }}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Status and Priority */}
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                'flex items-center gap-1',
                statusColors[task.status]
              )}
            >
              {statusIcons[task.status]}
              {task.status.replace('_', ' ')}
            </Badge>
            <Badge 
              variant="outline"
              className={priorityColors[task.priority]}
            >
              {priorityText[task.priority]}
            </Badge>
          </div>

          {/* Assigned Users */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex -space-x-2">
              {task.assigned_to.slice(0, 3).map((user) => (
                <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>
                    {user.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.assigned_to.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                  +{task.assigned_to.length - 3}
                </div>
              )}
            </div>
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className={cn(
                "h-4 w-4",
                isOverdue ? "text-red-500" : "text-muted-foreground"
              )} />
              <span className={cn(
                isOverdue && "text-red-600 font-medium"
              )}>
                {isOverdue ? 'Overdue' : 'Due'}: {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Attachments and Comments */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              {task.attachments.length > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  <span>{task.attachments.length}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>0</span> {/* Would need to fetch comment count */}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};