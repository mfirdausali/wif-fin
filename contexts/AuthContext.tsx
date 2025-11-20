/**
 * Authentication Context
 *
 * Provides authentication state and functions throughout the app:
 * - Current user
 * - Login/logout
 * - User management
 * - Permission checking
 * - Activity logging
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  PublicUser,
  LoginCredentials,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  UserReference,
} from '../types/auth';
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  isAuthenticated,
  refreshSession,
  handleFailedLogin,
  handleSuccessfulLogin,
  hashPassword,
} from '../services/authService';
import {
  loadUsers,
  saveUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  createInitialAdmin,
  updateUserPassword,
  getUserStats,
  getAllUsers,
  toPublicUser,
} from '../services/userService';
import {
  logAuthEvent,
  logUserEvent,
  getUserActivityLogs,
} from '../services/activityLogService';
import { toast } from 'sonner';

interface AuthContextType {
  // State
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFirstTime: boolean;

  // Authentication
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setupAdmin: (username: string, email: string, fullName: string, password: string) => Promise<void>;

  // User Management
  users: PublicUser[];
  createNewUser: (request: CreateUserRequest) => Promise<void>;
  updateExistingUser: (userId: string, updates: UpdateUserRequest) => Promise<void>;
  deleteExistingUser: (userId: string) => Promise<void>;
  activateExistingUser: (userId: string) => Promise<void>;
  deactivateExistingUser: (userId: string) => Promise<void>;
  changePassword: (request: ChangePasswordRequest) => Promise<void>;
  updateProfile: (email: string, fullName: string) => Promise<void>;

  // Helper
  createUserReference: (user: PublicUser) => UserReference;
  getUserActivityLog: () => any[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Initialize - check for existing session
  useEffect(() => {
    const initAuth = () => {
      const allUsers = loadUsers();

      // Check if first time (no users)
      if (allUsers.length === 0) {
        setIsFirstTime(true);
        setIsLoading(false);
        return;
      }

      // Check for existing session
      if (isAuthenticated()) {
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          refreshSession();
        }
      }

      setUsers(getAllUsers());
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Auto-refresh session on activity
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      refreshSession();
    };

    // Refresh session on user activity
    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, [user]);

  // Login
  const login = async (credentials: LoginCredentials) => {
    const allUsers = loadUsers();
    const result = authLogin(credentials, allUsers);

    if (!result.success) {
      // Log failed attempt
      const attemptUser = allUsers.find(
        (u) =>
          u.username.toLowerCase() === credentials.usernameOrEmail.toLowerCase() ||
          u.email.toLowerCase() === credentials.usernameOrEmail.toLowerCase()
      );

      if (attemptUser) {
        const updated = handleFailedLogin(attemptUser);
        const updatedUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
        saveUsers(updatedUsers);
      }

      throw new Error(result.error);
    }

    // Success - update user
    if (result.session) {
      const loginUser = allUsers.find((u) => u.id === result.session.user.id);
      if (loginUser) {
        const updated = handleSuccessfulLogin(loginUser);
        const updatedUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
        saveUsers(updatedUsers);
      }

      setUser(result.session.user);
      setUsers(getAllUsers());

      // Log successful login
      logAuthEvent('auth:login', result.session.user);
      toast.success(`Welcome back, ${result.session.user.fullName}!`);
    }
  };

  // Logout
  const logout = () => {
    if (user) {
      logAuthEvent('auth:logout', user);
    }
    authLogout();
    setUser(null);
    toast.info('Logged out successfully');
  };

  // Setup initial admin
  const setupAdmin = async (username: string, email: string, fullName: string, password: string) => {
    const result = createInitialAdmin(username, email, fullName, password);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Auto-login
    await login({ usernameOrEmail: username, password, rememberMe: true });
    setIsFirstTime(false);
    toast.success('Administrator account created successfully!');
  };

  // Create user
  const createNewUser = async (request: CreateUserRequest) => {
    if (!user) throw new Error('Not authenticated');

    const result = createUser(request, user.id);

    if (!result.success) {
      throw new Error(result.error);
    }

    setUsers(getAllUsers());

    if (result.user) {
      logUserEvent('user:created', user, toPublicUser(result.user));
    }

    toast.success(`User ${request.username} created successfully`);
  };

  // Update user
  const updateExistingUser = async (userId: string, updates: UpdateUserRequest) => {
    if (!user) throw new Error('Not authenticated');

    const targetUser = users.find((u) => u.id === userId);
    const result = updateUser(userId, updates, user.id);

    if (!result.success) {
      throw new Error(result.error);
    }

    setUsers(getAllUsers());

    // Update current user if they updated themselves
    if (userId === user.id && result.user) {
      setUser(toPublicUser(result.user));
    }

    if (result.user && targetUser) {
      logUserEvent('user:updated', user, toPublicUser(result.user), {
        changes: updates,
      });
    }

    toast.success('User updated successfully');
  };

  // Delete user
  const deleteExistingUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated');

    const targetUser = users.find((u) => u.id === userId);
    const result = deleteUser(userId);

    if (!result.success) {
      throw new Error(result.error);
    }

    setUsers(getAllUsers());

    if (targetUser) {
      logUserEvent('user:deleted', user, targetUser);
    }

    toast.success('User deleted successfully');
  };

  // Activate user
  const activateExistingUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated');

    const result = activateUser(userId);

    if (!result.success) {
      throw new Error(result.error);
    }

    setUsers(getAllUsers());

    if (result.user) {
      logUserEvent('user:activated', user, toPublicUser(result.user));
    }

    toast.success('User activated successfully');
  };

  // Deactivate user
  const deactivateExistingUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated');

    const result = deactivateUser(userId);

    if (!result.success) {
      throw new Error(result.error);
    }

    setUsers(getAllUsers());

    if (result.user) {
      logUserEvent('user:deactivated', user, toPublicUser(result.user));
    }

    toast.success('User deactivated successfully');
  };

  // Change password
  const changePassword = async (request: ChangePasswordRequest) => {
    if (!user) throw new Error('Not authenticated');

    const allUsers = loadUsers();
    const result = authLogin(
      { usernameOrEmail: user.username, password: request.currentPassword },
      allUsers
    );

    if (!result.success) {
      throw new Error('Current password is incorrect');
    }

    const updateResult = updateUserPassword(user.id, request.newPassword);

    if (!updateResult.success) {
      throw new Error(updateResult.error);
    }

    logAuthEvent('auth:password_changed', user);
    toast.success('Password changed successfully');
  };

  // Update profile
  const updateProfile = async (email: string, fullName: string) => {
    if (!user) throw new Error('Not authenticated');

    await updateExistingUser(user.id, { email, fullName });
  };

  // Create user reference
  const createUserReference = (userObj: PublicUser): UserReference => {
    return {
      id: userObj.id,
      name: userObj.fullName,
      username: userObj.username,
    };
  };

  // Get user activity log
  const getUserActivityLog = () => {
    if (!user) return [];
    return getUserActivityLogs(user.id, 50);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isFirstTime,
    login,
    logout,
    setupAdmin,
    users,
    createNewUser,
    updateExistingUser,
    deleteExistingUser,
    activateExistingUser,
    deactivateExistingUser,
    changePassword,
    updateProfile,
    createUserReference,
    getUserActivityLog,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
