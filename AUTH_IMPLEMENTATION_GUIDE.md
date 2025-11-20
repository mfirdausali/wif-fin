# Authentication & Authorization Implementation Guide

## Overview

This guide provides step-by-step instructions for integrating the newly created authentication and authorization system into the WIF Finance application.

## What Has Been Created

### 1. Type Definitions (`types/auth.ts`)
- User roles: Viewer, Accountant, Manager, Administrator
- Permissions system with RBAC (Role-Based Access Control)
- Activity log types for comprehensive audit trail
- User tracking for documents

### 2. Services
- **`services/authService.ts`**: Authentication, password hashing, session management
- **`services/userService.ts`**: User CRUD operations, permission checking
- **`services/activityLogService.ts`**: Audit trail and activity logging

### 3. Utilities
- **`utils/permissions.ts`**: Permission checking helper functions

### 4. UI Components
- **`components/auth/LoginScreen.tsx`**: Login interface with first-time setup
- **`components/auth/UserManagement.tsx`**: Admin interface for managing users
- **`components/auth/UserProfile.tsx`**: User profile and password management
- **`components/auth/ActivityLog.tsx`**: System activity audit trail

### 5. Context
- **`contexts/AuthContext.tsx`**: Authentication state management

### 6. Updated Types
- **`types/document.ts`**: Added UserReference and user tracking fields to BaseDocument

## Integration Steps

### Step 1: Update App.tsx to Include Authentication

Replace your existing App.tsx with authentication-enabled version:

```typescript
import { AuthProvider } from './contexts/AuthContext';
import { MainApp } from './components/MainApp'; // We'll create this
import { LoginScreen } from './components/auth/LoginScreen';
import { useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user, isLoading, isFirstTime, login, setupAdmin } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      setLoginError(null);
      await login(credentials);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const handleSetupAdmin = async (username: string, email: string, fullName: string, password: string) => {
    try {
      setLoginError(null);
      await setupAdmin(username, email, fullName, password);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Setup failed');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSetupAdmin={handleSetupAdmin}
        isFirstTime={isFirstTime}
        error={loginError}
        isLoading={false}
      />
    );
  }

  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

### Step 2: Create MainApp Component

Move your current App.tsx content into a new MainApp component and add user info display:

```typescript
// components/MainApp.tsx
import { useAuth } from '../contexts/AuthContext';
import { UserManagement } from './auth/UserManagement';
import { UserProfile } from './auth/UserProfile';
import { ActivityLog } from './auth/ActivityLog';
import { canViewUsers, canViewAuditLogs } from '../utils/permissions';

export function MainApp() {
  const { user, logout, users, createNewUser, updateExistingUser, deleteExistingUser,
          activateExistingUser, deactivateExistingUser, changePassword, updateProfile,
          getUserActivityLog } = useAuth();
  const [currentView, setCurrentView] = useState<'documents' | 'users' | 'profile' | 'activity'>('documents');

  return (
    <div>
      {/* Header with user info and logout */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">WIF Finance System</h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{user.fullName}</p>
                <p className="text-sm text-gray-600">{getRoleDisplayName(user.role)}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCurrentView('profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  {canViewUsers(user) && (
                    <DropdownMenuItem onClick={() => setCurrentView('users')}>
                      <Users className="mr-2 h-4 w-4" />
                      User Management
                    </DropdownMenuItem>
                  )}
                  {canViewAuditLogs(user) && (
                    <DropdownMenuItem onClick={() => setCurrentView('activity')}>
                      <Activity className="mr-2 h-4 w-4" />
                      Activity Log
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'documents' && (
          // Your existing document management UI
          <YourExistingDocumentUI />
        )}
        {currentView === 'users' && canViewUsers(user) && (
          <UserManagement
            users={users}
            currentUser={user}
            userStats={getUserStats()}
            onCreateUser={createNewUser}
            onUpdateUser={updateExistingUser}
            onDeleteUser={deleteExistingUser}
            onActivateUser={activateExistingUser}
            onDeactivateUser={deactivateExistingUser}
          />
        )}
        {currentView === 'profile' && (
          <UserProfile
            user={user}
            recentActivity={getUserActivityLog()}
            onUpdateProfile={updateProfile}
            onChangePassword={changePassword}
          />
        )}
        {currentView === 'activity' && canViewAuditLogs(user) && (
          <ActivityLog
            activities={getActivityLogs()}
            users={users}
            onExport={(format) => downloadActivityLogs(format)}
          />
        )}
      </div>
    </div>
  );
}
```

### Step 3: Update Document Forms to Track Users

In all your document form components (InvoiceForm, ReceiptForm, etc.), add user tracking:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { logDocumentEvent } from '../services/activityLogService';

// In your form component:
const { user, createUserReference } = useAuth();

// When creating a document:
const document: Invoice = {
  // ... existing fields
  createdBy: createUserReference(user!),
  updatedBy: createUserReference(user!),
  lastModifiedAt: new Date().toISOString(),
};

// Log the action
logDocumentEvent('document:created', user!, document);
```

### Step 4: Add Permission Checks to Actions

Protect actions with permission checks:

```typescript
import { canEditDocument, canDeleteDocument, canApproveVouchers } from '../utils/permissions';

// Before showing edit button:
{canEditDocument(user, document) && (
  <Button onClick={() => handleEdit(document)}>Edit</Button>
)}

// Before showing delete button:
{canDeleteDocument(user, document) && (
  <Button onClick={() => handleDelete(document)}>Delete</Button>
)}

// Approval button (for payment vouchers):
{canApproveVouchers(user) && document.documentType === 'payment_voucher' && !document.approvedBy && (
  <Button onClick={() => handleApprove(document)}>Approve</Button>
)}
```

### Step 5: Update PDF Templates to Include User Info

Modify your PDF templates (e.g., `pdf-service/src/templates/invoice.js`) to include printer information:

```javascript
function generateInvoiceHTML(invoice, companyInfo = {}, printedBy = null) {
  // ... existing code

  // Add to footer:
  const footer = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #666;">
      ${printedBy ? `Printed by ${printedBy.name} (@${printedBy.username}) on ${new Date().toLocaleString()}` : ''}
      ${invoice.createdBy ? `<br>Created by ${invoice.createdBy.name} on ${new Date(invoice.createdAt).toLocaleDateString()}` : ''}
      ${invoice.approvedBy && typeof invoice.approvedBy === 'object' ? `<br>Approved by ${invoice.approvedBy.name} on ${invoice.approvalDate ? new Date(invoice.approvalDate).toLocaleDateString() : ''}` : ''}
    </div>
  `;

  // Include footer in HTML before closing body tag
}
```

### Step 6: Update DocumentList to Show User Information

Add user info to document display:

```typescript
{doc.createdBy && (
  <div className="text-xs text-gray-500">
    Created by {doc.createdBy.name}
  </div>
)}

