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
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', path: '/tasks', icon: LayoutDashboard, description: 'Manage tasks' },
  { name: 'Chat', path: '/chat', icon: MessageSquare, description: 'Team messaging' },
  { name: 'Proposals', path: '/assignments/proposals', icon: Users, description: 'Assignment proposals' },
  { name: 'Users', path: '/users', icon: Users, roles: ['supervisor', 'atl'], description: 'Team members' },
  { name: 'Activity', path: '/activity-logs', icon: Activity, roles: ['supervisor', 'atl'], description: 'System logs' },
  { name: 'Profile', path: '/profile', icon: User, description: 'Your account' },
];

const roleLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  supervisor: { label: 'Supervisor', color: 'text-rose-700', bgColor: 'bg-rose-50 border-rose-200' },
  atl: { label: 'Team Lead', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  atm: { label: 'Team Member', color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200' },
  clerk: { label: 'Clerk', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
};

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

  const getInitials = () => {
    return user?.username?.charAt(0).toUpperCase() || '?';
  };

  const getDisplayName = () => {
    return user?.username || 'User';
  };

  const roleInfo = roleLabels[user?.role || ''] || roleLabels.clerk;

  return (
    <div className="min-h-screen bg-linear-to-br from-violet-50 via-white to-fuchsia-50">
      {/* Mobile sidebar overlay */}
      <div 
        className={cn(
          "lg:hidden fixed inset-0 z-50 bg-black/60 transition-all duration-300",
          sidebarOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-5 border-b border-violet-100 bg-linear-to-r from-violet-600 to-fuchsia-600">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">TaskFlow</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/tasks' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25"
                    : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "")} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-violet-100 bg-linear-to-r from-violet-50/50 to-fuchsia-50/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-violet-200 ring-offset-2">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-linear-to-br from-violet-500 to-fuchsia-500 text-white font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{getDisplayName()}</p>
              <Badge variant="outline" className={cn("text-xs mt-0.5 font-medium border", roleInfo.bgColor, roleInfo.color)}>
                {roleInfo.label}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              title="Logout"
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-violet-100 shadow-xl shadow-violet-500/5">
          <div className="flex h-16 items-center px-5 border-b border-violet-100 bg-linear-to-r from-violet-600 via-violet-600 to-fuchsia-600">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">TaskFlow</h1>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/tasks' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25"
                      : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-violet-500"
                    )} />
                    <span className={cn("font-medium", isActive && "font-semibold")}>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4 text-white/70" />}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-violet-100 bg-linear-to-r from-violet-50/80 to-fuchsia-50/80">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 ring-2 ring-violet-200 ring-offset-2">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-linear-to-br from-violet-500 to-fuchsia-500 text-white font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{getDisplayName()}</p>
                <Badge variant="outline" className={cn("text-xs mt-0.5 font-medium border", roleInfo.bgColor, roleInfo.color)}>
                  {roleInfo.label}
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout} 
                title="Logout"
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-violet-100 bg-white px-4 lg:px-6 shadow-sm shadow-violet-500/5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-violet-50"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-800">
              {navigationItems.find(item => 
                location.pathname === item.path || 
                (item.path !== '/tasks' && location.pathname.startsWith(item.path))
              )?.name || 'Dashboard'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            <div className="hidden md:flex items-center gap-3 pl-3 ml-2 border-l border-violet-100">
              <Avatar className="h-9 w-9 ring-2 ring-violet-100">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-linear-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-medium">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">{getDisplayName()}</span>
                <span className="text-xs text-violet-600 font-medium">{roleInfo.label}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
};