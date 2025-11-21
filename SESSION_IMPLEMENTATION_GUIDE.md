# Server-Side Session Validation Implementation Guide

## Overview

This guide explains how to implement server-side session validation for WIF Finance.

## Architecture

### Current Flow (Client-side only)
```
Login → Hash password → Store user in localStorage → Trust client token
```

### New Flow (Server-side validation)
```
Login → Create session in Supabase → Return token → Client stores token
Request → Send token → Validate against Supabase → Allow/Deny
```

---

## Implementation Steps

### Step 1: Run Database Migration

```bash
# Apply the new sessions table migration
cd supabase
supabase db push

# Or manually run the SQL:
psql $DATABASE_URL < migrations/003_add_sessions_table.sql
```

### Step 2: Install Dependencies

```bash
npm install crypto-js
npm install --save-dev @types/crypto-js
```

### Step 3: Update authService.ts

Replace the current login flow to create server-side sessions:

```typescript
// In authService.ts

import { createSession, getDeviceInfo } from './sessionService';

export async function login(
  credentials: LoginCredentials,
  users: User[]
): Promise<LoginResult> {
  // ... existing validation code ...

  if (isValid) {
    // NEW: Create server-side session
    const deviceInfo = getDeviceInfo();
    const sessionToken = await createSession(user.id, deviceInfo);

    // Store in localStorage
    const sessionData = {
      token: sessionToken.token,
      refreshToken: sessionToken.refreshToken,
      user: publicUser,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));

    return { success: true, user: publicUser };
  }
}
```

### Step 4: Add Session Validation Hook

Create a React hook to validate sessions:

```typescript
// hooks/useSessionValidation.ts

import { useEffect } from 'react';
import { validateSession } from '../services/sessionService';
import { useAuth } from '../contexts/AuthContext';

export function useSessionValidation() {
  const { logout } = useAuth();

  useEffect(() => {
    const validateCurrentSession = async () => {
      const session = localStorage.getItem('wif_auth_session');
      if (!session) return;

      const { token } = JSON.parse(session);
      const userId = await validateSession(token);

      if (!userId) {
        // Session invalid, logout
        logout();
      }
    };

    // Validate on mount
    validateCurrentSession();

    // Validate periodically (every 5 minutes)
    const interval = setInterval(validateCurrentSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [logout]);
}
```

### Step 5: Update AuthContext to Use Validation

```typescript
// In AuthContext.tsx

import { useSessionValidation } from '../hooks/useSessionValidation';

export function AuthProvider({ children }: { children: ReactNode }) {
  // ... existing code ...

  // Add session validation
  useSessionValidation();

  // ... rest of provider ...
}
```

### Step 6: Update Logout to Revoke Sessions

```typescript
// In authService.ts

import { revokeSession } from './sessionService';

export async function logout(): Promise<void> {
  const session = localStorage.getItem(AUTH_SESSION_KEY);
  if (session) {
    const { token } = JSON.parse(session);

    // Revoke server-side session
    await revokeSession(token);
  }

  localStorage.removeItem(AUTH_SESSION_KEY);
}
```

### Step 7: Add Session Cleanup on App Startup

```typescript
// In App.tsx or AuthContext initialization

import { cleanupExpiredSessions } from './services/sessionService';

useEffect(() => {
  // Cleanup expired sessions on app startup
  cleanupExpiredSessions();
}, []);
```

---

## Security Features

### 1. Token Storage
- **Client**: Only stores the raw token (not hash)
- **Server**: Only stores SHA-256 hash of token
- **Benefit**: Even if database is compromised, tokens can't be reconstructed

### 2. Token Refresh
```typescript
// When session expires, use refresh token
const newSession = await refreshSession(refreshToken);
if (newSession) {
  // Update localStorage with new token
  updateLocalSession(newSession);
}
```

### 3. Multi-Device Support
Users can view and manage active sessions:

```typescript
// Get all user sessions
const sessions = await getUserSessions(userId);

// Show in UI:
sessions.forEach(session => {
  console.log(`Device: ${session.deviceInfo.deviceName}`);
  console.log(`Last active: ${session.lastActivity}`);
  console.log(`Expires: ${session.expiresAt}`);
});

// Revoke specific session
await revokeSessionById(sessionId);
```

### 4. Security Events
On password change or suspicious activity:

```typescript
// Revoke all sessions except current one
await revokeAllUserSessions(userId);
// Then create new session for current device
const newSession = await createSession(userId, deviceInfo);
```

---

## API Endpoints (Optional - for future)