{doc.documentType === 'payment_voucher' && doc.approvedBy && typeof doc.approvedBy === 'object' && (
  <Badge variant="outline" className="text-xs">
    Approved by {doc.approvedBy.name}
  </Badge>
)}
```

## Default Credentials

After first-time setup, you'll create your administrator account. For testing, you can use:
- **Username**: admin
- **Password**: (your chosen password with strong requirements)

## Permission Matrix

| Role        | View Docs | Create Docs | Edit Docs | Delete Docs | Approve Vouchers | Manage Users | View Logs |
|-------------|-----------|-------------|-----------|-------------|------------------|--------------|-----------|
| Viewer      | ✓         | ✗           | ✗         | ✗           | ✗                | ✗            | ✗         |
| Accountant  | ✓         | ✓           | ✓ (own)   | ✗           | ✗                | ✗            | ✗         |
| Manager     | ✓         | ✓           | ✓         | ✓           | ✓                | ✗            | ✗         |
| Admin       | ✓         | ✓           | ✓         | ✓           | ✓                | ✓            | ✓         |

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Account Lockout
- Locks after 5 failed login attempts
- Lockout duration: 30 minutes (configurable)
- Admins can manually unlock accounts

### Session Management
- Regular session: 60 minutes of inactivity
- Remember me: 30 days
- Auto-refresh on user activity

### Audit Trail
All actions are logged with:
- User who performed the action
- Timestamp
- Action type
- Resource affected
- Additional metadata

## Testing the Integration

### 1. First-Time Setup
1. Clear localStorage
2. Refresh app
3. Should see "Create Administrator Account" screen
4. Create admin account
5. Should auto-login

### 2. User Management
1. Login as admin
2. Navigate to User Management
3. Create test users with different roles
4. Test activation/deactivation
5. Test user deletion

### 3. Permission Testing
1. Login with different roles
2. Verify visible UI elements match permissions
3. Test document creation/editing/deletion
4. Test approval workflow (manager approving voucher)

### 4. Activity Logging
1. Perform various actions
2. Check Activity Log
3. Verify all actions are recorded
4. Test filtering and searching
5. Test export functionality

## Migration from Existing Data

If you have existing documents without user tracking:

```typescript
// Migration function
function migrateDocumentsWithUserTracking() {
  const documents = loadDocuments();
  const systemUser = {
    id: 'system',
    name: 'System',
    username: 'system'
  };

  const migratedDocs = documents.map(doc => ({
    ...doc,
    createdBy: doc.createdBy || systemUser,
    updatedBy: doc.updatedBy || systemUser,
    lastModifiedAt: doc.lastModifiedAt || doc.updatedAt
  }));

  saveDocuments(migratedDocs);
}
```

## Troubleshooting

### Issue: Cannot login
- **Check**: Is there a user created?
- **Check**: Is password correct? (case-sensitive)
- **Check**: Is account active?
- **Check**: Is account locked? (wait 30 mins or unlock as admin)

### Issue: Permission denied
- **Check**: User's role
- **Check**: Permission requirements in code
- **Check**: Session hasn't expired

### Issue: Activity logs not showing
- **Check**: Are you calling logActivity functions after actions?
- **Check**: localStorage for 'wif_activity_logs'

## Next Steps for Production

1. **Backend Migration**
   - Move from localStorage to database
   - Implement JWT token-based authentication
   - Use bcrypt for password hashing

2. **Enhanced Security**
   - Implement 2FA
   - Add CAPTCHA for login
   - Implement password reset via email
   - Add IP whitelisting

3. **Advanced Features**
   - OAuth/SSO integration
   - Department-based access
   - Document-level permissions
   - Advanced audit reports

## Support

For questions or issues, refer to:
- Type definitions in `types/auth.ts`
- Permission utilities in `utils/permissions.ts`
- Service implementations in `services/`
- Component examples in `components/auth/`

---

**Remember**: This system is designed with security and extensibility in mind. All passwords are hashed, all actions are logged, and the architecture supports easy migration to a backend API.
