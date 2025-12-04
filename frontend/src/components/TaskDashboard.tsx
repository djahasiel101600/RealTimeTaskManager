import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import { 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  ListTodo,
  TrendingUp
} from 'lucide-react';
import { TaskCard } from './TaskCard';
import { CreateTaskDialog } from './CreateTaskDialog';

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  gradient,
  iconBg
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  gradient: string;
  iconBg: string;
}) => (
  <Card className={`relative overflow-hidden border-0 shadow-lg ${gradient} card-hover`}>
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </CardContent>
    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full" />
    <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
  </Card>
);

export const TaskDashboard: React.FC = () => {
  const { tasks, filters, isLoading, pagination, fetchTasks, setFilters, nextPage, previousPage, goToPage } = useTaskStore();
  const { user } = useAuthStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ [key]: value });
  };

  const canCreateTask = user?.role === 'supervisor' || user?.role === 'atl';

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length,
      urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
    };
  }, [tasks]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Task Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Manage and track all your tasks in real-time
          </p>
        </div>
        {canCreateTask && (
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          title="Total Tasks" 
          value={stats.total} 
          icon={ClipboardList}
          gradient="bg-linear-to-br from-slate-600 to-slate-700"
          iconBg="bg-white/20"
        />
        <StatCard 
          title="To Do" 
          value={stats.todo} 
          icon={ListTodo}
          gradient="bg-linear-to-br from-slate-500 to-slate-600"
          iconBg="bg-white/20"
        />
        <StatCard 
          title="In Progress" 
          value={stats.inProgress} 
          icon={Clock}
          gradient="bg-linear-to-br from-violet-500 to-violet-600"
          iconBg="bg-white/20"
        />
        <StatCard 
          title="In Review" 
          value={stats.review} 
          icon={TrendingUp}
          gradient="bg-linear-to-br from-amber-500 to-orange-500"
          iconBg="bg-white/20"
        />
        <StatCard 
          title="Completed" 
          value={stats.done} 
          icon={CheckCircle2}
          gradient="bg-linear-to-br from-emerald-500 to-teal-500"
          iconBg="bg-white/20"
        />
        <StatCard 
          title="Urgent" 
          value={stats.urgent} 
          icon={AlertCircle}
          gradient="bg-linear-to-br from-rose-500 to-pink-500"
          iconBg="bg-white/20"
        />
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-violet-100/50 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-violet-400 h-4 w-4" />
                <Input
                  placeholder="Search tasks by title or description..."
                  className="pl-10 bg-violet-50/50 border-violet-200 focus:bg-white focus:border-violet-400 focus:ring-violet-400/20 transition-all duration-200"
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-[150px] bg-violet-50/50 border-violet-200 focus:border-violet-400">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.priority || 'all'}
                onValueChange={(value) => handleFilterChange('priority', value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-[150px] bg-violet-50/50 border-violet-200 focus:border-violet-400">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={filters.assignedToMe ? "default" : "outline"}
                onClick={() => handleFilterChange('assignedToMe', !filters.assignedToMe)}
                className={filters.assignedToMe 
                  ? "bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 border-0" 
                  : "border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300"}
              >
                <Filter className="mr-2 h-4 w-4" />
                {filters.assignedToMe ? 'My Tasks' : 'All Tasks'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse" />
                <Loader2 className="h-12 w-12 animate-spin text-violet-600 relative" />
              </div>
              <p className="text-slate-500 mt-4 font-medium">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-6 bg-linear-to-br from-violet-100 to-fuchsia-100 rounded-2xl mb-5">
                <ClipboardList className="h-14 w-14 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No tasks found</h3>
              <p className="text-slate-500 text-center max-w-md mb-6">
                {filters.search || filters.status || filters.priority 
                  ? "No tasks match your current filters. Try adjusting them."
                  : canCreateTask 
                    ? "Get started by creating your first task."
                    : "No tasks have been assigned to you yet."}
              </p>
              {canCreateTask && !filters.search && !filters.status && !filters.priority && (
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Task
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
              
              {/* Pagination */}
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                hasNext={pagination.hasNext}
                hasPrevious={pagination.hasPrevious}
                onPageChange={goToPage}
                onNextPage={nextPage}
                onPreviousPage={previousPage}
                className="py-4 border-t border-violet-100"
              />
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