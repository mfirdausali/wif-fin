/**
 * User Profile Component
 *
 * Allows users to:
 * - View their profile information
 * - Edit their own details (email, full name)
 * - Change their password
 * - View their recent activity
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { User, Mail, Lock, Clock, Shield, AlertCircle, Eye, EyeOff, Calendar } from 'lucide-react';
import { PublicUser, ChangePasswordRequest, ActivityLog } from '../../types/auth';
import { getRoleBadgeColor, getRoleDisplayName, getRoleDescription } from '../../utils/permissions';

interface UserProfileProps {
  user: PublicUser;
  recentActivity: ActivityLog[];
  onUpdateProfile: (email: string, fullName: string) => void;
  onChangePassword: (request: ChangePasswordRequest) => void;
}

export function UserProfile({
  user,
  recentActivity,
  onUpdateProfile,
  onChangePassword,
}: UserProfileProps) {
  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: user.email,
    fullName: user.fullName,
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveProfile = () => {
    setProfileError(null);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profileForm.email.trim() || !emailRegex.test(profileForm.email)) {
      setProfileError('Please enter a valid email address');
      return;
    }

    // Validate full name
    if (!profileForm.fullName.trim() || profileForm.fullName.length < 2) {
      setProfileError('Full name must be at least 2 characters');
      return;
    }

    onUpdateProfile(profileForm.email, profileForm.fullName);
    setIsEditingProfile(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordForm.currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    onChangePassword(passwordForm);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{user.fullName}</h2>
              <p className="text-gray-600">@{user.username}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getRoleBadgeColor(user.role)}>
                  {getRoleDisplayName(user.role)}
                </Badge>
                {user.isActive ? (
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{profileError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Username</Label>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Role</Label>
                  <p className="font-medium">{getRoleDisplayName(user.role)}</p>
                  <p className="text-xs text-gray-500 mt-1">{getRoleDescription(user.role)}</p>
                </div>
              </div>

              <Separator />

              {isEditingProfile ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile}>Save Changes</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileForm({ email: user.email, fullName: user.fullName });
                        setProfileError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Joined {formatDate(user.createdAt)}</span>
                  </div>
                  {user.lastLogin && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>Last login: {formatDate(user.lastLogin)}</span>
                    </div>
                  )}
                  <Button onClick={() => setIsEditingProfile(true)}>Edit Profile</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="current-password"
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                      }
                      className="absolute right-3 top-3 text-gray-400"
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="new-password"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-3 text-gray-400"
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Min 8 chars, uppercase, lowercase, number, special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                      }
                      className="absolute right-3 top-3 text-gray-400"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit">Change Password</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent actions in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No recent activity</p>
                ) : (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
