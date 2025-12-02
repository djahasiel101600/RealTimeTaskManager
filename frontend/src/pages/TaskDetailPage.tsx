import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Paperclip, 
  MessageSquare,
  Edit,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Upload,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
// Separator import removed (not used)
import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusConfig = {
  todo: { label: 'To Do', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-800' },
  done: { label: 'Done', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800' },
  normal: { label: 'Normal', color: 'bg-green-100 text-green-800' },
  high: { label: 'High', color: 'bg-yellow-100 text-yellow-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
};

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTask, fetchTask, updateTask, deleteTask, isLoading } = useTaskStore();
  const { user } = useAuthStore();
  const [comment, setComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    priority: 'normal' as any,
  });

  useEffect(() => {
    if (id) {
      fetchTask(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    if (selectedTask) {
      setEditData({
        title: selectedTask.title,
        description: selectedTask.description,
        priority: selectedTask.priority,
      });
    }
  }, [selectedTask]);

  if (isLoading || !selectedTask) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleUpdateTask = async () => {
    try {
      await updateTask(selectedTask.id, editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteTask(selectedTask.id);
      navigate('/tasks');
    }
  };

  const canEditTask = user?.role === 'supervisor' || 
    user?.role === 'atl' || 
    selectedTask.assigned_to.some(u => u.id === user?.id);

  const isOverdue = selectedTask.due_date && new Date(selectedTask.due_date) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/tasks')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Task Details</h1>
            <p className="text-muted-foreground">
              Created {format(new Date(selectedTask.created_at), 'PPP')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditTask && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="mr-2 h-4 w-4" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteTask}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="text-2xl font-bold border-b pb-1 w-full"
                  />
                ) : (
                  <CardTitle>{selectedTask.title}</CardTitle>
                )}
                <div className="flex items-center gap-2">
                  <Badge className={statusConfig[selectedTask.status].color}>
                    {statusConfig[selectedTask.status].label}
                  </Badge>
                  <Badge className={priorityConfig[selectedTask.priority].color}>
                    {priorityConfig[selectedTask.priority].label}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={6}
                />
              ) : (
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {selectedTask.description || 'No description provided.'}
                </p>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Due Date</p>
                    <p className={cn(
                      "text-sm",
                      isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                    )}>
                      {selectedTask.due_date ? (
                        <>
                          {format(new Date(selectedTask.due_date), 'PPP')}
                          {isOverdue && ' (Overdue)'}
                        </>
                      ) : (
                        'No due date'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Assigned To</p>
                    <div className="flex -space-x-2 mt-1">
                      {selectedTask.assigned_to.slice(0, 3).map((user) => (
                        <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {user.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {selectedTask.assigned_to.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                          +{selectedTask.assigned_to.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Created By</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.created_by.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedTask.completed_at ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.completed_at
                        ? `Completed ${format(new Date(selectedTask.completed_at), 'PPP')}`
                        : 'In progress'}
                    </p>
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateTask}>
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments ({selectedTask.attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTask.attachments.length === 0 ? (
                <p className="text-muted-foreground">No attachments yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedTask.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{attachment.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {Math.round(attachment.file_size / 1024)} KB • 
                            Uploaded by {attachment.uploaded_by.username}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {canEditTask && (
                <Button className="mt-4" variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Activity feed will appear here.</p>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <Button className="w-full" disabled={!comment.trim()}>
                Post Comment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};