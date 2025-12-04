import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-violet-50 via-white to-fuchsia-50 p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-200/30 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-lg text-center animate-fade-in">
        {/* 404 Illustration */}
        <div className="relative mb-8">
          <div className="text-[180px] font-black leading-none bg-linear-to-br from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent select-none">
            404
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-linear-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center shadow-xl shadow-violet-500/20">
            <Search className="h-14 w-14 text-violet-500" />
          </div>
          {/* Floating sparkles */}
          <Sparkles className="absolute top-8 right-12 h-6 w-6 text-fuchsia-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
          <Sparkles className="absolute bottom-12 left-16 h-5 w-5 text-violet-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Content */}
        <div className="space-y-4 mb-10">
          <h1 className="text-3xl font-bold text-slate-900 text-balance">
            Oops! Page not found
          </h1>
          <p className="text-lg text-slate-600 text-pretty max-w-md mx-auto">
            The page you're looking for seems to have wandered off. 
            Let's get you back on track.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button 
            asChild 
            size="lg"
            className="w-full sm:w-auto bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 h-12 px-8 text-base"
          >
            <Link to="/">
              <Home className="mr-2 h-5 w-5" />
              Go to Dashboard
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            asChild 
            size="lg"
            className="w-full sm:w-auto border-violet-200 hover:bg-violet-50 hover:border-violet-300 h-12 px-8 text-base"
          >
            <Link to="/tasks">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Tasks
            </Link>
          </Button>
        </div>
        
        {/* Help link */}
        <p className="mt-10 text-sm text-slate-500">
          Need help?{' '}
          <Link 
            to="/contact" 
            className="font-semibold text-violet-600 hover:text-violet-700 underline-offset-4 hover:underline transition-colors"
          >
            Contact our support team
          </Link>
        </p>
      </div>
    </div>
  );
};