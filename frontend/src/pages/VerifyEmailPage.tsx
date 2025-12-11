import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

type VerifyEmailParams = {
  token?: string;
};

export const VerifyEmailPage: React.FC = () => {
  const { token } = useParams<VerifyEmailParams>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setIsLoading(false);
      setVerificationStatus('error');
      setError('Invalid verification link. Please request a new verification email.');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await api.get(`/verify-email/${verificationToken}/`);
      setVerificationStatus('success');
      setSuccess('Your email has been verified successfully!');
      
      // Update user verification status in store if user is logged in
      if (user) {
        // We would need to refresh user data here
        // For now, we'll just show success message
      }
      
      // Auto-redirect after 5 seconds
      setTimeout(() => {
        navigate('/tasks');
      }, 5000);
      
    } catch (err: any) {
      setVerificationStatus('error');
      setError(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        'Failed to verify email. The link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!user) {
      setError('You must be logged in to resend verification email.');
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      await api.post('/send-verification-email/');
      setSuccess('Verification email sent successfully! Please check your inbox.');
    } catch (err: any) {
      setError(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        'Failed to send verification email. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl shadow-violet-500/10 bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-slate-800">Verifying Email</CardTitle>
            <CardDescription className="text-slate-500">
              Please wait while we verify your email address...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
              <Mail className="h-6 w-6 text-white animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl shadow-violet-500/10 bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-slate-800">Email Verified!</CardTitle>
            <CardDescription className="text-slate-500">
              Your email has been successfully verified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                {success || 'Your email address has been verified successfully.'}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4 mt-6">
              <p className="text-sm text-slate-600">
                You now have full access to all features of the Task Manager application.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                  <Link to="/tasks">
                    Go to Dashboard
                  </Link>
                </Button>
                <div className="text-center text-sm text-slate-400">
                  Redirecting to dashboard in 5 seconds...
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl shadow-violet-500/10 bg-white/90 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/" className="text-violet-600 hover:text-violet-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CardTitle className="text-2xl font-bold text-slate-800">
              {user ? 'Email Verification Required' : 'Verification Failed'}
            </CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            {user 
              ? 'Please verify your email address to access all features'
              : 'Unable to verify email address'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-700">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">{success}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-6 mt-4">
            {user ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    A verification email was sent to <strong>{user.email}</strong>. 
                    Please click the link in that email to verify your account.
                  </p>
                  <p className="text-sm text-slate-600">
                    If you didn't receive the email, check your spam folder or request a new verification email below.
                  </p>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={resendVerificationEmail}
                    disabled={isResending}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  >
                    {isResending ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Sending...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Resend Verification Email
                      </div>
                    )}
                  </Button>
                  
                  <Button asChild variant="outline" className="border-violet-200 hover:bg-violet-50">
                    <Link to="/tasks">
                      Continue to Dashboard
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    The verification link is invalid or has expired. Please log in to request a new verification email.
                  </p>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button asChild className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                    <Link to="/login">
                      Go to Login
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" className="border-violet-200 hover:bg-violet-50">
                    <Link to="/register">
                      Create New Account
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};