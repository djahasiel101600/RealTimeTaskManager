import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/services/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await api.post('/password-reset/', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        err.response?.data?.error || 
        'Failed to send reset email. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl shadow-violet-500/10 bg-white/90 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/login" className="text-violet-600 hover:text-violet-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CardTitle className="text-2xl font-bold text-slate-800">Reset Password</CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            {success 
              ? 'Check your email for further instructions'
              : 'Enter your email address and we\'ll send you a link to reset your password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-6">
              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700">
                  If an account with that email exists, you will receive a password reset link shortly.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Please check your inbox (and spam folder) for an email with instructions to reset your password.
                </p>
                <p className="text-sm text-slate-600">
                  The reset link will expire in 24 hours for security reasons.
                </p>
              </div>
              
              <div className="flex flex-col gap-3 pt-4">
                <Button asChild variant="outline" className="border-violet-200 hover:bg-violet-50">
                  <Link to="/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Link>
                </Button>
                <Button 
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  variant="ghost"
                  className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                >
                  Send another reset link
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 h-11 bg-violet-50/50 border-violet-200 focus:border-violet-400 focus:ring-violet-400/20 transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 pt-1">
                  Enter the email address associated with your account
                </p>
              </div>
              
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 transition-all duration-300 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Sending reset link...
                  </div>
                ) : (
                  'Send Reset Link'
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};