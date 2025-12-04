/**
 * Authentication Service
 *
 * Handles all authentication-related operations:
 * - Login/logout
 * - Session management
 * - Password hashing and verification
 * - Account lockout
 * - Token generation (for future JWT implementation)
 *
 * Security Features:
 * - Passwords are hashed using SHA-256 (will migrate to bcrypt with backend)
 * - Account lockout after failed attempts
 * - Session expiration
 * - "Remember me" functionality
 */

import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';
import {
  User,
  PublicUser,
  LoginCredentials,
  LoginResponse,
  AuthSession,
  ChangePasswordRequest,
  DEFAULT_SECURITY_SETTINGS,
  SecuritySettings,
} from '../types/auth';
import {
  createSession as createServerSession,
  revokeSession,
  getDeviceInfo,
  refreshSession as refreshServerSession,
  getSessionByToken,
  isSessionExpired as isServerSessionExpired,
  sessionNeedsRefresh as serverSessionNeedsRefresh,
} from './sessionService';
import { logAuthEvent, logSystemEvent } from './activityLogService';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  SESSION: 'wif_auth_session',
  SETTINGS: 'wif_security_settings',
} as const;

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

/**
 * BCRYPT SALT ROUNDS
 * 12 rounds provides excellent security while maintaining reasonable performance
 * Increases with hardware improvements over time
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt (SECURE)
 * This is the recommended method for all new passwords
 *
 * @param password - The plain text password to hash
 * @returns Promise<string> - The bcrypt hash (format: $2a$12$...)
 */
