/**
 * Session Service - Server-side session validation
 *
 * Provides secure session management with server-side validation:
 * - Create sessions on login
 * - Validate sessions on requests
 * - Refresh tokens
 * - Revoke sessions on logout/security events
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import CryptoJS from 'crypto-js';
import { logAuthEvent } from './activityLogService';

type SessionRow = Database['public']['Tables']['sessions']['Row'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['sessions']['Update'];

// Type guard to ensure types are used
function isSessionRow(_row: SessionRow | null): boolean {
  return true;
}
isSessionRow(null); // Call to prevent unused warning

// ============================================================================
// TYPES
// ============================================================================

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  refreshTokenHash: string | null;
  deviceInfo: {
    userAgent?: string;
    ipAddress?: string;
    deviceName?: string;
  };
  lastActivity: string;
  expiresAt: string;
  createdAt: string;
}

export interface SessionToken {
  sessionId: string;
  token: string;      // Random token (not stored, only hash stored)
  refreshToken?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Access token lifetime: 1 hour
const ACCESS_TOKEN_DURATION = 60 * 60 * 1000; // 1 hour (3600 seconds)

// Refresh token lifetime: 7 days by default
const REFRESH_TOKEN_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Remember me extends refresh token to 30 days
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// Refresh grace period: refresh within 5 minutes of expiry
const REFRESH_GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes

const TOKEN_LENGTH = 64; // 64 bytes = 512 bits

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate cryptographically secure random token
 */
function generateToken(): string {
  return CryptoJS.lib.WordArray.random(TOKEN_LENGTH).toString();
}

/**
 * Hash token using SHA-256
 */
function hashToken(token: string): string {
  return CryptoJS.SHA256(token).toString();
}

// ============================================================================
// SESSION CREATION
// ============================================================================

/**
 * Create a new session on login
 */
export async function createSession(
  userId: string,
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
    deviceName?: string;
  },
  userInfo?: {
    username: string;
    fullName?: string;
  },
  rememberMe: boolean = false
): Promise<SessionToken> {
  try {
    // Generate tokens
    const token = generateToken();
    const refreshToken = generateToken();
    const tokenHash = hashToken(token);
    const refreshTokenHash = hashToken(refreshToken);

    // Calculate expiry based on remember me option
    const now = Date.now();
    // Access token always expires in 1 hour
    const expiresAt = new Date(now + ACCESS_TOKEN_DURATION).toISOString();

    // Insert session into database with metadata
    const sessionInsert: SessionInsert = {
      user_id: userId,
      token_hash: tokenHash,
      refresh_token_hash: refreshTokenHash,
      device_info: {
        ...(deviceInfo || {}),
        rememberMe,
        refreshTokenExpiresAt: new Date(
          now + (rememberMe ? REMEMBER_ME_DURATION : REFRESH_TOKEN_DURATION)
        ).toISOString(),
      },
      expires_at: expiresAt,
      last_activity: new Date().toISOString(),
    };

    const { data, error } = await (supabase
      .from('sessions') as any)
      .insert(sessionInsert)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create session - no data returned');

    // Log session created event
    if (userInfo) {
      logAuthEvent('auth:session_created', {
        id: userId,
        username: userInfo.username,
        email: '',
        fullName: userInfo.fullName || userInfo.username,
        role: 'viewer',
        isActive: true,
        createdBy: 'system',
        createdAt: '',
        updatedAt: '',
      }, {
        sessionId: (data as SessionRow).id,
        deviceInfo: deviceInfo || {},
        expiresAt,
        rememberMe,
        accessTokenDuration: ACCESS_TOKEN_DURATION / 1000, // in seconds
        refreshTokenDuration: (rememberMe ? REMEMBER_ME_DURATION : REFRESH_TOKEN_DURATION) / 1000, // in seconds
      });
    }

    return {
      sessionId: (data as SessionRow).id,
      token,
      refreshToken,
    };
  } catch (error) {
    console.error('Failed to create session:', error);
    throw new Error('Failed to create session');
  }
}

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Validate a session token
 * Returns user ID if valid, null if invalid
 */
