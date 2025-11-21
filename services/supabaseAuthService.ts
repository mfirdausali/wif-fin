// @ts-nocheck
/**
 * Supabase Authentication Service
 *
 * Handles all authentication using Supabase Auth + custom user profiles
 */

import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { PublicUser, UserRole } from '../types/auth';

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
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create account',
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
    await supabase
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id);

    return {
      success: true,
      user: profile,
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'Invalid credentials',
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

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
      lastLogin: data.last_login,
      createdBy: data.created_by,
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

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
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await getUserProfile(session.user.id);
      callback(profile);
    } else {
      callback(null);
    }
  });
}
