/**
 * User Management Service
 *
 * Handles all user-related operations:
 * - CRUD operations for users
 * - User validation
 * - Permission checking
 * - User search and filtering
 *
 * Design Principles:
 * - Complete input validation
 * - Role-based access control enforcement
 * - Audit trail support (returns data for logging)
 * - Type-safe operations
 */

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
// STORAGE KEYS
// ============================================================================

const USERS_STORAGE_KEY = 'wif_users';

// ============================================================================
// USER DATA PERSISTENCE
// ============================================================================

/**
 * Load all users from localStorage
 */
export function loadUsers(): User[] {
  const stored = localStorage.getItem(USERS_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as User[];
  } catch (error) {
    console.error('Failed to load users:', error);
    return [];
  }
}

/**
 * Save users to localStorage
 */
export function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
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
export function getAllUsers(): PublicUser[] {
  const users = loadUsers();
  return users.map(toPublicUser);
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): User | null {
  const users = loadUsers();
  return users.find((u) => u.id === userId) || null;
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): User | null {
  const users = loadUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const users = loadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Create a new user
 */
export function createUser(
  request: CreateUserRequest,
  createdByUserId: string
): { success: boolean; user?: User; error?: string } {
  // Validate username
  if (!request.username || request.username.trim().length < 3) {
    return { success: false, error: 'Username must be at least 3 characters' };
  }

  // Validate username format (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(request.username)) {
    return {
      success: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  // Check if username already exists
  if (getUserByUsername(request.username)) {
    return { success: false, error: 'Username already exists' };
  }

  // Validate email
  if (!request.email || !isValidEmail(request.email)) {
    return { success: false, error: 'Invalid email address' };
  }

  // Check if email already exists
  if (getUserByEmail(request.email)) {
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

  // Create user
  const now = new Date().toISOString();
  const user: User = {
    id: generateUserId(),
    username: request.username.toLowerCase(),
    email: request.email.toLowerCase(),
    fullName: request.fullName.trim(),
    role: request.role,
    isActive: true,
    passwordHash: hashPassword(request.password),
    failedLoginAttempts: 0,
    createdBy: createdByUserId,
    createdAt: now,
    updatedAt: now,
  };

  // Save to storage
  const users = loadUsers();
  users.push(user);
  saveUsers(users);

  return { success: true, user };
}

/**
 * Update an existing user
 */
export function updateUser(
  userId: string,
  updates: UpdateUserRequest,
  // updatedByUserId: string
): { success: boolean; user?: User; error?: string } {
  const users = loadUsers();
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }

  const user = users[userIndex];

  // Validate email if being updated
  if (updates.email) {
    if (!isValidEmail(updates.email)) {
      return { success: false, error: 'Invalid email address' };
    }

    // Check if email already exists (excluding current user)
    const existingUser = getUserByEmail(updates.email);
    if (existingUser && existingUser.id !== userId) {
      return { success: false, error: 'Email already exists' };
    }
  }

  // Validate full name if being updated
  if (updates.fullName !== undefined && updates.fullName.trim().length < 2) {
    return { success: false, error: 'Full name must be at least 2 characters' };
  }

  // Apply updates
  const updatedUser: User = {
    ...user,
    ...(updates.email && { email: updates.email.toLowerCase() }),
    ...(updates.fullName && { fullName: updates.fullName.trim() }),
    ...(updates.role && { role: updates.role }),
    ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    updatedAt: new Date().toISOString(),
  };

  users[userIndex] = updatedUser;
  saveUsers(users);

  return { success: true, user: updatedUser };
}

/**
 * Delete a user
 */
export function deleteUser(userId: string): { success: boolean; error?: string } {
  const users = loadUsers();
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }

  // Prevent deleting the last admin
  const user = users[userIndex];
  if (user.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;
    if (adminCount <= 1) {
      return { success: false, error: 'Cannot delete the last admin user' };
    }
  }

  users.splice(userIndex, 1);
  saveUsers(users);

  return { success: true };
}

/**
 * Activate a user account
 */
export function activateUser(userId: string): { success: boolean; user?: User; error?: string } {
  return updateUser(userId, { isActive: true });
}

/**
 * Deactivate a user account
 */
export function deactivateUser(
  userId: string
): { success: boolean; user?: User; error?: string } {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Prevent deactivating the last admin
  if (user.role === 'admin') {
    const activeAdminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;
    if (activeAdminCount <= 1) {
      return { success: false, error: 'Cannot deactivate the last admin user' };
    }
  }

  return updateUser(userId, { isActive: false });
}

/**
 * Update user password
 */
export function updateUserPassword(
  userId: string,
  newPassword: string
): { success: boolean; error?: string } {
  const users = loadUsers();
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }

  // Validate password strength
  const validation = validatePasswordStrength(newPassword);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('. ') };
  }

  const user = users[userIndex];
  users[userIndex] = {
    ...user,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };

  saveUsers(users);

  return { success: true };
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Get all permissions for a user role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: PublicUser, permission: Permission): boolean {
  const userPermissions = getPermissionsForRole(user.role);
  return userPermissions.includes(permission);
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(user: PublicUser, permissions: Permission[]): boolean {
  const userPermissions = getPermissionsForRole(user.role);
  return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: PublicUser, permissions: Permission[]): boolean {
  const userPermissions = getPermissionsForRole(user.role);
  return permissions.some((p) => userPermissions.includes(p));
}

/**
 * Get user with permissions
 */
export function getUserWithPermissions(userId: string) {
  const user = getUserById(userId);
  if (!user) return null;

  const publicUser = toPublicUser(user);
  return {
    ...publicUser,
    permissions: getPermissionsForRole(user.role),
  };
}

// ============================================================================
// USER SEARCH & FILTERING
// ============================================================================

/**
 * Search users by name, username, or email
 */
export function searchUsers(query: string): PublicUser[] {
  const users = loadUsers();
  const lowerQuery = query.toLowerCase();

  return users
    .filter(
      (u) =>
        u.fullName.toLowerCase().includes(lowerQuery) ||
        u.username.toLowerCase().includes(lowerQuery) ||
        u.email.toLowerCase().includes(lowerQuery)
    )
    .map(toPublicUser);
}

/**
 * Filter users by role
 */
export function filterUsersByRole(role: UserRole): PublicUser[] {
  const users = loadUsers();
  return users.filter((u) => u.role === role).map(toPublicUser);
}

/**
 * Filter users by active status
 */
export function filterUsersByStatus(isActive: boolean): PublicUser[] {
  const users = loadUsers();
  return users.filter((u) => u.isActive === isActive).map(toPublicUser);
}

/**
 * Get user statistics
 */
export function getUserStats() {
  const users = loadUsers();

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
 * Only callable when no users exist
 */
export function createInitialAdmin(
  username: string,
  email: string,
  fullName: string,
  password: string
): { success: boolean; user?: User; error?: string } {
  const users = loadUsers();

  // Only allow if no users exist
  if (users.length > 0) {
    return { success: false, error: 'System already initialized' };
  }

  // Validate password strength
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('. ') };
  }

  // Create admin user
  const now = new Date().toISOString();
  const admin: User = {
    id: generateUserId(),
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    fullName: fullName.trim(),
    role: 'admin',
    isActive: true,
    passwordHash: hashPassword(password),
    failedLoginAttempts: 0,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  };

  saveUsers([admin]);

  return { success: true, user: admin };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate if user can perform action on another user
 * Admins can modify anyone except cannot delete themselves
 * Others can only modify themselves
 */
export function canModifyUser(
  currentUser: PublicUser,
  targetUserId: string,
  action: 'update' | 'delete' | 'activate'
): boolean {
  // Admins can modify others (with some restrictions)
  if (currentUser.role === 'admin') {
    // Cannot delete/deactivate themselves
    if (action === 'delete' || action === 'activate') {
      if (currentUser.id === targetUserId) {
        return false;
      }
    }
    return true;
  }

  // Non-admins can only update themselves (profile only, not role)
  if (action === 'update') {
    return currentUser.id === targetUserId;
  }

  return false;
}
