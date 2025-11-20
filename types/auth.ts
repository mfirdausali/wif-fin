/**
 * Authentication and Authorization Type Definitions
 *
 * This module defines all types related to user authentication,
 * authorization, roles, permissions, and audit logging.
 *
 * Design Principles:
 * - Type-safe role-based access control (RBAC)
 * - Extensible for future OAuth/SSO integration
 * - Complete audit trail tracking
 * - Separation of concerns (authentication vs authorization)
 */

// ============================================================================
// USER ROLES & PERMISSIONS
// ============================================================================

/**
 * Available user roles in the system
 * Each role has progressively more permissions
 */
export type UserRole = 'viewer' | 'accountant' | 'manager' | 'admin';

/**
 * Granular permissions for fine-grained access control
 * Organized by resource type (documents, users, accounts, etc.)
 */
export type Permission =
  // Document permissions
  | 'documents:view'
  | 'documents:create'
  | 'documents:edit'
  | 'documents:delete'
  | 'documents:approve'
  | 'documents:print'

  // Account permissions
  | 'accounts:view'
  | 'accounts:create'
  | 'accounts:edit'
  | 'accounts:delete'

  // User management permissions
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:activate'

  // System permissions
  | 'system:settings'
  | 'system:audit_logs'
  | 'system:export_data';

/**
 * Role-to-Permission mapping
 * Defines what each role can do in the system
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Viewer: Read-only access to documents and accounts
  viewer: [
    'documents:view',
    'documents:print',
    'accounts:view',
  ],

  // Accountant: Can create/edit documents but not delete or approve
  accountant: [
    'documents:view',
    'documents:create',
    'documents:edit',
    'documents:print',
    'accounts:view',
    'accounts:create',
    'accounts:edit',
  ],

  // Manager: Can approve vouchers, manage all documents
  manager: [
    'documents:view',
    'documents:create',
    'documents:edit',
    'documents:delete',
    'documents:approve',
    'documents:print',
    'accounts:view',
    'accounts:create',
    'accounts:edit',
    'accounts:delete',
    'system:export_data',
  ],

  // Admin: Full system access including user management
  admin: [
    'documents:view',
    'documents:create',
    'documents:edit',
    'documents:delete',
    'documents:approve',
    'documents:print',
    'accounts:view',
    'accounts:create',
    'accounts:edit',
    'accounts:delete',
    'users:view',
    'users:create',
    'users:edit',
    'users:delete',
    'users:activate',
    'system:settings',
    'system:audit_logs',
    'system:export_data',
  ],
};

// ============================================================================
// USER MODEL
// ============================================================================

/**
 * User account information
 * Stores all data related to a system user
 */
export interface User {
  /** Unique identifier */
  id: string;

  /** Username for login (unique, lowercase) */
  username: string;

  /** User's email address (unique) */
  email: string;

  /** Full name for display */
  fullName: string;

  /** User's role determining permissions */
  role: UserRole;

  /** Whether the account is active (can login) */
  isActive: boolean;

  /** Hashed password (never exposed to frontend) */
  passwordHash?: string;

  /** Number of failed login attempts */
  failedLoginAttempts: number;

  /** Timestamp when account was locked (after too many failed attempts) */
  lockedUntil?: string;

  /** Last successful login timestamp */
  lastLogin?: string;

  /** User who created this account */
  createdBy: string;

  /** Account creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Public user information (safe to expose in UI)
 * Excludes sensitive fields like password hash
 */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * User creation request
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Password change request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================================================
// AUTHENTICATION SESSION
// ============================================================================

/**
 * Active user session
 * Contains current user info and authentication state
 */
export interface AuthSession {
  /** Currently logged in user */
  user: PublicUser;

  /** Session token (for future JWT implementation) */
  token: string;

  /** Session creation time */
  createdAt: string;

  /** Session expiration time */
  expiresAt: string;