export async function hashPasswordAsync(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash (SECURE)
 *
 * @param password - The plain text password to verify
 * @param hash - The bcrypt hash to verify against
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPasswordAsync(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * LEGACY: Hash a password using SHA-256
 *
 * WARNING: This is INSECURE and only kept for backward compatibility
 * during migration. All new passwords should use hashPasswordAsync()
 *
 * @deprecated Use hashPasswordAsync() instead
 */
export function hashPasswordLegacy(password: string): string {
  // Add salt for extra security
  const salt = 'WIF_FINANCE_SALT_2025';
  const salted = password + salt;
  return CryptoJS.SHA256(salted).toString();
}

/**
 * LEGACY: Verify a password against a SHA-256 hash
 *
 * WARNING: This is INSECURE and only kept for backward compatibility
 * during migration. All new passwords should use verifyPasswordAsync()
 *
 * @deprecated Use verifyPasswordAsync() instead
 */
export function verifyPasswordLegacy(password: string, hash: string): boolean {
  const hashedInput = hashPasswordLegacy(password);
  return hashedInput === hash;
}

/**
 * Detect if a password hash is a legacy SHA-256 hash
 *
 * SHA-256 hashes are exactly 64 hexadecimal characters
 * Bcrypt hashes start with $2a$, $2b$, or $2y$ and are longer
 *
 * @param hash - The password hash to check
 * @returns boolean - True if this is a legacy SHA-256 hash
 */
export function isLegacyHash(hash: string): boolean {
  // SHA-256 produces 64 hex characters
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Migrate a user's password from SHA-256 to bcrypt
 *
 * MIGRATION STRATEGY:
 * This function is called during login when we detect a legacy hash.
 * If the user's password is valid, we rehash it with bcrypt and return
 * the new hash. The caller is responsible for saving it to the database.
 *
 * This allows seamless migration - users don't need to reset passwords,
 * and they're automatically upgraded on their next successful login.
 *
 * @param userId - The ID of the user (for logging purposes)
 * @param password - The plain text password entered during login
 * @param currentHash - The current password hash from the database
 * @returns Promise<string | null> - New bcrypt hash if migration needed, null otherwise
 */
export async function migratePasswordIfNeeded(
  userId: string,
  password: string,
  currentHash: string
): Promise<string | null> {
  // Check if this is a legacy hash
  if (!isLegacyHash(currentHash)) {
    // Already using bcrypt, no migration needed
    return null;
  }

  // Verify the password using legacy method
  if (!verifyPasswordLegacy(password, currentHash)) {
    // Password doesn't match, cannot migrate
    return null;
  }

  // Password is valid! Generate new bcrypt hash
  const newHash = await hashPasswordAsync(password);

  console.log(`Migrating password for user ${userId} from SHA-256 to bcrypt`);

  return newHash;
}

/**
 * Verify password with automatic format detection
 *
 * This function automatically detects whether the hash is legacy SHA-256
 * or modern bcrypt, and uses the appropriate verification method.
 *
 * @param password - The plain text password to verify
 * @param hash - The password hash (either SHA-256 or bcrypt)
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPasswordAuto(password: string, hash: string): Promise<boolean> {
  if (isLegacyHash(hash)) {
    return verifyPasswordLegacy(password, hash);
  } else {
    return verifyPasswordAsync(password, hash);
  }
}

// Backward compatibility: Keep synchronous functions but mark as deprecated
/**
 * @deprecated Use hashPasswordAsync() instead
 */
export function hashPassword(password: string): string {
  console.warn('hashPassword() is deprecated and INSECURE. Use hashPasswordAsync() instead.');
  return hashPasswordLegacy(password);
}

/**
 * @deprecated Use verifyPasswordAuto() or verifyPasswordAsync() instead
 */
export function verifyPassword(password: string, hash: string): boolean {
  console.warn('verifyPassword() is deprecated. Use verifyPasswordAuto() or verifyPasswordAsync() instead.');
  return verifyPasswordLegacy(password, hash);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  // Check length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Determine strength
  if (errors.length === 0) {
    if (password.length >= 12) {
      strength = 'strong';
    } else {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Generate a unique session token
 */
function generateSessionToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `session_${timestamp}_${random}`;
}

/**
 * Create a new session for a user
 */
export function createSession(user: PublicUser, rememberMe: boolean = false): AuthSession {
  const settings = getSecuritySettings();
  const now = new Date();
  const expiresAt = new Date(now);

  if (rememberMe) {
    // Remember me: extend session for configured days
    expiresAt.setDate(expiresAt.getDate() + settings.rememberMeTimeoutDays);
  } else {
    // Regular session: configured minutes
    expiresAt.setMinutes(expiresAt.getMinutes() + settings.sessionTimeoutMinutes);
  }

  const session: AuthSession = {
    user,
    token: generateSessionToken(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rememberMe,
  };

  return session;
}

/**
 * Save session to localStorage
 */
export function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

/**
 * Get current session from localStorage
 */
export function getSession(): AuthSession | null {
  const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as AuthSession;

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    if (now > expiresAt) {
      // Session expired
      clearSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to parse session:', error);
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

/**
 * Refresh session expiration
 * Called on user activity to extend session
 */
export function refreshSession(): void {
  const session = getSession();
  if (!session) return;

  const settings = getSecuritySettings();
  const expiresAt = new Date();

  if (session.rememberMe) {
    expiresAt.setDate(expiresAt.getDate() + settings.rememberMeTimeoutDays);
  } else {
    expiresAt.setMinutes(expiresAt.getMinutes() + settings.sessionTimeoutMinutes);
  }

  session.expiresAt = expiresAt.toISOString();
  saveSession(session);
}

// ============================================================================
// SECURITY SETTINGS
// ============================================================================

/**
 * Get security settings
 */
export function getSecuritySettings(): SecuritySettings {
  const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!stored) {
    return DEFAULT_SECURITY_SETTINGS;
  }

  try {
    return JSON.parse(stored) as SecuritySettings;
  } catch (error) {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

/**
 * Update security settings
 */
export function updateSecuritySettings(settings: Partial<SecuritySettings>): void {
  const current = getSecuritySettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
}

/**
 * Update security settings with activity logging
 * Use this when you have access to the user context
 */
export function updateSecuritySettingsWithLogging(
  settings: Partial<SecuritySettings>,
  user: PublicUser
): void {
  const current = getSecuritySettings();

  // Calculate what changed
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const settingLabels: Record<keyof SecuritySettings, string> = {
    maxFailedAttempts: 'Max Failed Login Attempts',
    lockoutDurationMinutes: 'Lockout Duration (minutes)',
    sessionTimeoutMinutes: 'Session Timeout (minutes)',
    rememberMeTimeoutDays: 'Remember Me Timeout (days)',
    passwordExpiryDays: 'Password Expiry (days)',
  };

  (Object.keys(settings) as Array<keyof SecuritySettings>).forEach((key) => {
    if (settings[key] !== undefined && settings[key] !== current[key]) {
      changes[settingLabels[key] || key] = {
        from: current[key],
        to: settings[key],
      };
    }
  });

  // Update settings
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

  // Log the change
  const changedFieldNames = Object.keys(changes);
  if (changedFieldNames.length > 0) {
    logSystemEvent(
      'system:settings_changed',
      user,
      `${user.fullName} updated security settings: ${changedFieldNames.join(', ')}`,
      {
        settingsType: 'security',
        changes,
        newValues: updated,
      }
    );
  }
}

// ============================================================================
// AUTHENTICATION LOGIC
// ============================================================================

/**
 * Login a user
 */
export async function login(
  credentials: LoginCredentials,
  users: User[]
): Promise<LoginResponse> {
  const { usernameOrEmail, password, rememberMe = false } = credentials;

  // Find user by username or email (case-insensitive)
  const user = users.find(
    (u) =>
      u.username.toLowerCase() === usernameOrEmail.toLowerCase() ||
      u.email.toLowerCase() === usernameOrEmail.toLowerCase()
  );

  // User not found
  if (!user) {
    return {
      success: false,
      error: 'Invalid username or password',
      errorCode: 'INVALID_CREDENTIALS',
    };
  }

  // Check if account is locked
  if (user.lockedUntil) {
    const lockedUntil = new Date(user.lockedUntil);
    const now = new Date();

    if (now < lockedUntil) {
      const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
      return {
        success: false,
        error: `Account is locked. Try again in ${minutesRemaining} minute(s)`,
        errorCode: 'ACCOUNT_LOCKED',
      };
    }
  }

  // Check if account is active
  if (!user.isActive) {
    return {
      success: false,
      error: 'Account is inactive. Please contact your administrator',
      errorCode: 'ACCOUNT_INACTIVE',
    };
  }

  // Verify password (supports both legacy SHA-256 and modern bcrypt)
  if (!user.passwordHash || !(await verifyPasswordAuto(password, user.passwordHash))) {
    return {
      success: false,
      error: 'Invalid username or password',
      errorCode: 'INVALID_CREDENTIALS',
    };
  }

  // Check if password needs migration from SHA-256 to bcrypt
  const migratedHash = await migratePasswordIfNeeded(user.id, password, user.passwordHash);

  // Success! Create server-side session
  const publicUser: PublicUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  try {
    // Create server-side session with rememberMe flag
    const deviceInfo = getDeviceInfo();
    const sessionToken = await createServerSession(
      user.id,
      deviceInfo,
      {
        username: user.username,
        fullName: user.fullName,
      },
      rememberMe
    );

    // Store session data in localStorage
    const settings = getSecuritySettings();
    const expiresAt = new Date();

    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + settings.rememberMeTimeoutDays);
    } else {
      expiresAt.setMinutes(expiresAt.getMinutes() + settings.sessionTimeoutMinutes);
    }

    const session: AuthSession = {
      user: publicUser,
      token: sessionToken.token,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      rememberMe,
    };

    // Also store refresh token
    const sessionData = {
      ...session,
      refreshToken: sessionToken.refreshToken,
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));

    return {
      success: true,
      session,
      migratedPasswordHash: migratedHash || undefined,
      userId: user.id,
    };
  } catch (error) {
    console.error('Failed to create server-side session:', error);
    return {
      success: false,
      error: 'Failed to create session. Please try again.',
      errorCode: 'SESSION_ERROR',
    };
  }
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  // Get session token before clearing
  const session = getSession();

  if (session) {
    try {
      // Revoke server-side session with user info for logging
      await revokeSession(session.token, {
        id: session.user.id,
        username: session.user.username,
        fullName: session.user.fullName,
      }, 'user_logout');
    } catch (error) {
      console.error('Failed to revoke server-side session:', error);
      // Continue with client-side logout even if server-side fails
    }
  }

  // Clear client-side session
  clearSession();
}

/**
 * Get current user from session
 */
export function getCurrentUser(): PublicUser | null {
  const session = getSession();
  return session?.user || null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  request: ChangePasswordRequest,
  users: User[]
): Promise<{ success: boolean; error?: string }> {
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Verify current password (supports both legacy SHA-256 and modern bcrypt)
  if (!user.passwordHash || !(await verifyPasswordAuto(request.currentPassword, user.passwordHash))) {
    return { success: false, error: 'Current password is incorrect' };
  }

  // Validate new password matches confirmation
  if (request.newPassword !== request.confirmPassword) {
    return { success: false, error: 'New passwords do not match' };
  }

  // Validate password strength
  const validation = validatePasswordStrength(request.newPassword);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('. ') };
  }

  // Success - password will be hashed by caller using hashPasswordAsync
  return { success: true };
}

/**
 * Reset password (admin function)
 */
export function resetPassword(
  userId: string,
  newPassword: string,
  users: User[]
): { success: boolean; error?: string } {
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Validate password strength
  const validation = validatePasswordStrength(newPassword);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('. ') };
  }

  return { success: true };
}

// ============================================================================
// ACCOUNT LOCKOUT
// ============================================================================

/**
 * Handle failed login attempt
 * Returns updated user with incremented failed attempts and potential lockout
 */
export function handleFailedLogin(user: User): User {
  const settings = getSecuritySettings();
  const failedAttempts = user.failedLoginAttempts + 1;

  // Check if we should lock the account
  if (failedAttempts >= settings.maxFailedAttempts) {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + settings.lockoutDurationMinutes);

    // Log account locked event
    logAuthEvent('auth:account_locked', {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdBy: user.createdBy,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }, {
      failedAttemptCount: failedAttempts,
      maxAttempts: settings.maxFailedAttempts,
      lockedUntil: lockedUntil.toISOString(),
      lockoutDurationMinutes: settings.lockoutDurationMinutes,
    });

    // Note: Caller should update this in Supabase using updateUserLoginAttempts
    return {
      ...user,
      failedLoginAttempts: failedAttempts,
      lockedUntil: lockedUntil.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Note: Caller should update this in Supabase using updateUserLoginAttempts
  return {
    ...user,
    failedLoginAttempts: failedAttempts,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Handle successful login
 * Returns updated user with reset failed attempts and updated last login
 */
export function handleSuccessfulLogin(user: User): User {
  // Note: Caller should update this in Supabase using updateUserLastLogin
  return {
    ...user,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    lastLogin: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Unlock user account (admin function)
 */
export function unlockAccount(user: User, unlockedBy?: PublicUser): User {
  // Log account unlocked event
  logAuthEvent('auth:account_unlocked', {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }, {
    previousFailedAttempts: user.failedLoginAttempts,
    previousLockedUntil: user.lockedUntil,
    unlockedBy: unlockedBy ? {
      id: unlockedBy.id,
      username: unlockedBy.username,
      fullName: unlockedBy.fullName,
    } : 'system',
  });

  return {
    ...user,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Check if system has been initialized with a first user
 */
export function isSystemInitialized(users: User[]): boolean {
  return users.length > 0;
}

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  return `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// SESSION VALIDATION AND REFRESH
// ============================================================================

/**
 * Validate and refresh session on app startup
 * This function checks if the current session is valid and attempts to refresh it if needed
 *
 * @returns Promise<AuthSession | null> - Valid session or null if session cannot be restored
 */
export async function validateAndRefreshSession(): Promise<AuthSession | null> {
  try {
    // Get session from localStorage
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!stored) {
      console.log('No stored session found');
      return null;
    }

    const sessionData = JSON.parse(stored) as AuthSession & { refreshToken?: string };

    // Check if we have a refresh token
    if (!sessionData.refreshToken) {
      console.log('No refresh token found in session');
      clearSession();
      return null;
    }

    // Get the server-side session
    const serverSession = await getSessionByToken(sessionData.token);

    if (!serverSession) {
      console.log('Server session not found');
      // Try to refresh using refresh token
      return await attemptSessionRefresh(sessionData.refreshToken, sessionData);
    }

    // Check if session is expired
    if (isServerSessionExpired(serverSession)) {
      console.log('Session has expired, attempting refresh');
      return await attemptSessionRefresh(sessionData.refreshToken, sessionData);
    }

    // Check if session needs refresh (within 5 minutes of expiry)
    if (serverSessionNeedsRefresh(serverSession)) {
      console.log('Session needs refresh, attempting proactive refresh');
      const refreshed = await attemptSessionRefresh(sessionData.refreshToken, sessionData);
      if (refreshed) {
        return refreshed;
      }
      // If refresh fails but session is still valid, continue with current session
      console.log('Refresh failed but session still valid, continuing');
    }

    // Session is valid, return it
    return sessionData;
  } catch (error) {
    console.error('Error validating session:', error);
    clearSession();
    return null;
  }
}

/**
 * Attempt to refresh a session using refresh token
 *
 * @param refreshToken - The refresh token to use
 * @param currentSession - The current session data
 * @returns Promise<AuthSession | null> - New session or null if refresh failed
 */
async function attemptSessionRefresh(
  refreshToken: string,
  currentSession: AuthSession
): Promise<AuthSession | null> {
  try {
    console.log('Attempting to refresh session');

    // Call server to refresh session
    const newSessionToken = await refreshServerSession(refreshToken);

    if (!newSessionToken) {
      console.error('Failed to refresh session - refresh token invalid or expired');
      clearSession();
      return null;
    }

    console.log('Session refreshed successfully');

    // Create new session object with updated tokens
    const settings = getSecuritySettings();
    const now = new Date();
    const expiresAt = new Date(now);

    if (currentSession.rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + settings.rememberMeTimeoutDays);
    } else {
      expiresAt.setMinutes(expiresAt.getMinutes() + settings.sessionTimeoutMinutes);
    }

    const newSession: AuthSession = {
      user: currentSession.user,
      token: newSessionToken.token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rememberMe: currentSession.rememberMe,
    };

    // Store new session with refresh token
    const sessionData = {
      ...newSession,
      refreshToken: newSessionToken.refreshToken,
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));

    return newSession;
  } catch (error) {
    console.error('Error refreshing session:', error);
    clearSession();
    return null;
  }
}

/**
 * Check if current session is valid
 * Lightweight check without server validation
 *
 * @returns boolean - True if session exists and hasn't expired locally
 */
export function isSessionValid(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!stored) return false;

    const session = JSON.parse(stored) as AuthSession;
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    return now <= expiresAt;
  } catch (error) {
    console.error('Error checking session validity:', error);
    return false;
  }
}
