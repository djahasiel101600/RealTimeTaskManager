import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">404</CardTitle>
          <p className="text-muted-foreground mt-2">
            Page Not Found
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Oops! Lost in Space?</h2>
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or has been moved. 
              Let's get you back on track.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link to="/tasks">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tasks
              </Link>
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Need help?{' '}
              <Link 
                to="/contact" 
                className="text-primary hover:underline font-medium"
              >
                Contact support
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};