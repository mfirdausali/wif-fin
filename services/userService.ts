// @ts-nocheck
/**
 * User Management Service (Supabase Version)
 *
 * Handles all user-related operations using Supabase
 */

import { supabase } from '../lib/supabase';
import {
  User,
  PublicUser,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
} from '../types/auth';
import { hashPassword, generateUserId, validatePasswordStrength } from './authService';

// ============================================================================
// USER DATA PERSISTENCE (SUPABASE)
// ============================================================================

/**
 * Load all users from Supabase
 */
export async function loadUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(dbUserToUser);
  } catch (error) {
    console.error('Failed to load users:', error);
    return [];
  }
}

/**
 * Save users to Supabase (bulk update - rarely used)
 */
export async function saveUsers(users: User[]): Promise<void> {
  // This function is kept for compatibility but not recommended
  // Use individual CRUD operations instead
  console.warn('saveUsers: Bulk operations not recommended with Supabase');
}

/**
 * Convert User to PublicUser (remove sensitive fields)
 */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash, failedLoginAttempts, lockedUntil, ...publicUser } = user;
  return publicUser as PublicUser;
}

// ============================================================================
// USER CRUD OPERATIONS
// ============================================================================

/**
 * Get all users (public info only)
 */
export async function getAllUsers(): Promise<PublicUser[]> {
  const users = await loadUsers();
  return users.map(toPublicUser);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data ? dbUserToUser(data) : null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .single();

    if (error) throw error;
    return data ? dbUserToUser(data) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();

    if (error) throw error;
    return data ? dbUserToUser(data) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(
  request: CreateUserRequest,
  createdByUserId: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  // Validate username
  if (!request.username || request.username.trim().length < 3) {
    return { success: false, error: 'Username must be at least 3 characters' };
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_]+$/.test(request.username)) {
    return {
      success: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  // Check if username already exists
  if (await getUserByUsername(request.username)) {
    return { success: false, error: 'Username already exists' };
  }

  // Validate email
  if (!request.email || !isValidEmail(request.email)) {
    return { success: false, error: 'Invalid email address' };
  }

  // Check if email already exists
  if (await getUserByEmail(request.email)) {
    return { success: false, error: 'Email already exists' };
  }

  // Validate full name
  if (!request.fullName || request.fullName.trim().length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters' };
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(request.password);
  if (!passwordValidation.isValid) {
    return { success: false, error: passwordValidation.errors.join('. ') };
  }

  try {
    // Get default company ID
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (!companies) {
      return { success: false, error: 'No company found' };
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        company_id: companies.id,
        username: request.username.toLowerCase(),
        email: request.email.toLowerCase(),
        full_name: request.fullName.trim(),
        password_hash: hashPassword(request.password),
        role: request.role,
        is_active: true,
        failed_login_attempts: 0,
        created_by: createdByUserId,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, user: dbUserToUser(data) };
  } catch (error: any) {
    console.error('Failed to create user:', error);
    return { success: false, error: error.message || 'Failed to create user' };
  }
}

/**
 * Update an existing user
 */
export async function updateUser(
  userId: string,
  updates: UpdateUserRequest
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Validate email if being updated
    if (updates.email) {
      if (!isValidEmail(updates.email)) {
        return { success: false, error: 'Invalid email address' };
      }

      const existingUser = await getUserByEmail(updates.email);
      if (existingUser && existingUser.id !== userId) {
        return { success: false, error: 'Email already exists' };
      }
    }

    // Validate full name if being updated
    if (updates.fullName !== undefined && updates.fullName.trim().length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters' };
    }

    const updateData: any = {};
    if (updates.email) updateData.email = updates.email.toLowerCase();
    if (updates.fullName) updateData.full_name = updates.fullName.trim();
    if (updates.role) updateData.role = updates.role;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, user: dbUserToUser(data) };
  } catch (error: any) {
    console.error('Failed to update user:', error);
    return { success: false, error: error.message || 'Failed to update user' };
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const allUsers = await loadUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin' && u.isActive).length;
      if (adminCount <= 1) {
        return { success: false, error: 'Cannot delete the last admin user' };
      }
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    return { success: false, error: error.message || 'Failed to delete user' };
  }
}

/**
 * Activate a user account
 */
export async function activateUser(userId: string): Promise<{ success: boolean; user?: User; error?: string }> {
  return updateUser(userId, { isActive: true });
}

/**
 * Deactivate a user account
 */
export async function deactivateUser(
  userId: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Prevent deactivating the last admin
    if (user.role === 'admin') {
      const allUsers = await loadUsers();
      const activeAdminCount = allUsers.filter((u) => u.role === 'admin' && u.isActive).length;
      if (activeAdminCount <= 1) {
        return { success: false, error: 'Cannot deactivate the last admin user' };
      }
    }

    return updateUser(userId, { isActive: false });
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to deactivate user' };
  }
}

