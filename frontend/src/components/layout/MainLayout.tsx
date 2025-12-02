import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth.store';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', path: '/tasks', icon: LayoutDashboard },
  { name: 'Chat', path: '/chat', icon: MessageSquare },
  { name: 'Users', path: '/users', icon: Users, roles: ['supervisor', 'atl'] },
  { name: 'Activity Logs', path: '/activity-logs', icon: Activity, roles: ['supervisor', 'atl'] },
  { name: 'My Profile', path: '/profile', icon: User },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  const filteredNavItems = navigationItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity",
        sidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
      )}>
        <div className={cn(
          "fixed inset-y-0 left-0 w-64 bg-sidebar transform transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <h2 className="text-lg font-semibold">Task Manager</h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="p-4 space-y-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  location.pathname.startsWith(item.path)
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r">
        <div className="flex h-16 items-center px-4 border-b">
          <h1 className="text-xl font-bold">Task Manager</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                location.pathname.startsWith(item.path)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>
                {user?.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              {navigationItems.find(item => location.pathname.startsWith(item.path))?.name || 'Dashboard'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            <div className="hidden lg:flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>
                  {user?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.username}</span>
                <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};