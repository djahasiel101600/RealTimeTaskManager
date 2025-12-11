import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Calendar, 
  User, 
  MoreVertical, 
  Paperclip,
  MessageSquare,
  ExternalLink,
  Flame
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Task, TaskStatus } from '@/types';
import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import ReasonDialog from './ReasonDialog';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { isTestEnv } from '@/lib/env';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const statusColors: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
  todo: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
  in_progress: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
  review: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const priorityConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600', icon: null },
  normal: { bg: 'bg-blue-50', text: 'text-blue-600', icon: null },
  high: { bg: 'bg-orange-50', text: 'text-orange-600', icon: <Flame className="h-3 w-3" /> },
  urgent: { bg: 'bg-rose-50', text: 'text-rose-600', icon: <Flame className="h-3 w-3" /> },
};

const priorityText: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const navigate = useNavigate();
  const { updateTaskStatus } = useTaskStore();
  const { user } = useAuthStore();

  const [pendingStatus, setPendingStatus] = React.useState<TaskStatus | null>(null);
  const [isReasonOpen, setIsReasonOpen] = React.useState(false);

  const doUpdate = async (newStatus: TaskStatus, reason?: string) => {
    try {
      await updateTaskStatus(task.id, newStatus, reason);
    } catch (error) {
      console.error('Failed to update task status:', error);
      alert('Failed to update task status');
    }
  };

  const handleStatusChange = (newStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const criticalStatuses: TaskStatus[] = ['done', 'cancelled'];
    if (criticalStatuses.includes(newStatus)) {
      setPendingStatus(newStatus);
      setIsReasonOpen(true);
    } else {
      void doUpdate(newStatus);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/tasks/${task.id}`);
    }
  };

  const getStatusOptions = () => {
    const baseOptions: { label: string; value: TaskStatus }[] = [
      { label: 'To Do', value: 'todo' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'In Review', value: 'review' },
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

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const statusStyle = statusColors[task.status];
  const priorityStyle = priorityConfig[task.priority];

  const getInitials = (username?: string) => {
    return username?.charAt(0).toUpperCase() || '?';
  };

  return (
    <Card 
      className={cn(
        'group relative overflow-hidden border-violet-100/50 bg-white/80 backdrop-blur-sm hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 cursor-pointer hover:border-violet-200 hover:-translate-y-1',
        isOverdue && 'border-rose-200 bg-rose-50/30'
      )}
      onClick={handleCardClick}
    >
      {/* Priority indicator bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        task.priority === 'urgent' ? 'bg-linear-to-r from-rose-500 to-pink-500' :
        task.priority === 'high' ? 'bg-linear-to-r from-orange-500 to-amber-500' :
        task.priority === 'normal' ? 'bg-linear-to-r from-violet-500 to-fuchsia-500' :
        'bg-linear-to-r from-slate-300 to-slate-400'
      )} />
      
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-slate-800 line-clamp-1 group-hover:text-violet-700 transition-colors">
              {task.title}
            </CardTitle>
            {task.description && (
              <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
          {canEditTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-violet-100"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open task menu"
                >
                  <MoreVertical className="h-4 w-4 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" forceMount={isTestEnv() ? true : undefined}>
                <DropdownMenuItem
                  onClick={(e: any) => {
                    e.stopPropagation();
                    navigate(`/tasks/${task.id}`);
                  }}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {getStatusOptions().map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={(e: any) => handleStatusChange(option.value, e)}
                    className="gap-2"
                  >
                    <div className={cn("w-2 h-2 rounded-full", statusColors[option.value].dot)} />
                    Mark as {option.label}
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
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium border-0 px-2.5 py-1',
                statusStyle.bg, statusStyle.text
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", statusStyle.dot)} />
              {statusLabels[task.status]}
            </Badge>
            <Badge 
              variant="outline"
              className={cn('flex items-center gap-1 text-xs font-medium border-0 px-2.5 py-1', priorityStyle.bg, priorityStyle.text)}
            >
              {priorityStyle.icon}
              {priorityText[task.priority]}
            </Badge>
            {isOverdue && (
              <Badge className="bg-rose-500 text-white text-xs border-0 px-2.5 py-1 animate-pulse">
                Overdue
              </Badge>
            )}
          </div>

          {/* Assigned Users */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            {task.assigned_to.length === 0 ? (
              <span className="text-sm text-slate-400 italic">Unassigned</span>
            ) : (
              <div className="flex -space-x-2">
                {task.assigned_to.slice(0, 4).map((assignee) => (
                  <Avatar key={assignee.id} className="h-7 w-7 border-2 border-white ring-1 ring-violet-100">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="text-xs bg-linear-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                      {getInitials(assignee.username)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {task.assigned_to.length > 4 && (
                  <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-600 border-2 border-white ring-1 ring-violet-100">
                    +{task.assigned_to.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className={cn(
                "h-4 w-4",
                isOverdue ? "text-rose-500" : "text-slate-400"
              )} />
              <span className={cn(
                "text-slate-500",
                isOverdue && "text-rose-600 font-medium"
              )}>
                {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-violet-100/50">
            <div className="flex items-center gap-4">
              {task.attachments && task.attachments.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{task.attachments.length}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>0</span>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      </CardContent>
      {/* Reason modal for critical transitions */}
      <ReasonDialog
        open={isReasonOpen}
        title={pendingStatus ? `Reason for ${statusLabels[pendingStatus]}` : 'Provide reason'}
        description="Provide a short reason for this critical status change."
        initialValue={''}
        onClose={() => { setIsReasonOpen(false); setPendingStatus(null); }}
        onConfirm={async (reason: string) => {
          setIsReasonOpen(false);
          if (pendingStatus) {
            await doUpdate(pendingStatus, reason);
          }
          setPendingStatus(null);
        }}
      />
    </Card>
  );
};