  /** Whether "remember me" was selected */
  rememberMe: boolean;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login response
 */
export interface LoginResponse {
  success: boolean;
  session?: AuthSession;
  error?: string;
  errorCode?: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_INACTIVE';
}

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

/**
 * Types of activities to log
 */
export type ActivityType =
  // Authentication activities
  | 'auth:login'
  | 'auth:logout'
  | 'auth:login_failed'
  | 'auth:password_changed'

  // Document activities
  | 'document:created'
  | 'document:updated'
  | 'document:deleted'
  | 'document:status_changed'
  | 'document:approved'
  | 'document:printed'

  // Account activities
  | 'account:created'
  | 'account:updated'
  | 'account:deleted'
  | 'account:balance_changed'

  // User management activities
  | 'user:created'
  | 'user:updated'
  | 'user:deleted'
  | 'user:activated'
  | 'user:deactivated'

  // System activities
  | 'system:settings_changed'
  | 'system:data_exported';

/**
 * Activity log entry
 * Complete audit trail of all system actions
 */
export interface ActivityLog {
  /** Unique identifier */
  id: string;

  /** Type of activity */
  type: ActivityType;

  /** User who performed the action */
  userId: string;

  /** Username for quick reference */
  username: string;

  /** Human-readable description */
  description: string;

  /** Related resource ID (document ID, account ID, etc.) */
  resourceId?: string;

  /** Resource type (document, account, user, etc.) */
  resourceType?: string;

  /** Additional metadata (before/after values, etc.) */
  metadata?: Record<string, any>;

  /** IP address (for future implementation) */
  ipAddress?: string;

  /** User agent (for future implementation) */
  userAgent?: string;

  /** Timestamp of the activity */
  timestamp: string;
}

/**
 * Activity log filter criteria
 */
export interface ActivityLogFilter {
  /** Filter by user ID */
  userId?: string;

  /** Filter by activity type */
  type?: ActivityType;

  /** Filter by resource type */
  resourceType?: string;

  /** Filter by date range (start) */
  startDate?: string;

  /** Filter by date range (end) */
  endDate?: string;

  /** Search in description */
  search?: string;

  /** Pagination: page number */
  page?: number;

  /** Pagination: items per page */
  limit?: number;
}

// ============================================================================
// USER TRACKING IN DOCUMENTS
// ============================================================================

/**
 * User reference for document tracking
 * Lightweight user info embedded in documents
 */
export interface UserReference {
  /** User ID */
  id: string;

  /** User's full name */
  name: string;

  /** Username */
  username: string;
}

/**
 * Document user tracking fields
 * To be added to existing document types
 */
export interface DocumentUserTracking {
  /** User who created the document */
  createdBy: UserReference;

  /** User who last updated the document */
  updatedBy: UserReference;

  /** Last modification timestamp */
  lastModifiedAt: string;

  /** User who approved (for payment vouchers) */
  approvedBy?: UserReference;

  /** Approval timestamp */
  approvalDate?: string;
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

/**
 * Password strength requirements
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

/**
 * Default password requirements
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Password validation result
 */
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

// ============================================================================
// SECURITY SETTINGS
// ============================================================================

/**
 * Security configuration
 */
export interface SecuritySettings {
  /** Maximum failed login attempts before lockout */
  maxFailedAttempts: number;

  /** Lockout duration in minutes */
  lockoutDurationMinutes: number;

  /** Session timeout in minutes (for active users) */
  sessionTimeoutMinutes: number;

  /** Session timeout for "remember me" (in days) */
  rememberMeTimeoutDays: number;

  /** Require password change after X days */
  passwordExpiryDays?: number;
}

/**
 * Default security settings
 */
export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  sessionTimeoutMinutes: 60,
  rememberMeTimeoutDays: 30,
};

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * User with permission check context
 */
export interface UserWithPermissions extends PublicUser {
  permissions: Permission[];
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: PublicUser | null;
  session: AuthSession | null;
  error: string | null;
}
