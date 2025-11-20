# WIF Finance Authentication & Authorization System

## 🎯 Overview

A comprehensive, production-ready authentication and authorization system built with **security**, **extensibility**, and **Islamic principles of excellence (Ihsan)** in mind.

## ✨ Features

### 🔐 Authentication
- **Secure Login**: Username/email with hashed passwords (SHA-256, ready for bcrypt migration)
- **Session Management**: Configurable timeouts with "Remember Me" functionality
- **First-Time Setup**: Guided administrator account creation
- **Account Lockout**: Protection against brute-force attacks (5 failed attempts)
- **Password Security**: Strong password requirements with real-time validation

### 👥 User Management (Admin Only)
- Create, edit, delete users
- Activate/deactivate accounts
- Four role levels: Viewer, Accountant, Manager, Administrator
- User search and filtering
- Comprehensive user statistics

### 🛡️ Role-Based Access Control (RBAC)
- **Viewer**: Read-only access to documents and accounts
- **Accountant**: Create and edit documents (own drafts only)
- **Manager**: Full document management + approval authority
- **Administrator**: Complete system access including user management

### 📋 Audit Trail
- Complete activity logging for all user actions
- Searchable and filterable logs
- Export to JSON/CSV
- Automatic cleanup of old logs
- User action tracking in documents

