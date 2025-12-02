import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { TaskDashboard } from '@/components/TaskDashboard';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { ChatPage } from '@/pages/ChatPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { UsersPage } from '@/pages/UsersPage';
import { ActivityLogsPage } from '@/pages/ActivityLogsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Role-based route wrapper
const RoleBasedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user } = useAuthStore();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/tasks" replace />;
  }
  
  return <>{children}</>;
};

// App component with WebSocket initialization
const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { isChatConnected, isNotificationsConnected } = useWebSocket();
  
  useEffect(() => {
    if (isAuthenticated) {
      console.log('WebSocket status:', {
        chat: isChatConnected ? 'connected' : 'disconnected',
        notifications: isNotificationsConnected ? 'connected' : 'disconnected',
      });
    }
  }, [isAuthenticated, isChatConnected, isNotificationsConnected]);
  
  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
        
        {/* Protected routes */}
        <Route path="/tasks" element={
          <ProtectedRoute>
            <MainLayout>
              <TaskDashboard />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/tasks/:id" element={
          <ProtectedRoute>
            <MainLayout>
              <TaskDetailPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/chat" element={
          <ProtectedRoute>
            <MainLayout>
              <ChatPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/chat/:roomId" element={
          <ProtectedRoute>
            <MainLayout>
              <ChatPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        {/* Admin/Manager routes */}
        <Route path="/users" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['supervisor', 'atl']}>
              <MainLayout>
                <UsersPage />
              </MainLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        <Route path="/activity-logs" element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['supervisor', 'atl']}>
              <MainLayout>
                <ActivityLogsPage />
              </MainLayout>
            </RoleBasedRoute>
          </ProtectedRoute>
        } />
        
        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;