import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  User, 
  FileText, 
  MessageSquare, 
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Activity,
  Loader2,
  Filter,
  X,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { activityLogService, type ActivityLog } from '@/services/api';

const actionConfig: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  created: { icon: FileText, label: 'Created', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  updated: { icon: RefreshCw, label: 'Updated', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  deleted: { icon: AlertCircle, label: 'Deleted', color: 'text-rose-700', bgColor: 'bg-rose-50 border-rose-200' },
  status_changed: { icon: CheckCircle, label: 'Status Changed', color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200' },
  file_attached: { icon: FileText, label: 'File Attached', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  file_removed: { icon: FileText, label: 'File Removed', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  assigned: { icon: User, label: 'Assigned', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  chat_message: { icon: MessageSquare, label: 'Chat Message', color: 'text-pink-700', bgColor: 'bg-pink-50 border-pink-200' },
};

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    loadLogs();
  }, [actionFilter, dateRange]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        from_date: format(dateRange.from, 'yyyy-MM-dd'),
        to_date: format(dateRange.to, 'yyyy-MM-dd'),
      };
      
      if (actionFilter !== 'all') {
        params.action = actionFilter;
      }
      
      const response = await activityLogService.getLogs(params);
      setLogs(response.results);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const username = log.user?.username?.toLowerCase() || '';
    const firstName = log.user?.first_name?.toLowerCase() || '';
    const lastName = log.user?.last_name?.toLowerCase() || '';
    const taskTitle = log.task_title?.toLowerCase() || '';
    const fileName = log.details?.file_name?.toLowerCase() || '';
    
    return username.includes(searchLower) ||
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      taskTitle.includes(searchLower) ||
      fileName.includes(searchLower);
  });

  const getActionDescription = (log: ActivityLog) => {
    const userName = log.user?.first_name && log.user?.last_name 
      ? `${log.user.first_name} ${log.user.last_name}`
      : log.user?.username || 'Unknown user';
    const task = log.task_title || 'a task';
    
    switch (log.action) {
      case 'created':
        return `${userName} created task "${task}"`;
      case 'updated':
        return `${userName} updated task "${task}"`;
      case 'deleted':
        return `${userName} deleted task "${task}"`;
      case 'status_changed':
        const { old_status, new_status } = log.details;
        return `${userName} changed status of "${task}" from ${old_status} to ${new_status}`;
      case 'file_attached':
        return `${userName} attached file "${log.details.file_name}" to "${task}"`;
      case 'file_removed':
        return `${userName} removed file "${log.details.file_name}" from "${task}"`;
      case 'assigned':
        return `${userName} assigned users to "${task}"`;
      case 'chat_message':
        return `${userName} sent a message in "${task}"`;
      default:
        return `${userName} performed ${log.action} on "${task}"`;
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Task', 'Details'];
    const csvData = filteredLogs.map(log => [
      format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      log.user.username,
      actionConfig[log.action]?.label || log.action,
      log.task_title || 'N/A',
      JSON.stringify(log.details),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
  };

  const hasActiveFilters = searchTerm || actionFilter !== 'all';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 via-violet-600 to-purple-600 p-8 text-white shadow-xl shadow-violet-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMThjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTE4IDBjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-white/20 rounded-xl">
                <Activity className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold">Activity Logs</h1>
            </div>
            <p className="text-white/80 max-w-xl">
              Track all system activities and user actions in real-time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              onClick={exportToCSV}
              className="bg-white/20 hover:bg-white/30 text-white border-0 shadow-lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button 
              variant="secondary" 
              onClick={loadLogs}
              className="bg-white text-violet-700 hover:bg-white/90 border-0 shadow-lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
          <div className="h-1 bg-linear-to-r from-violet-500 to-purple-500" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-linear-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/30">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Activities</p>
                <p className="text-3xl font-bold text-slate-900">{totalCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
          <div className="h-1 bg-linear-to-r from-blue-500 to-indigo-500" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-linear-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30">
                <Filter className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Filtered Results</p>
                <p className="text-3xl font-bold text-slate-900">{filteredLogs.length.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
          <div className="h-1 bg-linear-to-r from-emerald-500 to-teal-500" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Active Users</p>
                <p className="text-3xl font-bold text-slate-900">
                  {logs.length > 0 ? new Set(logs.map(l => l.user?.id)).size : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg shadow-slate-200/50">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by user, task, or file..."
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-violet-300 transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.entries(actionConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <config.icon className={cn("h-3.5 w-3.5", config.color)} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 px-4 bg-slate-50 border-slate-200 hover:bg-white">
                    <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                    <span className="text-slate-700">
                      {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to,
                    }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  onClick={clearFilters}
                  className="h-11 text-slate-500 hover:text-slate-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse" />
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              </div>
              <p className="text-slate-600 mt-6 font-medium">Loading activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <Activity className="h-10 w-10 text-slate-300" />
                </div>
                <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No activities found</h3>
              <p className="text-slate-500 text-center max-w-sm mb-6">
                {hasActiveFilters 
                  ? "Try adjusting your search or filter criteria" 
                  : "No activity logs available for the selected date range"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="border-violet-200 hover:bg-violet-50">
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-slate-100">
                {filteredLogs.map((log, index) => {
                  const config = actionConfig[log.action] || actionConfig.updated;
                  const Icon = config.icon;
                  const displayName = log.user?.first_name && log.user?.last_name
                    ? `${log.user.first_name} ${log.user.last_name}`
                    : log.user?.username || 'Unknown';
                  
                  return (
                    <div
                      key={log.id}
                      className="group flex items-start gap-4 p-5 hover:bg-slate-50/80 transition-colors"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border",
                        config.bgColor
                      )}>
                        <Icon className={cn("h-5 w-5", config.color)} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-1.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <Avatar className="h-6 w-6 ring-2 ring-white">
                              <AvatarImage src={log.user?.avatar} />
                              <AvatarFallback className="text-xs bg-linear-to-br from-violet-500 to-fuchsia-500 text-white">
                                {displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-slate-900">{displayName}</span>
                            <Badge variant="outline" className={cn("text-xs font-medium border", config.bgColor, config.color)}>
                              {config.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-slate-400 shrink-0">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-600 leading-relaxed">{getActionDescription(log)}</p>
                        
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-3 group/details">
                            <summary className="text-sm text-violet-600 hover:text-violet-700 cursor-pointer font-medium select-none">
                              View details
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-50 rounded-lg overflow-x-auto text-xs text-slate-600 border border-slate-100">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};