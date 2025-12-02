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
  Clock
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
  clerk: 'bg-blue-100 text-blue-800',
  atm: 'bg-purple-100 text-purple-800',
  atl: 'bg-orange-100 text-orange-800',
  supervisor: 'bg-red-100 text-red-800',
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and account settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
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

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Avatar and basic info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={avatarPreview || user.avatar} />
                  <AvatarFallback className="text-2xl">
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
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90">
                      <Camera className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </label>
                )}
              </div>
              {isEditing && avatarFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  {avatarFile.name}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <Badge className={cn("mt-1", roleColors[user.role])}>
                    {roleLabels[user.role]}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Member Since</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), 'MMMM yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      user.is_online ? "bg-green-500" : "bg-gray-400"
                    )} />
                    <span className="text-sm text-muted-foreground">
                      {user.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Profile form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  {isEditing ? (
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      disabled={isLoading}
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-md border">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{user.username}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2 p-2 rounded-md border">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed. Contact support for assistance.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      disabled={isLoading}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-md border">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{user.phone || 'Not provided'}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Password</h3>
                <p className="text-sm text-muted-foreground">
                  You can change your password from the account security settings.
                </p>
                <Button variant="outline" disabled={isLoading}>
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="mt-6 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Delete Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button variant="destructive" disabled>
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