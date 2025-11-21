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

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  // hashPassword,
} from '../services/authService';
import {
  loadUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  createInitialAdmin,
  updateUserPassword,
  // getUserStats,
  getAllUsers,
  toPublicUser,
} from '../services/userService';
import {
  logAuthEvent,
  logUserEvent,
  getUserActivityLogs,
} from '../services/activityLogService';
import { toast } from 'sonner';
import { validateSession, cleanupExpiredSessions } from '../services/sessionService';

interface AuthContextType {
  // State
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFirstTime: boolean;

  // Authentication
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
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
    const initAuth = async () => {
      try {
        // Cleanup expired sessions on app startup
        try {
          const cleanedCount = await cleanupExpiredSessions();
          if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired sessions`);
          }
        } catch (error) {
          console.error('Failed to cleanup expired sessions:', error);
        }

        const allUsers = await loadUsers();

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

        const publicUsers = await getAllUsers();
        setUsers(publicUsers);
        setIsLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setIsLoading(false);
      }
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

  // Server-side session validation
  useEffect(() => {
    if (!user) return;

    const validateCurrentSession = async () => {
      const sessionData = localStorage.getItem('wif_auth_session');
      if (!sessionData) return;

      try {
        const session = JSON.parse(sessionData);
        const userId = await validateSession(session.token);

        if (!userId) {
          // Session invalid on server, logout
          console.warn('Session validation failed - logging out');
          if (user) {
            logAuthEvent('auth:logout', user);
          }
          await authLogout();
          setUser(null);
          toast.warning('Your session has expired. Please log in again.');
        }
      } catch (error) {
        console.error('Session validation error:', error);
        // Don't logout on validation errors (network issues, etc.)
      }
    };

    // Validate on mount
    validateCurrentSession();

    // Validate periodically (every 5 minutes)
    const interval = setInterval(validateCurrentSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Login
  const login = async (credentials: LoginCredentials) => {
    const allUsers = await loadUsers();
    const result = await authLogin(credentials, allUsers);

    if (!result.success) {
      // Log failed attempt
      const attemptUser = allUsers.find(
        (u) =>
          u.username.toLowerCase() === credentials.usernameOrEmail.toLowerCase() ||
          u.email.toLowerCase() === credentials.usernameOrEmail.toLowerCase()
      );

      if (attemptUser) {
        const updated = handleFailedLogin(attemptUser);
        // Update in Supabase
        const { updateUserLoginAttempts } = await import('../services/userService');
        await updateUserLoginAttempts(updated.id, updated.failedLoginAttempts, updated.lockedUntil);
      }

      throw new Error(result.error);
    }

    // Success - update user
    if (result.session) {
      const loginUser = allUsers.find((u) => u.id === result.session!.user.id);
      if (loginUser) {
        // Update in Supabase
        const { updateUserLastLogin } = await import('../services/userService');
        await updateUserLastLogin(loginUser.id);
      }

      setUser(result.session.user);
      const publicUsers = await getAllUsers();
      setUsers(publicUsers);

      // Log successful login
      logAuthEvent('auth:login', result.session.user);
      toast.success(`Welcome back, ${result.session.user.fullName}!`);
    }
  };

  // Logout
  const logout = async () => {
    if (user) {
      logAuthEvent('auth:logout', user);
    }
    await authLogout();
    setUser(null);
    toast.info('Logged out successfully');
  };

  // Setup initial admin
  const setupAdmin = async (username: string, email: string, fullName: string, password: string) => {
    const result = await createInitialAdmin(username, email, fullName, password);

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

    const result = await createUser(request, user.id);

    if (!result.success) {
      throw new Error(result.error);
    }

    const publicUsers = await getAllUsers();
    setUsers(publicUsers);

    if (result.user) {
      logUserEvent('user:created', user, toPublicUser(result.user));
    }

    toast.success(`User ${request.username} created successfully`);
  };

  // Update user
  const updateExistingUser = async (userId: string, updates: UpdateUserRequest) => {
    if (!user) throw new Error('Not authenticated');

    const targetUser = users.find((u) => u.id === userId);
    const result = await updateUser(userId, updates);

    if (!result.success) {
      throw new Error(result.error);
    }

    const publicUsers = await getAllUsers();
    setUsers(publicUsers);

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
    const result = await deleteUser(userId);

    if (!result.success) {
      throw new Error(result.error);
    }

    const publicUsers = await getAllUsers();
    setUsers(publicUsers);

    if (targetUser) {
      logUserEvent('user:deleted', user, targetUser);
    }

    toast.success('User deleted successfully');
  };

  // Activate user
  const activateExistingUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated');

    const result = await activateUser(userId);

    if (!result.success) {
      throw new Error(result.error);
    }

    const publicUsers = await getAllUsers();
    setUsers(publicUsers);

    if (result.user) {
      logUserEvent('user:activated', user, toPublicUser(result.user));
    }

    toast.success('User activated successfully');
  };

  // Deactivate user
  const deactivateExistingUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated');

    const result = await deactivateUser(userId);

    if (!result.success) {
      throw new Error(result.error);
    }

    const publicUsers = await getAllUsers();
    setUsers(publicUsers);

    if (result.user) {
      logUserEvent('user:deactivated', user, toPublicUser(result.user));
    }

    toast.success('User deactivated successfully');
  };

  // Change password
  const changePassword = async (request: ChangePasswordRequest) => {
    if (!user) throw new Error('Not authenticated');

    const allUsers = await loadUsers();
    const result = await authLogin(
      { usernameOrEmail: user.username, password: request.currentPassword },
      allUsers
    );

    if (!result.success) {
      throw new Error('Current password is incorrect');
    }

    const updateResult = await updateUserPassword(user.id, request.newPassword);

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
