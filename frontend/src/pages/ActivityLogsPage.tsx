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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { activityLogService, type ActivityLog } from '@/services/api';

const actionIcons: Record<string, React.ReactNode> = {
  created: <FileText className="h-4 w-4" />,
  updated: <RefreshCw className="h-4 w-4" />,
  deleted: <AlertCircle className="h-4 w-4" />,
  status_changed: <CheckCircle className="h-4 w-4" />,
  file_attached: <FileText className="h-4 w-4" />,
  file_removed: <FileText className="h-4 w-4" />,
  assigned: <User className="h-4 w-4" />,
  chat_message: <MessageSquare className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  status_changed: 'bg-purple-100 text-purple-800',
  file_attached: 'bg-yellow-100 text-yellow-800',
  file_removed: 'bg-orange-100 text-orange-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  chat_message: 'bg-pink-100 text-pink-800',
};

const actionLabels: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  status_changed: 'Status Changed',
  file_attached: 'File Attached',
  file_removed: 'File Removed',
  assigned: 'Assigned',
  chat_message: 'Chat Message',
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
      // Fallback to mock data if API is not available
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
      actionLabels[log.action] || log.action,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">
            Track all system activities and user actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
              <p className="text-muted-foreground">Loading activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-slate-100 rounded-full mb-4">
                <Activity className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Activity Found</h3>
              <p className="text-center text-muted-foreground max-w-sm">
                No activity logs found for the selected filters. Try adjusting your search or date range.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {filteredLogs.map((log) => {
                  const displayName = log.user?.first_name && log.user?.last_name
                    ? `${log.user.first_name} ${log.user.last_name}`
                    : log.user?.username || 'Unknown';
                  
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="mt-1">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center",
                          actionColors[log.action] || 'bg-gray-100'
                        )}>
                          {actionIcons[log.action] || <FileText className="h-4 w-4" />}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={log.user?.avatar} />
                              <AvatarFallback>
                                {displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{displayName}</span>
                            <Badge variant="outline" className={cn(actionColors[log.action])}>
                              {actionLabels[log.action] || log.action}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        
                        <p className="text-sm mb-2">{getActionDescription(log)}</p>
                        
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2">
                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View Details
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded-md overflow-x-auto text-xs">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          </div>
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

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-linear-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Activity className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                <p className="text-3xl font-bold text-slate-900">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-linear-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Showing</p>
                <p className="text-3xl font-bold text-blue-600">{filteredLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-linear-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <User className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                {logs.length > 0 ? (
                  <p className="text-3xl font-bold text-emerald-600">
                    {new Set(logs.map(l => l.user?.id)).size}
                  </p>
                ) : (
                  <p className="text-3xl font-bold text-emerald-600">0</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};