import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Mail, 
  Phone, 
  Shield, 
  UserX,
  Check,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { userService } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import type { User, UserRole } from '@/types';
import { cn } from '@/lib/utils';

const roleColors: Record<string, string> = {
  clerk: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  atm: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  atl: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  supervisor: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const roleLabels: Record<string, string> = {
  clerk: 'Clerk',
  atm: 'Audit Team Member',
  atl: 'Audit Team Leader',
  supervisor: 'Supervisor',
};

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
};

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('clerk');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    loadUsers();
  }, []);

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

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
      // `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'online' && user.is_online) ||
      (statusFilter === 'offline' && !user.is_online);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleRoleChange = async (user: User, newRole: UserRole) => {
    setError(null);
    setSuccess(null);
    
    try {
      await userService.updateUserRole(user.id, newRole);
      setSuccess(`Successfully changed ${user.username}'s role to ${roleLabels[newRole]}`);
      
      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, role: newRole } : u
      ));
      
      setShowRoleDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update role. Please try again.');
      console.error('Failed to update user role:', error);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    if (user.id === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }

    setError(null);
    setSuccess(null);
    
    try {
      await userService.deleteUser(user.id);
      setSuccess(`Successfully deleted user "${user.username}"`);
      
      // Update local state
      setUsers(users.filter(u => u.id !== user.id));
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete user. Please try again.');
      console.error('Failed to delete user:', error);
    }
  };

  const canManageUser = (targetUser: User) => {
    if (!currentUser) return false;
    
    // Users cannot manage themselves
    if (targetUser.id === currentUser.id) return false;
    
    // Supervisors can manage everyone
    if (currentUser.role === 'supervisor') return true;
    
    // ATLs can only manage clerks and ATMs
    if (currentUser.role === 'atl') {
      return targetUser.role === 'clerk' || targetUser.role === 'atm';
    }
    
    return false;
  };

  const canChangeToRole = (targetRole: UserRole) => {
    if (!currentUser) return false;
    
    // Only supervisors can assign supervisor role
    if (targetRole === 'supervisor' && currentUser.role !== 'supervisor') {
      return false;
    }
    
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage team members and their permissions
          </p>
        </div>
        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                New users should register themselves. You can invite them to join the platform.
              </p>
              <Button variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation Email
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">New Role</Label>
              <Select value={newRole} onValueChange={(value: UserRole) => setNewRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem 
                      key={value} 
                      value={value}
                      disabled={!canChangeToRole(value as UserRole)}
                    >
                      {label}
                      {!canChangeToRole(value as UserRole) && ' (Requires Supervisor)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Role permissions:</p>
              <ul className="list-disc list-inside space-y-1">
                {newRole === 'clerk' && (
                  <>
                    <li>Can view and update assigned tasks</li>
                    <li>Can upload attachments to tasks</li>
                  </>
                )}
                {newRole === 'atm' && (
                  <>
                    <li>All clerk permissions</li>
                    <li>Can participate in audit discussions</li>
                  </>
                )}
                {newRole === 'atl' && (
                  <>
                    <li>All ATM permissions</li>
                    <li>Can create and assign tasks to team</li>
                    <li>Can manage team members</li>
                  </>
                )}
                {newRole === 'supervisor' && (
                  <>
                    <li>All ATL permissions</li>
                    <li>Full access to all tasks and users</li>
                    <li>Can assign supervisor role</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => selectedUser && handleRoleChange(selectedUser, newRole)}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="clerk">Clerk</SelectItem>
                  <SelectItem value="atm">Audit Team Member</SelectItem>
                  <SelectItem value="atl">Audit Team Leader</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>
                          {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                          statusColors[user.is_online ? 'online' : 'offline']
                        )}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{user.username}</h3>
                        {user.id === currentUser?.id && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                        <Badge variant="secondary" className={roleColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {canManageUser(user) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Message
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role);
                            setShowRoleDialog(true);
                          }}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="text-3xl font-bold">{users.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Online Now</p>
              <p className="text-3xl font-bold text-green-600">
                {users.filter(u => u.is_online).length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Team Leaders</p>
              <p className="text-3xl font-bold text-orange-600">
                {users.filter(u => u.role === 'atl').length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Supervisors</p>
              <p className="text-3xl font-bold text-red-600">
                {users.filter(u => u.role === 'supervisor').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};