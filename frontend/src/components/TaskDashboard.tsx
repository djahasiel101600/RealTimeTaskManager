import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import { Plus, Search, Filter } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { CreateTaskDialog } from './CreateTaskDialog';

export const TaskDashboard: React.FC = () => {
  const { tasks, filters, isLoading, fetchTasks, setFilters } = useTaskStore();
  const { user } = useAuthStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ [key]: value });
  };

  const canCreateTask = user?.role === 'supervisor' || user?.role === 'atl';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and track all your tasks in real-time
          </p>
        </div>
        {canCreateTask && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search tasks..."
                  className="pl-10"
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={filters.status || ''}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.priority || ''}
                onValueChange={(value) => handleFilterChange('priority', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => handleFilterChange('assignedToMe', !filters.assignedToMe)}
              >
                <Filter className="mr-2 h-4 w-4" />
                {filters.assignedToMe ? 'All Tasks' : 'My Tasks'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No tasks found. {canCreateTask && 'Create your first task!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};