export async function validateSession(token: string): Promise<string | null> {
  try {
    const tokenHash = hashToken(token);

    // Query session from database
    const { data, error } = await supabase
      .from('sessions')
      .select('id, user_id, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !data) {
      return null;
    }

    const sessionData = data as Pick<SessionRow, 'id' | 'user_id' | 'expires_at'>;

    // Check if session expired
    if (new Date(sessionData.expires_at) < new Date()) {
      // Session expired, delete it
      await revokeSessionById(sessionData.id);
      return null;
    }

    // Update last activity
    const sessionUpdate: SessionUpdate = { last_activity: new Date().toISOString() };
    await (supabase
      .from('sessions') as any)
      .update(sessionUpdate)
      .eq('id', sessionData.id);

    return sessionData.user_id;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: Session): boolean {
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  return now > expiresAt;
}

/**
 * Check if session needs refresh (within 5 minutes of expiry)
 */
export function sessionNeedsRefresh(session: Session): boolean {
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  // Session needs refresh if it expires within the grace period
  return timeUntilExpiry > 0 && timeUntilExpiry <= REFRESH_GRACE_PERIOD;
}

/**
 * Get session by token (for validation and refresh operations)
 */
export async function getSessionByToken(token: string): Promise<Session | null> {
  try {
    const tokenHash = hashToken(token);

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !data) {
      return null;
    }

    const sessionData = data as SessionRow;

    return {
      id: sessionData.id,
      userId: sessionData.user_id,
      tokenHash: sessionData.token_hash,
      refreshTokenHash: sessionData.refresh_token_hash,
      deviceInfo: sessionData.device_info as { userAgent?: string; ipAddress?: string; deviceName?: string },
      lastActivity: sessionData.last_activity,
      expiresAt: sessionData.expires_at,
      createdAt: sessionData.created_at,
    };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

// ============================================================================
// SESSION REFRESH
// ============================================================================

/**
 * Refresh a session using refresh token
 * Implements single-use token rotation for security
 */
export async function refreshSession(
  refreshToken: string
): Promise<SessionToken | null> {
  try {
    const refreshTokenHash = hashToken(refreshToken);

    // Find session by refresh token
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('refresh_token_hash', refreshTokenHash)
      .single();

    if (error || !session) {
      console.error('Refresh token not found or invalid');
      return null;
    }

    const sessionData = session as SessionRow;
    const deviceInfo = sessionData.device_info as {
      userAgent?: string;
      ipAddress?: string;
      deviceName?: string;
      rememberMe?: boolean;
      refreshTokenExpiresAt?: string;
    };

    // Check if refresh token has expired
    if (deviceInfo.refreshTokenExpiresAt) {
      const refreshExpiresAt = new Date(deviceInfo.refreshTokenExpiresAt);
      if (new Date() > refreshExpiresAt) {
        console.error('Refresh token has expired');
        // Revoke the session
        await revokeSessionById(sessionData.id);
        return null;
      }
    }

    // Revoke old session (single-use token)
    await revokeSessionById(sessionData.id);

    // Log session refresh event
    logAuthEvent('auth:session_created', {
      id: sessionData.user_id,
      username: 'user',
      email: '',
      fullName: 'User',
      role: 'viewer',
      isActive: true,
      createdBy: 'system',
      createdAt: '',
      updatedAt: '',
    }, {
      reason: 'session_refreshed',
      previousSessionId: sessionData.id,
      deviceInfo,
    });

    // Create new session with new tokens (token rotation)
    return await createSession(
      sessionData.user_id,
      {
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ipAddress,
        deviceName: deviceInfo.deviceName,
      },
      undefined,
      deviceInfo.rememberMe || false
    );
  } catch (error) {
    console.error('Session refresh error:', error);
    return null;
  }
}

// ============================================================================
// SESSION REVOCATION
// ============================================================================

/**
 * Revoke a specific session by token
 */
export async function revokeSession(
  token: string,
  userInfo?: {
    id: string;
    username: string;
    fullName?: string;
  },
  reason?: string
): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);

    // Get session info before deleting (for logging)
    let sessionUserId: string | null = null;
    if (!userInfo) {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('user_id')
        .eq('token_hash', tokenHash)
        .single();
      if (sessionData) {
        sessionUserId = (sessionData as Pick<SessionRow, 'user_id'>).user_id;
      }
    }

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('token_hash', tokenHash);

    if (!error) {
      // Log session revoked event
      const logUser = userInfo || (sessionUserId ? { id: sessionUserId, username: 'unknown' } : null);
      if (logUser) {
        logAuthEvent('auth:session_revoked', {
          id: logUser.id,
          username: logUser.username,
          email: '',
          fullName: logUser.fullName || logUser.username,
          role: 'viewer',
          isActive: true,
          createdBy: 'system',
          createdAt: '',
          updatedAt: '',
        }, {
          reason: reason || 'logout',
          revokedAt: new Date().toISOString(),
        });
      }
    }

    return !error;
  } catch (error) {
    console.error('Failed to revoke session:', error);
    return false;
  }
}

/**
 * Revoke a specific session by ID
 */
async function revokeSessionById(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    return !error;
  } catch (error) {
    console.error('Failed to revoke session:', error);
    return false;
  }
}

/**
 * Revoke all sessions for a user
 * Use on password change, security events
 */
export async function revokeAllUserSessions(
  userId: string,
  userInfo?: {
    username: string;
    fullName?: string;
  },
  reason?: string
): Promise<boolean> {
  try {
    // Get count of sessions before deleting (for logging)
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId);

    if (!error && userInfo) {
      // Log session revoked event for all sessions
      logAuthEvent('auth:session_revoked', {
        id: userId,
        username: userInfo.username,
        email: '',
        fullName: userInfo.fullName || userInfo.username,
        role: 'viewer',
        isActive: true,
        createdBy: 'system',
        createdAt: '',
        updatedAt: '',
      }, {
        reason: reason || 'all_sessions_revoked',
        sessionsRevoked: count || 0,
        revokedAt: new Date().toISOString(),
      });
    }

    return !error;
  } catch (error) {
    console.error('Failed to revoke all sessions:', error);
    return false;
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('last_activity', { ascending: false });

    if (error) throw error;

    return (data as SessionRow[]).map(session => ({
      id: session.id,
      userId: session.user_id,
      tokenHash: session.token_hash,
      refreshTokenHash: session.refresh_token_hash,
      deviceInfo: session.device_info as { userAgent?: string; ipAddress?: string; deviceName?: string },
      lastActivity: session.last_activity,
      expiresAt: session.expires_at,
      createdAt: session.created_at,
    }));
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Cleanup expired sessions
 * Should be called periodically (cron job or on app startup)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;

    return data?.length || 0;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get device fingerprint from request
 */
export function getDeviceInfo(): {
  userAgent?: string;
  deviceName?: string;
} {
  return {
    userAgent: navigator.userAgent,
    deviceName: getDeviceName(),
  };
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'Mobile Device';
  if (/tablet|ipad/i.test(ua)) return 'Tablet';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/mac/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown Device';
}
