/**
 * Permission Utilities
 *
 * Helper functions for permission checking and access control
 * throughout the application.
 *
 * Design Principles:
 * - Centralized permission logic
 * - Easy to use guard functions
 * - Type-safe permission checks
 * - Clear error messages
 */

import { PublicUser, Permission, UserRole } from '../types/auth';
import { Document, DocumentStatus } from '../types/document';
import { hasPermission } from '../services/userService';

// ============================================================================
// DOCUMENT PERMISSIONS
// ============================================================================

/**
 * Check if user can view documents
 */
export function canViewDocuments(user: PublicUser): boolean {
  return hasPermission(user, 'documents:view');
}

/**
 * Check if user can create documents
 */
export function canCreateDocuments(user: PublicUser): boolean {
  return hasPermission(user, 'documents:create');
}

/**
 * Check if user can edit a specific document
 */
export function canEditDocument(user: PublicUser, document: Document): boolean {
  // Must have edit permission
  if (!hasPermission(user, 'documents:edit')) {
    return false;
  }

  // Admins can edit any document including completed/cancelled
  if (user.role === 'admin') {
    return true;
  }

  // Non-admins cannot edit completed or cancelled documents
  if (document.status === 'completed' || document.status === 'cancelled') {
    return false;
  }

  // Accountants and managers can edit any non-completed/cancelled document
  // (Viewers don't have documents:edit permission, so they won't reach here)
  return true;
}

/**
 * Check if user can delete a specific document
 */
export function canDeleteDocument(user: PublicUser, document: Document): boolean {
  // Must have delete permission
  if (!hasPermission(user, 'documents:delete')) {
    return false;
  }

  // Admins can delete any document including completed
  if (user.role === 'admin') {
    return true;
  }

  // Non-admins cannot delete completed documents (business rule: maintain audit trail)
  if (document.status === 'completed') {
    return false;
  }

  // Managers can delete non-completed documents
  return true;
}

/**
 * Check if user can approve payment vouchers
 */
export function canApproveVouchers(user: PublicUser): boolean {
  return hasPermission(user, 'documents:approve');
}

/**
 * Check if user can print documents
 */
export function canPrintDocuments(user: PublicUser): boolean {
  return hasPermission(user, 'documents:print');
}

/**
 * Check if user can change document status
 */
export function canChangeDocumentStatus(
  user: PublicUser,
  document: Document,
  newStatus: DocumentStatus
): boolean {
  // Viewers cannot change status
  if (user.role === 'viewer') {
    return false;
  }

  // Cannot change status of completed documents
  if (document.status === 'completed') {
    return false;
  }

  // Specific status transitions
  switch (newStatus) {
    case 'cancelled':
      // Only managers and admins can cancel
      return user.role === 'manager' || user.role === 'admin';

    case 'completed':
      // Only happens through receipt/SOP creation
      return false;

    case 'issued':
      // Accountants, managers, and admins can issue drafts
      return document.status === 'draft';

    case 'draft':
      // Can revert issued back to draft
      return document.status === 'issued';

    default:
      return false;
  }
}

// ============================================================================
// ACCOUNT PERMISSIONS
// ============================================================================

/**
 * Check if user can view accounts
 */
export function canViewAccounts(user: PublicUser): boolean {
  return hasPermission(user, 'accounts:view');
}

/**
 * Check if user can create accounts
 */
export function canCreateAccounts(user: PublicUser): boolean {
  return hasPermission(user, 'accounts:create');
}

/**
 * Check if user can edit accounts
 */
export function canEditAccounts(user: PublicUser): boolean {
  return hasPermission(user, 'accounts:edit');
}

/**
 * Check if user can delete accounts
 */
export function canDeleteAccounts(user: PublicUser): boolean {
  return hasPermission(user, 'accounts:delete');
}

// ============================================================================
// USER MANAGEMENT PERMISSIONS
// ============================================================================

/**
 * Check if user can view user list
 */
export function canViewUsers(user: PublicUser): boolean {
  return hasPermission(user, 'users:view');
}

/**
 * Check if user can create users
 */
export function canCreateUsers(user: PublicUser): boolean {
  return hasPermission(user, 'users:create');
}

/**
 * Check if user can edit users
 */
export function canEditUsers(user: PublicUser): boolean {
  return hasPermission(user, 'users:edit');
}

/**
 * Check if user can delete users
 */
export function canDeleteUsers(user: PublicUser): boolean {
  return hasPermission(user, 'users:delete');
}

/**
 * Check if user can activate/deactivate users
 */
export function canActivateUsers(user: PublicUser): boolean {
  return hasPermission(user, 'users:activate');
}

/**
 * Check if user can edit their own profile
 */
export function canEditOwnProfile(_user: PublicUser): boolean {
  // Everyone can edit their own profile
  return true;
}

// ============================================================================
// SYSTEM PERMISSIONS
// ============================================================================

