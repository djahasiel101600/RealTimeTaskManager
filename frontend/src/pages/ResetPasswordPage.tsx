import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/services/api';

type ResetPasswordParams = {
  uid?: string;
  token?: string;
};

export const ResetPasswordPage: React.FC = () => {
  const { uid, token } = useParams<ResetPasswordParams>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have the required parameters
    if (!uid || !token) {
      setError('Invalid reset link. Please request a new password reset.');
      setIsValidToken(false);
    } else {
      setIsValidToken(true);
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.post('/password-reset/confirm/', {
        uid,
        token,
        new_password: newPassword
      });
      
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err: any) {
      setError(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        'Failed to reset password. The link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl shadow-violet-500/10 bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-slate-800">Invalid Reset Link</CardTitle>
            <CardDescription className="text-slate-500">
              The password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-700">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'This password reset link is no longer valid.'}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4 mt-6">
              <p className="text-sm text-slate-600">
                Please request a new password reset link from the login page.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                  <Link to="/forgot-password">
                    Request New Reset Link
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-violet-200 hover:bg-violet-50">
                  <Link to="/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl shadow-violet-500/10 bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-slate-800">Password Reset Successful</CardTitle>
            <CardDescription className="text-slate-500">
              Your password has been successfully reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                Your password has been updated successfully. You will be redirected to the login page shortly.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4 mt-6">
              <p className="text-sm text-slate-600">
                You can now log in with your new password.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                  <Link to="/login">
                    Go to Login
                  </Link>
                </Button>
                <div className="text-center text-sm text-slate-400">
                  Redirecting in 3 seconds...
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
            <Link to="/login" className="text-violet-600 hover:text-violet-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CardTitle className="text-2xl font-bold text-slate-800">Set New Password</CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Create a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-700 font-medium">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 pr-10 h-11 bg-violet-50/50 border-violet-200 focus:border-violet-400 focus:ring-violet-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 pt-1">
                Must be at least 8 characters long
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 pr-10 h-11 bg-violet-50/50 border-violet-200 focus:border-violet-400 focus:ring-violet-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 transition-all duration-300 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Resetting password...
                </div>
              ) : (
                'Reset Password'
              )}
            </Button>
            
            <div className="text-center text-sm pt-4">
              <span className="text-slate-500">Remember your password?</span>{' '}
              <Link
                to="/login"
                className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};