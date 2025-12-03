import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Calendar, 
  Camera, 
  Save, 
  X,
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/stores/auth.store';
import { userService } from '@/services/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const roleColors = {
  clerk: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
  atm: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white',
  atl: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
  supervisor: 'bg-gradient-to-r from-rose-500 to-red-600 text-white',
};

const roleLabels = {
  clerk: 'Clerk',
  atm: 'Audit Team Member',
  atl: 'Audit Team Leader',
  supervisor: 'Supervisor',
};

export const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update profile data
      const updatedUser = await userService.updateProfile({
        username: formData.username,
        phone: formData.phone || null,
      });
      
      // Upload avatar if selected
      if (avatarFile) {
        const userWithAvatar = await userService.uploadAvatar(avatarFile);
        setUser(userWithAvatar);
      } else {
        setUser(updatedUser);
      }
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        'Failed to update profile. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        phone: user.phone || '',
      });
    }
    setIsEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setError(null);
    setSuccess(null);
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
          <Sparkles className="h-6 w-6 text-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 p-6 text-white shadow-xl shadow-violet-500/25">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            <p className="text-white/80 mt-1">
              Manage your personal information and account settings
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button 
                onClick={() => setIsEditing(true)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 text-white"
              >
                Edit Profile
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleCancel} 
                  disabled={isLoading}
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isLoading}
                  className="bg-white text-violet-600 hover:bg-white/90"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Changes
                    </div>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {success && (
        <Alert className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-gradient-to-r from-rose-50 to-red-50 border-rose-200">
          <AlertDescription className="text-rose-700">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Avatar and basic info */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                  <Camera className="h-4 w-4 text-violet-600" />
                </div>
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative">
                <Avatar className="h-32 w-32 ring-4 ring-violet-100 shadow-xl">
                  <AvatarImage src={avatarPreview || user.avatar} />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold">
                    {user.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label className="absolute bottom-0 right-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center justify-center cursor-pointer hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/30 transition-all duration-200">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </label>
                )}
              </div>
              {isEditing && avatarFile && (
                <p className="text-sm text-violet-600 mt-3 font-medium">
                  📎 {avatarFile.name}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-blue-600" />
                </div>
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Role</p>
                    <Badge className={cn("mt-1 border-0", roleColors[user.role])}>
                      {roleLabels[user.role]}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Member Since</p>
                    <p className="text-sm font-medium text-slate-900">
                      {format(new Date(), 'MMMM yyyy')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    user.is_online 
                      ? "bg-gradient-to-br from-emerald-500 to-green-500" 
                      : "bg-gradient-to-br from-slate-400 to-slate-500"
                  )}>
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        user.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      )} />
                      <span className="text-sm font-medium text-slate-700">
                        {user.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Profile form */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-100 to-pink-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-fuchsia-600" />
                </div>
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-700">Username</Label>
                  {isEditing ? (
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      disabled={isLoading}
                      className="border-slate-200 focus:border-violet-300 focus:ring-violet-200"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-violet-600" />
                      </div>
                      <span className="font-medium text-slate-700">{user.username}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700">Email</Label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-700">{user.email}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Email cannot be changed. Contact support for assistance.
                  </p>
                </div>
              </div>

              <Separator className="bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700">Phone Number</Label>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-emerald-600" />
                    </div>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      disabled={isLoading}
                      className="flex-1 border-slate-200 focus:border-violet-300 focus:ring-violet-200"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className={cn(
                      "font-medium",
                      user.phone ? "text-slate-700" : "text-slate-400 italic"
                    )}>
                      {user.phone || 'Not provided'}
                    </span>
                  </div>
                )}
              </div>

              <Separator className="bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Password</h3>
                <p className="text-sm text-slate-500">
                  You can change your password from the account security settings.
                </p>
                <Button 
                  variant="outline" 
                  disabled={isLoading}
                  className="border-violet-200 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700"
                >
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="mt-6 border-0 shadow-lg shadow-rose-100/50 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-red-500" />
            <CardHeader>
              <CardTitle className="text-rose-600 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center">
                  <X className="h-4 w-4 text-rose-600" />
                </div>
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-rose-100 rounded-xl bg-gradient-to-r from-rose-50/50 to-white">
                <div>
                  <h4 className="font-medium text-slate-900">Delete Account</h4>
                  <p className="text-sm text-slate-500">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  disabled
                  className="bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-lg shadow-rose-500/25"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};