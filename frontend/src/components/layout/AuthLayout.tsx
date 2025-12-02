import React from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Brand/Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-primary to-primary-foreground flex-col justify-between p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-8 w-8" />
          <span className="text-2xl font-bold">Task Manager</span>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold">
            Streamline Your Workflow with Real-Time Collaboration
          </h1>
          <p className="text-lg opacity-90">
            Manage tasks, communicate with your team, and track progress all in one place.
            Join thousands of teams already using Task Manager.
          </p>
          
          <div className="grid grid-cols-2 gap-6 mt-8">
            {[
              'Real-time task updates',
              'Team chat & discussions',
              'File attachments',
              'Activity tracking',
              'Role-based permissions',
              'Mobile responsive',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-current" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="text-sm opacity-80">
          © {new Date().getFullYear()} Task Manager. All rights reserved.
        </div>
      </div>
      
      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Task Manager</span>
            </div>
            <p className="text-center text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>
          
          {children}
          
          {/* Footer links */}
          <div className="mt-8 text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/login"
                className={cn(
                  "text-sm font-medium",
                  location.pathname === '/login' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign In
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                to="/register"
                className={cn(
                  "text-sm font-medium",
                  location.pathname === '/register' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};