/**
 * Check if user can access system settings
 */
export function canAccessSettings(user: PublicUser): boolean {
  return hasPermission(user, 'system:settings');
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(user: PublicUser): boolean {
  return hasPermission(user, 'system:audit_logs');
}

/**
 * Check if user can export data
 */
export function canExportData(user: PublicUser): boolean {
  return hasPermission(user, 'system:export_data');
}

// ============================================================================
// ROLE-BASED HELPERS
// ============================================================================

/**
 * Check if user is admin
 */
export function isAdmin(user: PublicUser): boolean {
  return user.role === 'admin';
}

/**
 * Check if user is manager or higher
 */
export function isManagerOrHigher(user: PublicUser): boolean {
  return user.role === 'manager' || user.role === 'admin';
}

/**
 * Check if user is accountant or higher
 */
export function isAccountantOrHigher(user: PublicUser): boolean {
  return user.role === 'accountant' || user.role === 'manager' || user.role === 'admin';
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    admin: 'System Administrator',
    manager: 'Manager',
    accountant: 'Accountant',
    viewer: 'Viewer',
    operations: 'Operations',
  };
  return roleNames[role];
}

/**
 * Get user role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full system access including user management and system settings',
    manager: 'Can approve vouchers, delete documents, and manage all accounts',
    accountant: 'Can create and edit all documents (invoices, receipts, vouchers, statements)',
    viewer: 'Read-only access to documents and accounts',
    operations: 'Access to Payment Vouchers and Bookings only (dedicated portal)',
  };
  return descriptions[role];
}

/**
 * Get user role badge color
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    accountant: 'bg-green-100 text-green-800',
    viewer: 'bg-gray-100 text-gray-800',
    operations: 'bg-emerald-100 text-emerald-800',
  };
  return colors[role];
}

// ============================================================================
// PERMISSION GUARDS (throw errors)
// ============================================================================

/**
 * Guard: Require specific permission or throw error
 */
export function requirePermission(user: PublicUser, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    throw new Error(
      `Access denied: You don't have permission to perform this action (${permission})`
    );
  }
}

/**
 * Guard: Require admin role or throw error
 */
export function requireAdmin(user: PublicUser): void {
  if (!isAdmin(user)) {
    throw new Error('Access denied: This action requires administrator privileges');
  }
}

/**
 * Guard: Require manager or higher or throw error
 */
export function requireManagerOrHigher(user: PublicUser): void {
  if (!isManagerOrHigher(user)) {
    throw new Error('Access denied: This action requires manager or administrator privileges');
  }
}

// ============================================================================
// PERMISSION MESSAGES
// ============================================================================

/**
 * Get friendly error message for missing permission
 */
export function getPermissionErrorMessage(permission: Permission): string {
  const messages: Record<Permission, string> = {
    'documents:view': 'You do not have permission to view documents',
    'documents:create': 'You do not have permission to create documents',
    'documents:edit': 'You do not have permission to edit documents',
    'documents:delete': 'You do not have permission to delete documents',
    'documents:approve': 'You do not have permission to approve payment vouchers',
    'documents:print': 'You do not have permission to print documents',
    'accounts:view': 'You do not have permission to view accounts',
    'accounts:create': 'You do not have permission to create accounts',
    'accounts:edit': 'You do not have permission to edit accounts',
    'accounts:delete': 'You do not have permission to delete accounts',
    'users:view': 'You do not have permission to view users',
    'users:create': 'You do not have permission to create users',
    'users:edit': 'You do not have permission to edit users',
    'users:delete': 'You do not have permission to delete users',
    'users:activate': 'You do not have permission to activate/deactivate users',
    'system:settings': 'You do not have permission to access system settings',
    'system:audit_logs': 'You do not have permission to view audit logs',
    'system:export_data': 'You do not have permission to export data',
  };
  return messages[permission] || 'You do not have permission to perform this action';
}

// ============================================================================
// OPERATIONS ROLE HELPERS
// ============================================================================

/**
 * Check if user is an operations role user
 */
export function isOperationsUser(user: PublicUser): boolean {
  return user.role === 'operations';
}

/**
 * Check if user can access accounts/ledger
 * Operations users cannot access accounts/ledger
 */
export function canAccessAccounts(user: PublicUser): boolean {
  if (user.role === 'operations') return false;
  return hasPermission(user, 'accounts:view');
}

/**
 * Check if user can access bookings
 */
export function canAccessBookings(user: PublicUser): boolean {
  return hasPermission(user, 'bookings:view');
}

/**
 * Get document types accessible by the user
 * Operations users can only access payment_voucher
 */
export function getAccessibleDocumentTypes(user: PublicUser): string[] {
  if (user.role === 'operations') {
    return ['payment_voucher'];
  }
  return ['invoice', 'receipt', 'payment_voucher', 'statement_of_payment'];
}
