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
 * Hash a password using SHA-256
 * Note: In production with a backend, use bcrypt or argon2
 */
export function hashPassword(password: string): string {
  // Add salt for extra security
  const salt = 'WIF_FINANCE_SALT_2025';
  const salted = password + salt;
  return CryptoJS.SHA256(salted).toString();
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const hashedInput = hashPassword(password);
  return hashedInput === hash;
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

  // Verify password
  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return {
      success: false,
      error: 'Invalid username or password',
      errorCode: 'INVALID_CREDENTIALS',
    };
  }

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
    // Create server-side session
    const deviceInfo = getDeviceInfo();
    const sessionToken = await createServerSession(user.id, deviceInfo, {
      username: user.username,
      fullName: user.fullName,
    });

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
export function changePassword(
  userId: string,
  request: ChangePasswordRequest,
  users: User[]
): { success: boolean; error?: string } {
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Verify current password
  if (!user.passwordHash || !verifyPassword(request.currentPassword, user.passwordHash)) {
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

  // Success - password will be hashed by caller
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
