/**
 * Example: How to Update App.tsx for Authentication
 *
 * This file shows how to integrate the authentication system into your existing App.tsx.
 * Copy relevant sections into your actual App.tsx file.
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { UserManagement } from './components/auth/UserManagement';
import { UserProfile } from './components/auth/UserProfile';
import { ActivityLog } from './components/auth/ActivityLog';
import { LoginCredentials } from './types/auth';
import { Button } from './components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { User, Users, Activity, LogOut, FileText, Settings } from 'lucide-react';
import { canViewUsers, canViewAuditLogs, getRoleDisplayName } from './utils/permissions';
import { getActivityLogs, downloadActivityLogs } from './services/activityLogService';
import { getUserStats } from './services/userService';
import { toast } from 'sonner';

// Wrap your existing app content in this component
function AuthenticatedApp() {
  const {
    user,
    logout,
    users,
    createNewUser,
    updateExistingUser,
    deleteExistingUser,
    activateExistingUser,
    deactivateExistingUser,
    changePassword,
    updateProfile,
    getUserActivityLog,
  } = useAuth();

  const [currentView, setCurrentView] = useState<'documents' | 'users' | 'profile' | 'activity'>('documents');

  if (!user) return null; // Should never happen due to auth check

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with User Menu */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">WIF Finance System</h1>
              <p className="text-sm text-gray-600 mt-1">
                Authenticated as {user.fullName} ({getRoleDisplayName(user.role)})
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4">
              <Button
                variant={currentView === 'documents' ? 'default' : 'ghost'}
                onClick={() => setCurrentView('documents')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </Button>

              {canViewUsers(user) && (
                <Button
                  variant={currentView === 'users' ? 'default' : 'ghost'}
                  onClick={() => setCurrentView('users')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Button>
              )}

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.fullName}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCurrentView('profile')}>
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </DropdownMenuItem>
                  {canViewAuditLogs(user) && (
                    <DropdownMenuItem onClick={() => setCurrentView('activity')}>
                      <Activity className="mr-2 h-4 w-4" />
                      Activity Log
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'documents' && (
          <div>
            {/*
              REPLACE THIS WITH YOUR EXISTING APP CONTENT
              Copy all your existing document management UI here
            */}
            <h2 className="text-xl font-bold mb-4">Document Management</h2>
            <p className="text-gray-600">Your existing document management interface goes here...</p>
            {/* Your DocumentTypeSelector, DocumentList, Forms, etc. */}
          </div>
        )}

        {currentView === 'users' && canViewUsers(user) && (
          <UserManagement
            users={users}
            currentUser={user}
            userStats={getUserStats()}
            onCreateUser={async (request) => {
              try {
                await createNewUser(request);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to create user');
              }
            }}
            onUpdateUser={async (userId, updates) => {
              try {
                await updateExistingUser(userId, updates);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to update user');
              }
            }}
            onDeleteUser={async (userId) => {
              try {
                await deleteExistingUser(userId);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to delete user');
              }
            }}
            onActivateUser={async (userId) => {
              try {
                await activateExistingUser(userId);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to activate user');
              }
            }}
            onDeactivateUser={async (userId) => {
              try {
                await deactivateExistingUser(userId);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to deactivate user');
              }
            }}
          />
        )}

        {currentView === 'profile' && (
          <UserProfile
            user={user}
            recentActivity={getUserActivityLog()}
            onUpdateProfile={async (email, fullName) => {
              try {
                await updateProfile(email, fullName);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to update profile');
              }
            }}
            onChangePassword={async (request) => {
              try {
                await changePassword(request);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to change password');
              }
            }}
          />
        )}

        {currentView === 'activity' && canViewAuditLogs(user) && (
          <ActivityLog
            activities={getActivityLogs()}
            users={users}
            onExport={(format) => {
              try {
                downloadActivityLogs(format);
                toast.success(`Activity log exported as ${format.toUpperCase()}`);
              } catch (error) {
                toast.error('Failed to export activity log');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// Main App Component with Auth Check
function AppContent() {
  const { user, isLoading, isFirstTime, login, setupAdmin } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      setLoginError(null);
      setIsSubmitting(true);
      await login(credentials);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupAdmin = async (
    username: string,
    email: string,
    fullName: string,
    password: string
  ) => {
    try {
      setLoginError(null);
      setIsSubmitting(true);
      await setupAdmin(username, email, fullName, password);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSetupAdmin={handleSetupAdmin}
        isFirstTime={isFirstTime}
        error={loginError}
        isLoading={isSubmitting}
      />
    );
  }

  // Show authenticated app
  return <AuthenticatedApp />;
}

// Root App Component
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
