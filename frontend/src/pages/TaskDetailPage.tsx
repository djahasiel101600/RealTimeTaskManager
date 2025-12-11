import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  Users, 
  FileText, 
  Upload,
  Download,
  Trash2,
  MessageSquare,
  Send,
  Edit2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Task store not currently used, but may be needed later
// import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import { taskService, attachmentService, commentService, type Comment } from '@/services/api';
import type { Task, TaskAttachment } from '@/types';
import { cn } from '@/lib/utils';
import ReasonDialog from '@/components/ReasonDialog';

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  review: { label: 'In Review', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  done: { label: 'Done', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  normal: { label: 'Normal', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Status change
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  
  // File upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Comments
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Fetch task details
  useEffect(() => {
    const fetchTask = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const taskData = await taskService.getById(parseInt(id));
        setTask(taskData);
        
        // Fetch attachments
        try {
          const attachmentsData = await attachmentService.getByTask(parseInt(id));
          setAttachments(attachmentsData);
        } catch (err) {
          console.error('Failed to fetch attachments:', err);
        }
        
        // Fetch comments
        try {
          const commentsData = await commentService.getByTask(parseInt(id));
          setComments(Array.isArray(commentsData) ? commentsData : []);
        } catch (err) {
          console.error('Failed to fetch comments:', err);
        }
      } catch (err) {
        console.error('Failed to fetch task:', err);
        setError('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [id]);

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!task || !id) return;
    
    // Use modal flow for critical transitions
    const critical = ['done', 'cancelled'];
    if (critical.includes(newStatus)) {
      // open modal to collect reason
      setPendingStatus(newStatus);
      setShowReason(true);
      return;
    }

    setIsChangingStatus(true);
    try {
      const updatedTask = await taskService.updateTaskStatus(parseInt(id), newStatus);
      setTask(updatedTask);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update task status');
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));
        
        const attachment = await attachmentService.upload(parseInt(id), file);
        setAttachments(prev => [...prev, attachment]);
        
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle file delete
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    
    try {
      await attachmentService.delete(attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      alert('Failed to delete attachment');
    }
  };

  // Handle comment submit
  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !id) return;
    
    setIsSubmittingComment(true);
    try {
      const comment = await commentService.create(parseInt(id), newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Get user initials
  const getInitials = (username?: string) => {
    return username?.charAt(0).toUpperCase() || '?';
  };

  // Modal state for reason
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showReason, setShowReason] = useState(false);

  const handleReasonConfirm = async (reason: string) => {
    if (!pendingStatus || !id) return;
    setShowReason(false);
    setIsChangingStatus(true);
    try {
      const updatedTask = await taskService.updateTaskStatus(parseInt(id), pendingStatus, reason);
      setTask(updatedTask);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update task status');
    } finally {
      setIsChangingStatus(false);
      setPendingStatus(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-linear-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center animate-pulse">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <p className="text-slate-600 font-medium">Loading task details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !task) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/20 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 border-0 shadow-xl shadow-slate-200/50">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-linear-to-br from-rose-500 to-red-500 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Task Not Found</h2>
            <p className="text-slate-600 mb-6">{error || "The task you're looking for doesn't exist."}</p>
            <Button 
              onClick={() => navigate('/tasks')}
              className="bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priority = priorityConfig[task.priority] || priorityConfig.normal;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/tasks')}
                className="hover:bg-violet-50 hover:text-violet-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-linear-to-b from-violet-200 to-fuchsia-200" />
              <h1 className="text-xl font-semibold text-slate-900 truncate max-w-md">
                {task.title}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={cn(
                "px-3 py-1 font-medium border-0",
                task.priority === 'urgent' && "bg-linear-to-r from-rose-500 to-red-500 text-white",
                task.priority === 'high' && "bg-linear-to-r from-orange-500 to-amber-500 text-white",
                task.priority === 'normal' && "bg-linear-to-r from-blue-500 to-indigo-500 text-white",
                task.priority === 'low' && "bg-linear-to-r from-slate-400 to-slate-500 text-white"
              )}>
                {priority.label} Priority
              </Badge>
              <Link to={`/tasks/${id}/edit`}>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-violet-200 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-linear-to-r from-violet-500 to-fuchsia-500" />
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-violet-600" />
                  </div>
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {task.description || 'No description provided.'}
                </p>
              </CardContent>
            </Card>

            <ReasonDialog
              open={showReason}
              title={pendingStatus ? `Reason for ${statusConfig[pendingStatus].label}` : 'Provide reason'}
              description="Provide a short reason for this critical status change."
              initialValue={''}
              onClose={() => { setShowReason(false); setPendingStatus(null); }}
              onConfirm={handleReasonConfirm}
            />

            {/* Attachments */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-linear-to-r from-emerald-500 to-teal-500" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                      <Upload className="h-4 w-4 text-emerald-600" />
                    </div>
                    Attachments
                    {attachments.length > 0 && (
                      <Badge className="ml-2 bg-linear-to-r from-emerald-500 to-teal-500 text-white border-0">
                        {attachments.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {uploadProgress}%
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-linear-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                      <Upload className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="font-medium">No attachments yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Upload files to share with your team
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-linear-to-r from-slate-50 to-white rounded-xl hover:from-emerald-50/50 hover:to-white transition-all duration-200 border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-linear-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-violet-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {attachment.file_name || attachment.file?.split('/').pop() || 'File'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Uploaded {format(new Date(attachment.uploaded_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.file, '_blank')}
                            className="hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comments */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-linear-to-r from-blue-500 to-indigo-500" />
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  Comments
                  {comments.length > 0 && (
                    <Badge className="ml-2 bg-linear-to-r from-blue-500 to-indigo-500 text-white border-0">
                      {comments.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Comment List */}
                {comments.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-linear-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                      <MessageSquare className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="font-medium">No comments yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Be the first to comment on this task
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-80">
                    <div className="space-y-4 pr-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-violet-100">
                            <AvatarFallback className="text-xs bg-linear-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                              {getInitials(comment.user.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 bg-linear-to-r from-slate-50 to-white p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-slate-900">
                                {comment.user.username}
                              </span>
                              <span className="text-xs text-slate-500">
                                {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 mt-1">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Add Comment */}
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Avatar className="h-8 w-8 shrink-0 ring-2 ring-violet-100">
                    <AvatarFallback className="text-xs bg-linear-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                      {getInitials(user?.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-20 resize-none border-slate-200 focus:border-violet-300 focus:ring-violet-200"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleCommentSubmit();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleCommentSubmit}
                      disabled={!newComment.trim() || isSubmittingComment}
                      className="shrink-0 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
                    >
                      {isSubmittingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-linear-to-r from-violet-500 to-fuchsia-500" />
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={task.status}
                  onValueChange={handleStatusChange}
                  disabled={isChangingStatus}
                >
                  <SelectTrigger className="w-full border-violet-200 focus:border-violet-400 focus:ring-violet-200">
                    {isChangingStatus ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                        Updating...
                      </div>
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            value === 'todo' && "bg-slate-400",
                            value === 'in_progress' && "bg-blue-500",
                            value === 'review' && "bg-amber-500",
                            value === 'done' && "bg-emerald-500"
                          )} />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-linear-to-r from-fuchsia-500 to-pink-500" />
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Created By */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-linear-to-r from-slate-50 to-white border border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Created by</p>
                    <p className="text-sm font-medium text-slate-900">
                      {task.created_by?.username}
                    </p>
                  </div>
                </div>

                {/* Assigned To */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-linear-to-r from-slate-50 to-white border border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-1">Assigned to</p>
                    {task.assigned_to && task.assigned_to.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.assigned_to.map((assignee) => (
                          <Badge key={assignee.id} className="text-xs bg-linear-to-r from-violet-100 to-fuchsia-100 text-violet-700 border-0">
                            {assignee.username}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Unassigned</p>
                    )}
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-linear-to-r from-slate-50 to-white border border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Due date</p>
                    <p className="text-sm font-medium text-slate-900">
                      {task.due_date
                        ? format(new Date(task.due_date), 'MMM d, yyyy')
                        : 'No due date'}
                    </p>
                  </div>
                </div>

                {/* Created At */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-linear-to-r from-slate-50 to-white border border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Created</p>
                    <p className="text-sm font-medium text-slate-900">
                      {format(new Date(task.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Log Teaser */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-linear-to-r from-cyan-500 to-blue-500" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <Link to={`/tasks/${id}/activity`}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                    >
                      View all
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 mt-1.5 ring-4 ring-emerald-100" />
                    <div>
                      <p className="text-slate-700 font-medium">Task created</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  {task.updated_at !== task.created_at && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full bg-linear-to-br from-blue-400 to-blue-600 mt-1.5 ring-4 ring-blue-100" />
                      <div>
                        <p className="text-slate-700 font-medium">Last updated</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(task.updated_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailPage;
