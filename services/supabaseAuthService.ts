/**
 * Supabase Authentication Service
 *
 * Handles all authentication using Supabase Auth + custom user profiles
 *
 * NOTE: This service is designed for Supabase Auth integration with a separate
 * user_profiles table. The current application uses a custom auth implementation
 * with a 'users' table instead. This file is kept for potential future migration
 * to Supabase Auth.
 */

import { supabase } from '../lib/supabase';
import type { PublicUser, UserRole } from '../types/auth';

// Type for user_profiles table (not in current schema, but needed for this service)
interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Sign up a new user (first-time setup)
 */
export async function signUp(
  email: string,
  password: string,
  metadata: {
    username: string;
    full_name: string;
    role: UserRole;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) throw error;

    if (!data.user) {
      throw new Error('Failed to create user');
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create account',
    };
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; user?: PublicUser; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (!data.user) {
      throw new Error('Invalid credentials');
    }

    // Get user profile
    const profile = await getUserProfile(data.user.id);

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Update last login
    // Note: user_profiles table doesn't exist in current schema
    // This would need the table to be created for Supabase Auth integration
    await (supabase
      .from('user_profiles' as 'users') // Type assertion for non-existent table
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id) as unknown as Promise<unknown>);

    return {
      success: true,
      user: profile,
    };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid credentials',
    };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get current session user
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    return await getUserProfile(user.id);
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

// ============================================================================
// USER PROFILES
// ============================================================================

/**
 * Get user profile by ID
 */
async function getUserProfile(userId: string): Promise<PublicUser | null> {
  try {
    // Note: user_profiles table doesn't exist in current schema
    // This would need the table to be created for Supabase Auth integration
    const { data, error } = await (supabase
      .from('user_profiles' as 'users') // Type assertion for non-existent table
      .select('*')
      .eq('id', userId)
      .single() as unknown as Promise<{ data: UserProfile | null; error: Error | null }>);

    if (error) throw error;

    if (!data) return null;

    // Get email from auth.users
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      id: data.id,
      username: data.username,
      email: user?.email || '',
      fullName: data.full_name,
      role: data.role as UserRole,
      isActive: data.is_active,
      lastLogin: data.last_login ?? undefined,
      createdBy: data.created_by ?? '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
}

/**
 * Check if system is initialized (has any users)
 */
export async function isSystemInitialized(): Promise<boolean> {
  try {
    // Note: user_profiles table doesn't exist in current schema
    // This would need the table to be created for Supabase Auth integration
    const { data, error } = await (supabase
      .from('user_profiles' as 'users') // Type assertion for non-existent table
      .select('id')
      .limit(1) as unknown as Promise<{ data: Array<{ id: string }> | null; error: Error | null }>);

    if (error) throw error;

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('Check initialization error:', error);
    return false;
  }
}

/**
 * Create initial administrator account
 */
export async function createInitialAdmin(
  username: string,
  email: string,
  fullName: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  // Check if system is already initialized
  const initialized = await isSystemInitialized();
  if (initialized) {
    return { success: false, error: 'System already initialized' };
  }

  return signUp(email, password, {
    username,
    full_name: fullName,
    role: 'admin',
  });
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(
  callback: (user: PublicUser | null) => void
) {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const profile = await getUserProfile(session.user.id);
      callback(profile);
    } else {
      callback(null);
    }
  });
}
