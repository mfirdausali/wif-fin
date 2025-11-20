# Integration Quick Start - 15 Minutes to Secure Authentication

This guide will get authentication running in your app in about 15 minutes.

## Step 1: Verify Installation (30 seconds)

Check that crypto-js is installed:
```bash
npm list crypto-js
```

If not installed:
```bash
npm install crypto-js
npm install --save-dev @types/crypto-js
```

## Step 2: Backup Your Current App.tsx (10 seconds)

```bash
cp App.tsx App.tsx.backup
```

## Step 3: Add Required Imports to App.tsx (1 minute)

Add these imports at the top of your `App.tsx`:

```typescript
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { LoginCredentials } from './types/auth';
import { toast } from 'sonner';
```

## Step 4: Create Authentication Wrapper (3 minutes)

Replace your `App` component export with this structure:

```typescript
// Your existing app content - rename current App to AuthenticatedApp
function AuthenticatedApp() {
  const { user, logout } = useAuth();

  // Add logout button to your header
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Your existing header - ADD this logout button */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">WIF Finance</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.fullName}</span>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </div>

      {/* Your existing app content below */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ALL YOUR EXISTING CONTENT GOES HERE */}
      </div>
    </div>
  );
}

// Authentication check wrapper
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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

  return <AuthenticatedApp />;
}

// Main export with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

## Step 5: Add User Tracking to Documents (5 minutes)

In each of your document form components (InvoiceForm, ReceiptForm, etc.), add:

1. Import at the top:
```typescript
import { useAuth } from '../contexts/AuthContext';
```

2. In the component:
```typescript
const { user, createUserReference } = useAuth();
```

3. When creating/updating documents, add:
```typescript
const document: Invoice = {
  // ... existing fields
  createdBy: user ? createUserReference(user) : undefined,
  updatedBy: user ? createUserReference(user) : undefined,
  lastModifiedAt: new Date().toISOString(),
};
```

## Step 6: Test It! (5 minutes)

1. **Clear localStorage to test first-time setup:**
   - Open browser DevTools (F12)
   - Go to Application > Local Storage
   - Clear all items
   - Refresh page

2. **Create admin account:**
   - You should see "Create Administrator Account" screen
   - Fill in details (use a strong password!)
   - Click "Create Administrator Account"

3. **You're logged in!**
   - Should automatically log you in
   - See your name in the header
   - Can logout and log back in

4. **Create test users:**
   - From your app, add a menu to access User Management
   - Or manually navigate to it via state
   - Create users with different roles

## Step 7: Add Permission Checks (Optional - 5 minutes)

Protect your UI actions with permission checks:

```typescript
import { canEditDocument, canDeleteDocument } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';

const { user } = useAuth();

// Only show edit button if user can edit
{user && canEditDocument(user, document) && (
  <Button onClick={() => handleEdit(document)}>
    <Edit className="w-4 h-4 mr-2" />
    Edit
  </Button>
)}

// Only show delete button if user can delete
{user && canDeleteDocument(user, document) && (
  <Button onClick={() => handleDelete(document)}>
    <Trash2 className="w-4 h-4 mr-2" />
    Delete
  </Button>
)}
```

## Step 8: Add User Management Menu (Optional - 3 minutes)

Add admin menu to access user management:

```typescript
import { UserManagement } from './components/auth/UserManagement';
import { canViewUsers } from './utils/permissions';
import { getUserStats } from './services/userService';

// In your navigation or tabs:
{user && canViewUsers(user) && (
  <Button onClick={() => setView('users')}>
    <Users className="w-4 h-4 mr-2" />
    User Management
  </Button>
)}

// In your content area:
{view === 'users' && user && canViewUsers(user) && (
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
```

## Quick Troubleshooting

### "Cannot find module" errors
Run: `npm install`

### Login screen doesn't appear
Check that App.tsx is wrapped with `<AuthProvider>`

### Can't create admin account
Clear localStorage and refresh page

### Users not showing up
Check console for errors, verify localStorage has 'wif_users' key

### Permission checks not working
Import correct function from `utils/permissions.ts`

## What's Next?

Now that authentication is working:

1. **Add activity logging** to document operations:
   ```typescript
   import { logDocumentEvent } from './services/activityLogService';
   logDocumentEvent('document:created', user, document);
   ```

2. **Add Activity Log viewer** for admins to see audit trail

3. **Update PDF templates** to show "Printed by [User]"

4. **Add user profile** page for password changes

5. **Test different roles** to verify permissions work correctly

## Success Criteria

✅ You can access the app and see login screen
✅ You can create an admin account
✅ You get logged in automatically after setup
✅ You can logout and log back in
✅ You see your name in the header
✅ Documents save with creator information
✅ Only admins can access user management

## Need Help?

- **Type errors**: Check `types/auth.ts` for correct types
- **Permission issues**: Review `utils/permissions.ts`
- **User management**: See `components/auth/UserManagement.tsx`
- **Full examples**: Check `APP_UPDATE_EXAMPLE.tsx`

## Full Documentation

- 📖 Complete README: `AUTHENTICATION_SYSTEM_README.md`
- 📋 Implementation Guide: `AUTH_IMPLEMENTATION_GUIDE.md`
- 💻 Code Example: `APP_UPDATE_EXAMPLE.tsx`

---

**You're done!** 🎉 Your app now has professional authentication and authorization.

**First login credentials**: Whatever you set during admin creation
- Default password requirements: 8+ chars, uppercase, lowercase, number, special char

**Remember**: Keep your admin credentials secure!