If you want to add dedicated session management endpoints:

```typescript
// routes/sessions.ts

// GET /api/sessions - Get user's active sessions
router.get('/api/sessions', async (req, res) => {
  const userId = await validateSession(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const sessions = await getUserSessions(userId);
  res.json({ sessions });
});

// DELETE /api/sessions/:id - Revoke a specific session
router.delete('/api/sessions/:id', async (req, res) => {
  const userId = await validateSession(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  await revokeSessionById(req.params.id);
  res.json({ success: true });
});

// POST /api/sessions/refresh - Refresh session token
router.post('/api/sessions/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const newSession = await refreshSession(refreshToken);

  if (!newSession) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  res.json({ session: newSession });
});
```

---

## Testing

### 1. Test Session Creation
```typescript
const session = await createSession('user-id-123', {
  userAgent: 'Chrome',
  deviceName: 'Windows PC'
});
console.log('Session created:', session.token);
```

### 2. Test Session Validation
```typescript
const userId = await validateSession(session.token);
console.log('Valid for user:', userId);
```

### 3. Test Session Expiry
```typescript
// Wait 24 hours or manually set expires_at in database
const userId = await validateSession(expiredToken);
console.log('Should be null:', userId); // null
```

### 4. Test Session Revocation
```typescript
await revokeSession(session.token);
const userId = await validateSession(session.token);
console.log('Should be null after revoke:', userId); // null
```

---

## Migration Strategy (Zero Downtime)

### Phase 1: Add Sessions (Backward Compatible)
1. Deploy sessions table
2. Update login to create sessions
3. Keep existing localStorage validation working
4. Users logging in get new sessions

### Phase 2: Enable Validation (Gradual)
1. Add periodic session validation (5 min intervals)
2. Log validation failures (don't logout yet)
3. Monitor for issues

### Phase 3: Enforce Validation (Full)
1. Make session validation mandatory
2. Logout users with invalid sessions
3. Force re-login for security

### Phase 4: Cleanup (Optional)
1. Remove old localStorage-only code
2. Add session management UI
3. Implement "Remember Me" feature

---

## Performance Considerations

### Database Queries
- Session validation: 1 query per validation
- Optimized with indexes on `token_hash` and `expires_at`
- Expected latency: <50ms

### Caching (Future Optimization)
```typescript
// Use Redis or in-memory cache
const sessionCache = new Map<string, { userId: string, expiresAt: Date }>();

async function validateSessionCached(token: string): Promise<string | null> {
  const hash = hashToken(token);
  const cached = sessionCache.get(hash);

  if (cached && cached.expiresAt > new Date()) {
    return cached.userId;
  }

  // Fallback to database
  const userId = await validateSession(token);
  if (userId) {
    sessionCache.set(hash, {
      userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 min cache
    });
  }

  return userId;
}
```

---

## Monitoring & Analytics

Track session metrics:

```sql
-- Active sessions count
SELECT COUNT(*) FROM sessions WHERE expires_at > NOW();

-- Sessions by device
SELECT
  device_info->>'deviceName' as device,
  COUNT(*) as count
FROM sessions
WHERE expires_at > NOW()
GROUP BY device_info->>'deviceName';

-- Average session duration
SELECT
  AVG(EXTRACT(EPOCH FROM (last_activity - created_at))) / 3600 as avg_hours
FROM sessions;
```

---

## Troubleshooting

### Problem: "Session not found" after login
**Solution**: Check if migration ran successfully:
```sql
SELECT * FROM sessions LIMIT 1;
```

### Problem: Sessions not being cleaned up
**Solution**: Run cleanup manually or add cron job:
```typescript
// Add to server startup
setInterval(async () => {
  const count = await cleanupExpiredSessions();
  console.log(`Cleaned up ${count} expired sessions`);
}, 60 * 60 * 1000); // Every hour
```

### Problem: Token validation slow
**Solution**: Add database indexes (already in migration) or implement caching

---

## Future Enhancements

1. **Remember Me** - Extend session duration to 30 days
2. **Session Management UI** - Show active devices, logout remotely
3. **IP-based Security** - Alert on login from new IP
4. **Concurrent Session Limit** - Max 5 devices per user
5. **Activity Timeline** - Show login history

---

## Summary

This implementation provides:
- ✅ Server-side session validation
- ✅ Multi-device support
- ✅ Session revocation
- ✅ Token refresh
- ✅ Security against session hijacking
- ✅ Backward compatible migration
- ✅ Performance optimized with indexes

Next steps: Run the migration and update authService.ts!