/**
 * Update user password
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Validate password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('. ') };
    }

    const { error } = await supabase
      .from('users')
      .update({ password_hash: hashPassword(newPassword) })
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update password:', error);
    return { success: false, error: error.message || 'Failed to update password' };
  }
}

/**
 * Update user after failed login
 */
export async function updateUserLoginAttempts(
  userId: string,
  attempts: number,
  lockedUntil?: string
): Promise<void> {
  try {
    const updateData: any = { failed_login_attempts: attempts };
    if (lockedUntil !== undefined) updateData.locked_until = lockedUntil;

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);
  } catch (error) {
    console.error('Failed to update login attempts:', error);
  }
}

/**
 * Update user last login
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', userId);
  } catch (error) {
    console.error('Failed to update last login:', error);
  }
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(user: PublicUser, permission: Permission): boolean {
  const userPermissions = getPermissionsForRole(user.role);
  return userPermissions.includes(permission);
}

export function hasAllPermissions(user: PublicUser, permissions: Permission[]): boolean {
  const userPermissions = getPermissionsForRole(user.role);
  return permissions.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(user: PublicUser, permissions: Permission[]): boolean {
  const userPermissions = getPermissionsForRole(user.role);
  return permissions.some((p) => userPermissions.includes(p));
}

export function getUserWithPermissions(userId: string) {
  // This needs to be async now
  return getUserById(userId).then(user => {
    if (!user) return null;
    const publicUser = toPublicUser(user);
    return {
      ...publicUser,
      permissions: getPermissionsForRole(user.role),
    };
  });
}

// ============================================================================
// USER SEARCH & FILTERING
// ============================================================================

export async function searchUsers(query: string): Promise<PublicUser[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,email.ilike.%${query}%`);

    if (error) throw error;

    return (data || []).map(dbUserToUser).map(toPublicUser);
  } catch (error) {
    console.error('Failed to search users:', error);
    return [];
  }
}

export async function filterUsersByRole(role: UserRole): Promise<PublicUser[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', role);

    if (error) throw error;

    return (data || []).map(dbUserToUser).map(toPublicUser);
  } catch (error) {
    console.error('Failed to filter users by role:', error);
    return [];
  }
}

export async function filterUsersByStatus(isActive: boolean): Promise<PublicUser[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', isActive);

    if (error) throw error;

    return (data || []).map(dbUserToUser).map(toPublicUser);
  } catch (error) {
    console.error('Failed to filter users by status:', error);
    return [];
  }
}

export async function getUserStats() {
  const users = await loadUsers();

  return {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    byRole: {
      admin: users.filter((u) => u.role === 'admin').length,
      manager: users.filter((u) => u.role === 'manager').length,
      accountant: users.filter((u) => u.role === 'accountant').length,
      viewer: users.filter((u) => u.role === 'viewer').length,
    },
    locked: users.filter((u) => u.lockedUntil && new Date(u.lockedUntil) > new Date()).length,
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial system administrator
 */
export async function createInitialAdmin(
  username: string,
  email: string,
  fullName: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const users = await loadUsers();

    // Only allow if no users exist
    if (users.length > 0) {
      return { success: false, error: 'System already initialized' };
    }

    // Validate password strength
    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('. ') };
    }

    // Get default company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (!company) {
      return { success: false, error: 'No company found' };
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        company_id: company.id,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        full_name: fullName.trim(),
        password_hash: hashPassword(password),
        role: 'admin',
        is_active: true,
        failed_login_attempts: 0,
        created_by: null,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, user: dbUserToUser(data) };
  } catch (error: any) {
    console.error('Failed to create initial admin:', error);
    return { success: false, error: error.message || 'Failed to create admin' };
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function canModifyUser(
  currentUser: PublicUser,
  targetUserId: string,
  action: 'update' | 'delete' | 'activate'
): boolean {
  if (currentUser.role === 'admin') {
    if (action === 'delete' || action === 'activate') {
      if (currentUser.id === targetUserId) {
        return false;
      }
    }
    return true;
  }

  if (action === 'update') {
    return currentUser.id === targetUserId;
  }

  return false;
}

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

function dbUserToUser(dbUser: any): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    fullName: dbUser.full_name,
    role: dbUser.role as UserRole,
    isActive: dbUser.is_active,
    passwordHash: dbUser.password_hash,
    failedLoginAttempts: dbUser.failed_login_attempts,
    lockedUntil: dbUser.locked_until,
    lastLogin: dbUser.last_login,
    createdBy: dbUser.created_by,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
}
