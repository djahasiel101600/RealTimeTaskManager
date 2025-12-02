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
  RefreshCw
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

interface ActivityLog {
  id: number;
  action: string;
  user: {
    id: number;
    username: string;
    avatar?: string;
  };
  details: Record<string, any>;
  timestamp: string;
  task_title?: string;
}

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
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  // const [selectedTask, setSelectedTask] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      // Mock data - In real app, you would fetch from API
      const mockLogs: ActivityLog[] = [
        {
          id: 1,
          action: 'created',
          user: { id: 1, username: 'admin', avatar: '' },
          details: { task_id: 1 },
          timestamp: new Date().toISOString(),
          task_title: 'Annual Financial Audit',
        },
        {
          id: 2,
          action: 'assigned',
          user: { id: 1, username: 'admin', avatar: '' },
          details: { task_id: 1, user_ids: [2, 3] },
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          task_title: 'Annual Financial Audit',
        },
        {
          id: 3,
          action: 'status_changed',
          user: { id: 2, username: 'john_doe', avatar: '' },
          details: { task_id: 1, old_status: 'todo', new_status: 'in_progress' },
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          task_title: 'Annual Financial Audit',
        },
        {
          id: 4,
          action: 'file_attached',
          user: { id: 3, username: 'jane_smith', avatar: '' },
          details: { task_id: 1, file_name: 'audit_report.pdf' },
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          task_title: 'Annual Financial Audit',
        },
        {
          id: 5,
          action: 'chat_message',
          user: { id: 2, username: 'john_doe', avatar: '' },
          details: { task_id: 1, message: 'Started working on the audit' },
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          task_title: 'Annual Financial Audit',
        },
      ];
      setLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.task_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.file_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    const logDate = new Date(log.timestamp);
    const matchesDate = logDate >= dateRange.from && logDate <= dateRange.to;
    
    return matchesSearch && matchesAction && matchesDate;
  });

  const getActionDescription = (log: ActivityLog) => {
    const user = log.user.username;
    const task = log.task_title;
    
    switch (log.action) {
      case 'created':
        return `${user} created task "${task}"`;
      case 'updated':
        return `${user} updated task "${task}"`;
      case 'deleted':
        return `${user} deleted task "${task}"`;
      case 'status_changed':
        const { old_status, new_status } = log.details;
        return `${user} changed status of "${task}" from ${old_status} to ${new_status}`;
      case 'file_attached':
        return `${user} attached file "${log.details.file_name}" to "${task}"`;
      case 'file_removed':
        return `${user} removed file "${log.details.file_name}" from "${task}"`;
      case 'assigned':
        return `${user} assigned users to "${task}"`;
      case 'chat_message':
        return `${user} sent a message in "${task}"`;
      default:
        return `${user} performed ${log.action} on "${task}"`;
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
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No activity logs found for the selected filters
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {filteredLogs.map((log) => (
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
                            <AvatarImage src={log.user.avatar} />
                            <AvatarFallback>
                              {log.user.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{log.user.username}</span>
                          <Badge variant="outline" className={cn(actionColors[log.action])}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      
                      <p className="text-sm mb-2">{getActionDescription(log)}</p>
                      
                      {Object.keys(log.details).length > 0 && (
                        <div className="mt-2">
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
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
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
              <p className="text-3xl font-bold">{logs.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Last 7 Days</p>
              <p className="text-3xl font-bold text-blue-600">
                {logs.filter(log => 
                  new Date(log.timestamp) >= subDays(new Date(), 7)
                ).length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Most Active User</p>
              {logs.length > 0 ? (
                <>
                  <p className="text-2xl font-bold">
                    {(() => {
                      const userCounts: Record<string, number> = {};
                      logs.forEach(log => {
                        userCounts[log.user.username] = (userCounts[log.user.username] || 0) + 1;
                      });
                      const mostActive = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
                      return mostActive ? mostActive[0] : 'N/A';
                    })()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    with {(() => {
                      const userCounts: Record<string, number> = {};
                      logs.forEach(log => {
                        userCounts[log.user.username] = (userCounts[log.user.username] || 0) + 1;
                      });
                      const mostActive = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
                      return mostActive ? mostActive[1] : 0;
                    })()} activities
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold">N/A</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};