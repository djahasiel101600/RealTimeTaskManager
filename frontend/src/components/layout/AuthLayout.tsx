import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, CheckCircle2, Users, MessageSquare, Shield, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const features = [
  { icon: CheckCircle2, text: 'Real-time task tracking', desc: 'Stay updated instantly' },
  { icon: Users, text: 'Team collaboration', desc: 'Work together seamlessly' },
  { icon: MessageSquare, text: 'Instant messaging', desc: 'Communicate in real-time' },
  { icon: Shield, text: 'Role-based access', desc: 'Secure and organized' },
  { icon: Zap, text: 'Live notifications', desc: 'Never miss an update' },
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const location = useLocation();
  
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-violet-50 via-white to-fuchsia-50">
      {/* Left side - Brand/Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-700 flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Animated background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -right-20 w-60 h-60 bg-fuchsia-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5" 
            style={{ 
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '40px 40px'
            }} 
          />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">TaskFlow</span>
          </div>
        </div>
        
        <div className="space-y-10 relative z-10">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-5">
              Elevate Your Team's
              <span className="block text-fuchsia-200">Productivity</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed max-w-md">
              The modern way to manage tasks, collaborate with your team, and achieve your goals faster than ever.
            </p>
          </div>
          
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div 
                key={feature.text} 
                className="flex items-center gap-4 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:bg-white/10 hover:border-white/20"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-2 bg-white/10 rounded-lg">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-medium block">{feature.text}</span>
                  <span className="text-sm text-white/60">{feature.desc}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold">10K+</div>
              <div className="text-sm text-white/70 mt-1">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">50K+</div>
              <div className="text-sm text-white/70 mt-1">Tasks Done</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-sm text-white/70 mt-1">Uptime</div>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-white/50 relative z-10">
          © {new Date().getFullYear()} TaskFlow. All rights reserved.
        </div>
      </div>
      
      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl shadow-lg shadow-violet-500/30">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">TaskFlow</span>
            </div>
            <p className="text-center text-slate-500">
              {location.pathname === '/login' 
                ? 'Welcome back! Sign in to continue'
                : 'Create your account to get started'}
            </p>
          </div>
          
          {children}
          
          {/* Footer links */}
          <div className="mt-8 text-center space-y-4">
            <div className="text-sm text-slate-400">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-violet-600 hover:text-violet-700 hover:underline font-medium transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-violet-600 hover:text-violet-700 hover:underline font-medium transition-colors">
                Privacy Policy
              </Link>
            </div>
            
            <div className="flex items-center justify-center gap-6 pt-6 border-t border-violet-100">
              <Link
                to="/login"
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-all duration-200",
                  location.pathname === '/login' 
                    ? "text-violet-600" 
                    : "text-slate-400 hover:text-slate-700"
                )}
              >
                Sign In
                {location.pathname === '/login' && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <Link
                to="/register"
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-all duration-200",
                  location.pathname === '/register' 
                    ? "text-violet-600" 
                    : "text-slate-400 hover:text-slate-700"
                )}
              >
                Create Account
                {location.pathname === '/register' && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};