### 🔍 Permission System
- Granular permission checking
- Document-level access control
- Business rule enforcement (e.g., can't delete completed documents)
- Helper functions for easy integration

## 📦 What's Included

### Type Definitions
```
types/
  auth.ts           # User, Role, Permission, ActivityLog types
  document.ts       # Updated with UserReference tracking
```

### Services
```
services/
  authService.ts           # Authentication & session management
  userService.ts           # User CRUD & permission checking
  activityLogService.ts    # Audit trail & activity logging
```

### UI Components
```
components/
  auth/
    LoginScreen.tsx        # Login UI with first-time setup
    UserManagement.tsx     # Admin user management interface
    UserProfile.tsx        # User profile & password change
    ActivityLog.tsx        # System audit trail viewer
```

### Context & Utilities
```
contexts/
  AuthContext.tsx    # Global authentication state

utils/
  permissions.ts     # Permission checking helpers
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install crypto-js
npm install --save-dev @types/crypto-js
```

### 2. Wrap Your App with AuthProvider
```tsx
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}
```

### 3. Check Authentication in Your Components
```tsx
import { useAuth } from './contexts/AuthContext';

function YourComponent() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <div>Welcome, {user.fullName}!</div>;
}
```

### 4. Add Permission Checks
```tsx
import { canCreateDocuments } from './utils/permissions';

{canCreateDocuments(user) && (
  <Button onClick={createDocument}>Create Document</Button>
)}
```

## 🔒 Security Features

### Password Requirements
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter
- ✅ At least one lowercase letter
- ✅ At least one number
- ✅ At least one special character

### Account Lockout
- **Trigger**: 5 failed login attempts
- **Duration**: 30 minutes (configurable)
- **Recovery**: Auto-unlock after timeout, or admin manual unlock

### Session Security
- **Regular Session**: 60 minutes inactivity timeout
- **Remember Me**: 30 days
- **Auto-Refresh**: On user activity (clicks, keypress)
- **Secure Storage**: localStorage (easily migrated to httpOnly cookies)

### Password Hashing
- **Current**: SHA-256 with salt
- **Production Ready**: Drop-in replacement for bcrypt
- **Future Proof**: Designed for backend migration

## 👤 User Roles & Permissions

| Permission | Viewer | Accountant | Manager | Admin |
|------------|--------|------------|---------|-------|
| **Documents** |
| View documents | ✅ | ✅ | ✅ | ✅ |
| Create documents | ❌ | ✅ | ✅ | ✅ |
| Edit documents | ❌ | ✅ (own drafts) | ✅ | ✅ |
| Delete documents | ❌ | ❌ | ✅ | ✅ |
| Approve vouchers | ❌ | ❌ | ✅ | ✅ |
| Print documents | ✅ | ✅ | ✅ | ✅ |
| **Accounts** |
| View accounts | ✅ | ✅ | ✅ | ✅ |
| Create accounts | ❌ | ✅ | ✅ | ✅ |
| Edit accounts | ❌ | ✅ | ✅ | ✅ |
| Delete accounts | ❌ | ❌ | ✅ | ✅ |
| **Users** |
| View users | ❌ | ❌ | ❌ | ✅ |
| Create users | ❌ | ❌ | ❌ | ✅ |
| Edit users | ❌ | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ❌ | ✅ |
| **System** |
| Access settings | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ✅ |
| Export data | ❌ | ❌ | ✅ | ✅ |

## 📊 Activity Logging

Every action is tracked with:
- **User**: Who performed the action
- **Timestamp**: When it happened
- **Type**: Category of action (auth, document, account, user, system)
- **Description**: Human-readable summary
- **Resource**: What was affected (document ID, account ID, etc.)
- **Metadata**: Additional context

### Activity Types
```typescript
// Authentication
'auth:login'
'auth:logout'
'auth:login_failed'
'auth:password_changed'

// Documents
'document:created'
'document:updated'
'document:deleted'
'document:status_changed'
'document:approved'
'document:printed'

// Accounts
'account:created'
'account:updated'
'account:deleted'
'account:balance_changed'

// Users
'user:created'
'user:updated'
'user:deleted'
'user:activated'
'user:deactivated'

// System
'system:settings_changed'
'system:data_exported'
```

## 🔧 Usage Examples

### Check Permission
```typescript
import { hasPermission } from './services/userService';
import { useAuth } from './contexts/AuthContext';

const { user } = useAuth();

if (hasPermission(user, 'documents:create')) {
  // Allow document creation
}
```

### Log Activity
```typescript
import { logDocumentEvent } from './services/activityLogService';
import { useAuth } from './contexts/AuthContext';

const { user } = useAuth();

// After creating a document
logDocumentEvent('document:created', user, document);
```

### Track User in Documents
```typescript
import { useAuth } from './contexts/AuthContext';

const { user, createUserReference } = useAuth();

const invoice: Invoice = {
  // ... other fields
  createdBy: createUserReference(user),
  updatedBy: createUserReference(user),
  lastModifiedAt: new Date().toISOString(),
};
```

### User Management
```typescript
import { useAuth } from './contexts/AuthContext';

const {
  createNewUser,
  updateExistingUser,
  deleteExistingUser
} = useAuth();

// Create user
await createNewUser({
  username: 'john_doe',
  email: 'john@example.com',
  fullName: 'John Doe',
  password: 'SecurePass123!',
  role: 'accountant'
});

// Update user
await updateExistingUser('user-id', {
  email: 'newemail@example.com',
  role: 'manager'
});

// Delete user
await deleteExistingUser('user-id');
```

## 🎨 UI Components

### LoginScreen
```tsx
<LoginScreen
  onLogin={handleLogin}
  onSetupAdmin={handleSetupAdmin}
  isFirstTime={isSystemNew}
  error={errorMessage}
  isLoading={isSubmitting}
/>
```

### UserManagement (Admin Only)
```tsx
<UserManagement
  users={users}
  currentUser={user}
  userStats={getUserStats()}
  onCreateUser={handleCreate}
  onUpdateUser={handleUpdate}
  onDeleteUser={handleDelete}
  onActivateUser={handleActivate}
  onDeactivateUser={handleDeactivate}
/>
```

### UserProfile
```tsx
<UserProfile
  user={user}
  recentActivity={getUserActivityLog()}
  onUpdateProfile={handleUpdateProfile}
  onChangePassword={handleChangePassword}
/>
```

### ActivityLog (Admin Only)
```tsx
<ActivityLog
  activities={getActivityLogs()}
  users={users}
  onExport={handleExport}
/>
```

## 📝 Integration Checklist

- [ ] Install dependencies (crypto-js)
- [ ] Wrap app with `<AuthProvider>`
- [ ] Update App.tsx to check authentication
- [ ] Add user menu with logout
- [ ] Update document forms with user tracking
- [ ] Add permission checks to UI actions
- [ ] Update PDF templates with printer info
- [ ] Add activity logging to document operations
- [ ] Test with different user roles
- [ ] Test first-time setup flow
- [ ] Test password change
- [ ] Test account lockout
- [ ] Test activity log export

## 🔮 Future Enhancements

### Backend Migration
- [ ] PostgreSQL/Supabase database
- [ ] JWT token authentication
- [ ] bcrypt password hashing
- [ ] Refresh token rotation
- [ ] httpOnly secure cookies

### Advanced Security
- [ ] Two-factor authentication (2FA)
- [ ] OAuth/SSO integration
- [ ] Password reset via email
- [ ] IP whitelisting
- [ ] CAPTCHA on login
- [ ] Session device management

### Advanced Features
- [ ] Department-based access control
- [ ] Document-level permissions
- [ ] Approval workflows
- [ ] Email notifications
- [ ] Advanced audit reports
- [ ] User activity analytics

## 📚 Documentation

- **Implementation Guide**: `AUTH_IMPLEMENTATION_GUIDE.md`
- **App Update Example**: `APP_UPDATE_EXAMPLE.tsx`
- **Type Definitions**: `types/auth.ts`
- **Permission Utils**: `utils/permissions.ts`

## 🤝 Support

For questions or issues:
1. Check type definitions in `types/auth.ts`
2. Review permission utilities in `utils/permissions.ts`
3. Examine service implementations in `services/`
4. Study component examples in `components/auth/`

## 🎖️ Design Principles

This system follows Islamic principles of excellence (Ihsan):
- **Security**: Never compromise on protecting user data
- **Transparency**: Complete audit trail of all actions
- **Accountability**: Every action is tracked with user attribution
- **Justice**: Fair role-based access control
- **Excellence**: Clean, maintainable, well-documented code

---

**Built with care for WIF Finance System** 🚀

*Remember: With great power comes great responsibility. This system gives you the tools to secure your financial data - use them wisely.*
