/**
 * User Management Component
 *
 * Admin-only interface for managing users:
 * - List all users with roles and status
 * - Create new users
 * - Edit existing users
 * - Activate/deactivate users
 * - Delete users
 * - View user statistics
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Shield,
  Mail,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { PublicUser, UserRole, CreateUserRequest, UpdateUserRequest } from '../../types/auth';
import { getRoleBadgeColor, getRoleDisplayName, getRoleDescription } from '../../utils/permissions';
import { validatePasswordStrength } from '../../services/authService';

interface UserManagementProps {
  users: PublicUser[];
  currentUser: PublicUser;
  userStats: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
    locked: number;
  };
  onCreateUser: (request: CreateUserRequest) => void;
  onUpdateUser: (userId: string, updates: UpdateUserRequest) => void;
  onDeleteUser: (userId: string) => void;
  onActivateUser: (userId: string) => void;
  onDeactivateUser: (userId: string) => void;
}

export function UserManagement({
  users,
  currentUser,
  userStats,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onActivateUser,
  onDeactivateUser,
}: UserManagementProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Create user form state
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'viewer' as UserRole,
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit user form state
  const [editForm, setEditForm] = useState({
    email: '',
    fullName: '',
    role: 'viewer' as UserRole,
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Filter users
  const filteredUsers = users.filter((user) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.fullName.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Role filter
    if (roleFilter !== 'all' && user.role !== roleFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'active' && !user.isActive) return false;
    if (statusFilter === 'inactive' && user.isActive) return false;

    return true;
  });

  // Handle create user
  const handleCreateUser = () => {
    setCreateError(null);

    // Validate
    if (!createForm.username.trim() || createForm.username.length < 3) {
      setCreateError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(createForm.username)) {
      setCreateError('Username can only contain letters, numbers, and underscores');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!createForm.email.trim() || !emailRegex.test(createForm.email)) {
      setCreateError('Please enter a valid email address');
      return;
    }

    if (!createForm.fullName.trim() || createForm.fullName.length < 2) {
      setCreateError('Full name must be at least 2 characters');
      return;
    }

    const passwordValidation = validatePasswordStrength(createForm.password);
    if (!passwordValidation.isValid) {
      setCreateError(passwordValidation.errors.join('. '));
      return;
    }

    onCreateUser(createForm);
    setShowCreateDialog(false);
    setCreateForm({
      username: '',
      email: '',
      fullName: '',
      password: '',
      role: 'viewer',
    });
  };

  // Handle edit user
  const handleEditUser = () => {
    if (!editingUser) return;
    setEditError(null);

    // Validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editForm.email && !emailRegex.test(editForm.email)) {
      setEditError('Please enter a valid email address');
      return;
    }

    if (editForm.fullName && editForm.fullName.trim().length < 2) {
      setEditError('Full name must be at least 2 characters');
      return;
    }

    onUpdateUser(editingUser.id, {
      email: editForm.email || undefined,
      fullName: editForm.fullName || undefined,
      role: editForm.role,
    });
    setEditingUser(null);
  };

  // Open edit dialog
  const openEditDialog = (user: PublicUser) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
    setEditError(null);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{userStats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{userStats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{userStats.inactive}</p>
              </div>
              <ShieldOff className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Administrators</p>
                <p className="text-2xl font-bold text-purple-600">{userStats.byRole.admin}</p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user accounts and permissions</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system with a specific role
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {createError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{createError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="create-username">Username *</Label>
                    <Input
                      id="create-username"
                      value={createForm.username}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, username: e.target.value })
                      }
                      placeholder="john_doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-email">Email *</Label>
                    <Input
                      id="create-email"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-fullname">Full Name *</Label>
                    <Input
                      id="create-fullname"
                      value={createForm.fullName}
                      onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="create-password"
                        type={showPassword ? 'text' : 'password'}
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Min 8 chars, uppercase, lowercase, number, special char
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-role">Role *</Label>
                    <Select
                      value={createForm.role}
                      onValueChange={(value: UserRole) =>
                        setCreateForm({ ...createForm, role: value })
                      }
                    >
                      <SelectTrigger id="create-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      {getRoleDescription(createForm.role)}
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser}>Create User</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-filter">Role</Label>
              <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
                <SelectTrigger id="role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* User List */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{user.fullName}</h3>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {getRoleDisplayName(user.role)}
                          </Badge>
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                          )}
                          {user.id === currentUser.id && (
                            <Badge variant="outline">You</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            <span>@{user.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span>{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>Created {formatDate(user.createdAt)}</span>
                          </div>
                          {user.lastLogin && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Last login: {formatDate(user.lastLogin)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Edit Button */}
                        <Dialog
                          open={editingUser?.id === user.id}
                          onOpenChange={(open) => !open && setEditingUser(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Edit User</DialogTitle>
                              <DialogDescription>Update user information</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              {editError && (
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{editError}</AlertDescription>
                                </Alert>
                              )}

                              <div className="space-y-2">
                                <Label>Username</Label>
                                <Input value={editingUser?.username} disabled />
                                <p className="text-xs text-gray-500">Username cannot be changed</p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                  id="edit-email"
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, email: e.target.value })
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-fullname">Full Name</Label>
                                <Input
                                  id="edit-fullname"
                                  value={editForm.fullName}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, fullName: e.target.value })
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select
                                  value={editForm.role}
                                  onValueChange={(value: UserRole) =>
                                    setEditForm({ ...editForm, role: value })
                                  }
                                >
                                  <SelectTrigger id="edit-role">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                    <SelectItem value="accountant">Accountant</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Administrator</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingUser(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleEditUser}>Save Changes</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Activate/Deactivate Button */}
                        {user.id !== currentUser.id && (
                          user.isActive ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <ShieldOff className="w-3 h-3 mr-1" />
                                  Deactivate
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {user.fullName} will no longer be able to login. You can
                                    reactivate them later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeactivateUser(user.id)}>
                                    Deactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onActivateUser(user.id)}
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Activate
                            </Button>
                          )
                        )}

                        {/* Delete Button */}
                        {user.id !== currentUser.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.fullName}? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteUser(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
