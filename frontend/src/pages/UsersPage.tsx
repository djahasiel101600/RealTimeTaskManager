import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Mail, 
  Phone, 
  Shield, 
  UserX,
  Check,
  AlertCircle,
  Users,
  UserCheck,
  Crown,
  Star,
  Grid3X3,
  List,
  X,
  MessageSquare,
  Calendar,
  Activity,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { userService } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useNavigate } from 'react-router-dom';
import type { User, UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

// Role configuration with icons, colors, and descriptions
const roleConfig: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string; 
  icon: React.ElementType;
  description: string;
}> = {
  clerk: {
    label: 'Clerk',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    icon: Users,
    description: 'Can view and update assigned tasks'
  },
  atm: {
    label: 'Audit Team Member',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    icon: UserCheck,
    description: 'Can participate in audit discussions'
  },
  atl: {
    label: 'Audit Team Leader',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    icon: Star,
    description: 'Can create and assign tasks to team'
  },
  supervisor: {
    label: 'Supervisor',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50 border-rose-200 hover:bg-rose-100',
    icon: Crown,
    description: 'Full access to all tasks and users'
  },
};

// Statistics card component
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ElementType;
  bgGradient: string;
  trend?: string;
}> = ({ title, value, icon: Icon, bgGradient, trend }) => (
  <Card className="overflow-hidden border-0 shadow-xl">
    <div className={cn("p-6", bgGradient)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white drop-shadow-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1 drop-shadow-md">{value}</p>
          {trend && <p className="text-xs text-white font-medium mt-1 drop-shadow-sm">{trend}</p>}
        </div>
        <div className="p-3 rounded-2xl bg-white/30 shadow-lg">
          <Icon className="h-6 w-6 text-white drop-shadow-sm" />
        </div>
      </div>
    </div>
  </Card>
);

// User card skeleton for loading state
const UserCardSkeleton: React.FC = () => (
  <Card className="overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// User list item skeleton
const UserListSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 border-b">
    <Skeleton className="h-12 w-12 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
    <Skeleton className="h-6 w-20 rounded-full" />
  </div>
);

// User Grid Card Component
const UserGridCard: React.FC<{
  user: User;
  currentUser: User | null;
  canManage: boolean;
  onViewProfile: () => void;
  onChangeRole: () => void;
  onSendMessage: () => void;
  onDelete: () => void;
}> = ({ user, currentUser, canManage, onViewProfile, onChangeRole, onSendMessage, onDelete }) => {
  const config = roleConfig[user.role] || roleConfig.clerk;
  const RoleIcon = config.icon;
  
  return (
    <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl hover:shadow-violet-500/10 bg-white transition-all duration-300 cursor-pointer"
      onClick={onViewProfile}
    >
      <div className={cn("h-2", 
        user.role === 'supervisor' ? 'bg-linear-to-r from-rose-500 to-pink-500' :
        user.role === 'atl' ? 'bg-linear-to-r from-orange-500 to-amber-500' :
        user.role === 'atm' ? 'bg-linear-to-r from-purple-500 to-violet-500' :
        'bg-linear-to-r from-blue-500 to-cyan-500'
      )} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <Avatar className="h-16 w-16 ring-4 ring-white shadow-md">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className={cn(
                "text-lg font-semibold text-white",
                user.role === 'supervisor' ? 'bg-linear-to-br from-rose-500 to-pink-600' :
                user.role === 'atl' ? 'bg-linear-to-br from-orange-500 to-amber-600' :
                user.role === 'atm' ? 'bg-linear-to-br from-purple-500 to-violet-600' :
                'bg-linear-to-br from-blue-500 to-cyan-600'
              )}>
                {user.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white shadow-sm",
              user.is_online ? 'bg-emerald-500' : 'bg-slate-300'
            )} />
          </div>
          
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open user menu"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendMessage(); }}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Message
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onChangeRole(); }}>
                  <Shield className="mr-2 h-4 w-4" />
                  Change Role
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600 focus:text-red-600"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-slate-900 truncate">{user.username}</h3>
              {user.id === currentUser?.id && (
                <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">You</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
          </div>
          
          <Badge variant="secondary" className={cn("border font-medium", config.bgColor, config.color)}>
            <RoleIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity className="h-3 w-3" />
            <span>
              {user.is_online ? 'Online now' : 
                user.last_login ? `Last seen ${formatDistanceToNow(new Date(user.last_login), { addSuffix: true })}` : 
                'Never logged in'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// User List Row Component
const UserListRow: React.FC<{
  user: User;
  currentUser: User | null;
  canManage: boolean;
  onViewProfile: () => void;
  onChangeRole: () => void;
  onSendMessage: () => void;
  onDelete: () => void;
}> = ({ user, currentUser, canManage, onViewProfile, onChangeRole, onSendMessage, onDelete }) => {
  const config = roleConfig[user.role] || roleConfig.clerk;
  const RoleIcon = config.icon;
  
  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group border-b last:border-b-0"
      onClick={onViewProfile}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="relative shrink-0">
          <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className={cn(
              "font-semibold text-white",
              user.role === 'supervisor' ? 'bg-linear-to-br from-rose-500 to-pink-600' :
              user.role === 'atl' ? 'bg-linear-to-br from-orange-500 to-amber-600' :
              user.role === 'atm' ? 'bg-linear-to-br from-purple-500 to-violet-600' :
              'bg-linear-to-br from-blue-500 to-cyan-600'
            )}>
              {user.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
            user.is_online ? 'bg-emerald-500' : 'bg-slate-300'
          )} />
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{user.username}</h3>
            {user.id === currentUser?.id && (
              <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 shrink-0">You</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              {user.email}
            </span>
            {user.phone && (
              <span className="flex items-center gap-1 shrink-0">
                <Phone className="h-3 w-3" />
                {user.phone}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 shrink-0">
        <Badge variant="secondary" className={cn("border font-medium hidden sm:flex", config.bgColor, config.color)}>
          <RoleIcon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
        
        <span className="text-xs text-slate-400 hidden md:block w-24 text-right">
          {user.is_online ? (
            <span className="text-emerald-600 font-medium">Online</span>
          ) : user.last_login ? (
            formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
          ) : 'Never'}
        </span>
        
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open user menu"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendMessage(); }}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onChangeRole(); }}>
                <Shield className="mr-2 h-4 w-4" />
                Change Role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600 focus:text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <UserX className="mr-2 h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('clerk');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { user: currentUser } = useAuthStore();
  const { createDirectRoom, setActiveRoom } = useChatStore();

  useEffect(() => {
    loadUsers();
  }, []);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error: any) {
      setError('Failed to load users. Please try again.');
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'online' && user.is_online) ||
        (statusFilter === 'offline' && !user.is_online);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    online: users.filter(u => u.is_online).length,
    leaders: users.filter(u => u.role === 'atl').length,
    supervisors: users.filter(u => u.role === 'supervisor').length,
  }), [users]);

  const handleRoleChange = async () => {
    if (!selectedUser) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      await userService.updateUserRole(selectedUser.id, newRole);
      setSuccess(`Successfully changed ${selectedUser.username}'s role to ${roleConfig[newRole].label}`);
      
      setUsers(users.map(u => 
        u.id === selectedUser.id ? { ...u, role: newRole } : u
      ));
      
      setShowRoleDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update role. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    setError(null);
    
    try {
      await userService.deleteUser(selectedUser.id);
      setSuccess(`Successfully deleted user "${selectedUser.username}"`);
      setUsers(users.filter(u => u.id !== selectedUser.id));
      setShowDeleteDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete user. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendMessage = async (user: User) => {
    try {
      const room = await createDirectRoom(user.id);
      setActiveRoom(room);
      navigate('/chat');
    } catch (error) {
      setError('Failed to start conversation. Please try again.');
    }
  };

  const canManageUser = (targetUser: User) => {
    if (!currentUser) return false;
    if (targetUser.id === currentUser.id) return false;
    if (currentUser.role === 'supervisor') return true;
    if (currentUser.role === 'atl') {
      return targetUser.role === 'clerk' || targetUser.role === 'atm';
    }
    return false;
  };

  const canChangeToRole = (targetRole: UserRole) => {
    if (!currentUser) return false;
    if (targetRole === 'supervisor' && currentUser.role !== 'supervisor') return false;
    return true;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm || roleFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMThjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTE4IDBjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Users className="h-6 w-6" />
                </div>
                <h1 className="text-3xl font-bold">User Management</h1>
              </div>
              <p className="text-white/80 max-w-xl">
                Manage your team members, assign roles, and track activity across your organization.
              </p>
            </div>
            <Button 
              className="bg-white text-violet-600 hover:bg-white/90 shadow-lg"
              onClick={() => {
                // TODO: Implement invite user functionality
                alert('Invite user feature coming soon!');
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.total}
          icon={Users}
          bgGradient="bg-linear-to-br from-blue-500 to-cyan-600"
        />
        <StatCard
          title="Online Now"
          value={stats.online}
          icon={Activity}
          bgGradient="bg-linear-to-br from-emerald-500 to-teal-600"
          trend={`${Math.round((stats.online / stats.total) * 100) || 0}% of team`}
        />
        <StatCard
          title="Team Leaders"
          value={stats.leaders}
          icon={Star}
          bgGradient="bg-linear-to-br from-orange-500 to-amber-600"
        />
        <StatCard
          title="Supervisors"
          value={stats.supervisors}
          icon={Crown}
          bgGradient="bg-linear-to-br from-rose-500 to-pink-600"
        />
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800 animate-in slide-in-from-top-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between">
            {success}
            <Button variant="ghost" size="sm" onClick={() => setSuccess(null)} className="hover:bg-emerald-100">
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters & Search */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="clerk">
                    <span className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-blue-600" />
                      Clerk
                    </span>
                  </SelectItem>
                  <SelectItem value="atm">
                    <span className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3 text-purple-600" />
                      Audit Team Member
                    </span>
                  </SelectItem>
                  <SelectItem value="atl">
                    <span className="flex items-center gap-2">
                      <Star className="h-3 w-3 text-orange-600" />
                      Audit Team Leader
                    </span>
                  </SelectItem>
                  <SelectItem value="supervisor">
                    <span className="flex items-center gap-2">
                      <Crown className="h-3 w-3 text-rose-600" />
                      Supervisor
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="online">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  </SelectItem>
                  <SelectItem value="offline">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-slate-300" />
                      Offline
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}

              <Separator orientation="vertical" className="h-10 hidden lg:block" />

              {/* View Toggle */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="grid" className="data-[state=active]:bg-white">
                    <Grid3X3 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list" className="data-[state=active]:bg-white">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-500">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <UserCardSkeleton key={i} />)}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              {[...Array(6)].map((_, i) => <UserListSkeleton key={i} />)}
            </CardContent>
          </Card>
        )
      ) : filteredUsers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-slate-100 rounded-full mb-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No users found</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
              {hasActiveFilters ? "Try adjusting your search or filter criteria" : "No users have been added yet"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear all filters</Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user) => (
            <UserGridCard
              key={user.id}
              user={user}
              currentUser={currentUser}
              canManage={canManageUser(user)}
              onViewProfile={() => {
                setSelectedUser(user);
                setShowProfileDialog(true);
              }}
              onChangeRole={() => {
                setSelectedUser(user);
                setNewRole(user.role);
                setShowRoleDialog(true);
              }}
              onSendMessage={() => handleSendMessage(user)}
              onDelete={() => {
                setSelectedUser(user);
                setShowDeleteDialog(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {filteredUsers.map((user) => (
              <UserListRow
                key={user.id}
                user={user}
                currentUser={currentUser}
                canManage={canManageUser(user)}
                onViewProfile={() => {
                  setSelectedUser(user);
                  setShowProfileDialog(true);
                }}
                onChangeRole={() => {
                  setSelectedUser(user);
                  setNewRole(user.role);
                  setShowRoleDialog(true);
                }}
                onSendMessage={() => handleSendMessage(user)}
                onDelete={() => {
                  setSelectedUser(user);
                  setShowDeleteDialog(true);
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* User Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md">
          {selectedUser && (
            <>
              <div className={cn("absolute top-0 left-0 right-0 h-24 rounded-t-lg",
                selectedUser.role === 'supervisor' ? 'bg-linear-to-br from-rose-500 to-pink-600' :
                selectedUser.role === 'atl' ? 'bg-linear-to-br from-orange-500 to-amber-600' :
                selectedUser.role === 'atm' ? 'bg-linear-to-br from-purple-500 to-violet-600' :
                'bg-linear-to-br from-blue-500 to-cyan-600'
              )} />
              
              <div className="relative pt-8">
                <div className="flex justify-center">
                  <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback className={cn(
                      "text-2xl font-bold text-white",
                      selectedUser.role === 'supervisor' ? 'bg-linear-to-br from-rose-500 to-pink-600' :
                      selectedUser.role === 'atl' ? 'bg-linear-to-br from-orange-500 to-amber-600' :
                      selectedUser.role === 'atm' ? 'bg-linear-to-br from-purple-500 to-violet-600' :
                      'bg-linear-to-br from-blue-500 to-cyan-600'
                    )}>
                      {selectedUser.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="text-center mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-xl font-bold">{selectedUser.username}</h2>
                    {selectedUser.is_online && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className={cn(
                    "border font-medium",
                    roleConfig[selectedUser.role]?.bgColor,
                    roleConfig[selectedUser.role]?.color
                  )}>
                    {React.createElement(roleConfig[selectedUser.role]?.icon || Users, { className: "h-3 w-3 mr-1" })}
                    {roleConfig[selectedUser.role]?.label}
                  </Badge>
                </div>
                
                <Separator className="my-6" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium">{selectedUser.email}</p>
                    </div>
                  </div>
                  
                  {selectedUser.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Phone className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Phone</p>
                        <p className="font-medium">{selectedUser.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Member since</p>
                      <p className="font-medium">
                        {selectedUser.date_joined 
                          ? format(new Date(selectedUser.date_joined), 'MMMM d, yyyy')
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Activity className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Last active</p>
                      <p className="font-medium">
                        {selectedUser.is_online 
                          ? 'Online now'
                          : selectedUser.last_login
                            ? formatDistanceToNow(new Date(selectedUser.last_login), { addSuffix: true })
                            : 'Never logged in'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="mt-6 gap-2">
                {selectedUser.id !== currentUser?.id && (
                  <Button variant="outline" onClick={() => {
                    setShowProfileDialog(false);
                    handleSendMessage(selectedUser);
                  }}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                )}
                {canManageUser(selectedUser) && (
                  <Button variant="outline" onClick={() => {
                    setShowProfileDialog(false);
                    setNewRole(selectedUser.role);
                    setShowRoleDialog(true);
                  }}>
                    <Shield className="h-4 w-4 mr-2" />
                    Change Role
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-600" />
              Change User Role
            </DialogTitle>
            <DialogDescription>
              Update the role and permissions for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Select New Role</Label>
              <div className="grid gap-3">
                {Object.entries(roleConfig).map(([value, config]) => {
                  const Icon = config.icon;
                  const isDisabled = !canChangeToRole(value as UserRole);
                  const isSelected = newRole === value;
                  
                  return (
                    <div
                      key={value}
                      onClick={() => !isDisabled && setNewRole(value as UserRole)}
                      className={cn(
                        "relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                        isSelected ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", isSelected ? "bg-violet-100" : "bg-slate-100")}>
                        <Icon className={cn("h-5 w-5", isSelected ? "text-violet-600" : "text-slate-500")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", isSelected && "text-violet-700")}>{config.label}</span>
                          {isDisabled && <Badge variant="outline" className="text-xs">Supervisor only</Badge>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <Check className="h-5 w-5 text-violet-600" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button 
              onClick={handleRoleChange} 
              disabled={isUpdating || newRole === selectedUser?.role}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <UserX className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.username}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete the user account and all their data.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};