/**
 * Activity Log Service
 *
 * Provides comprehensive audit trail functionality:
 * - Log all user actions
 * - Search and filter logs
 * - Export logs
 * - System integrity tracking
 *
 * Design Principles:
 * - Immutable logs (never delete, only add)
 * - Rich metadata for analysis
 * - Efficient querying
 * - Export capabilities
 */

import {
  ActivityLog,
  ActivityType,
  ActivityLogFilter,
  UserReference,
  PublicUser,
} from '../types/auth';
import { Document } from '../types/document';
import { Account } from '../types/account';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const ACTIVITY_LOG_STORAGE_KEY = 'wif_activity_logs';
const MAX_LOGS_IN_MEMORY = 10000; // Prevent localStorage overflow

// ============================================================================
// ACTIVITY LOG PERSISTENCE
// ============================================================================

/**
 * Load all activity logs from localStorage
 */
export function loadActivityLogs(): ActivityLog[] {
  const stored = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as ActivityLog[];
  } catch (error) {
    console.error('Failed to load activity logs:', error);
    return [];
  }
}

/**
 * Save activity logs to localStorage
 */
export function saveActivityLogs(logs: ActivityLog[]): void {
  // Keep only the most recent logs to prevent storage overflow
  const logsToSave = logs.slice(-MAX_LOGS_IN_MEMORY);
  localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(logsToSave));
}

// ============================================================================
// CREATE USER REFERENCE
// ============================================================================

/**
 * Create a user reference from a PublicUser
 */
export function createUserReference(user: PublicUser): UserReference {
  return {
    id: user.id,
    name: user.fullName,
    username: user.username,
  };
}

// ============================================================================
// LOG CREATION
// ============================================================================

/**
 * Generate unique log ID
 */
function generateLogId(): string {
  return `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an activity log entry
 */
export function logActivity(
  type: ActivityType,
  user: PublicUser,
  description: string,
  options?: {
    resourceId?: string;
    resourceType?: string;
    metadata?: Record<string, any>;
  }
): ActivityLog {
  const log: ActivityLog = {
    id: generateLogId(),
    type,
    userId: user.id,
    username: user.username,
    description,
    resourceId: options?.resourceId,
    resourceType: options?.resourceType,
    metadata: options?.metadata,
    timestamp: new Date().toISOString(),
  };

  // Save to storage
  const logs = loadActivityLogs();
  logs.push(log);
  saveActivityLogs(logs);

  return log;
}

// ============================================================================
// SPECIALIZED LOGGING FUNCTIONS
// ============================================================================

/**
 * Log authentication event
 */
export function logAuthEvent(
  type: 'auth:login' | 'auth:logout' | 'auth:login_failed' | 'auth:password_changed',
  user: PublicUser | { username: string },
  metadata?: Record<string, any>
): ActivityLog {
  const descriptions = {
    'auth:login': `User ${user.username} logged in successfully`,
    'auth:logout': `User ${user.username} logged out`,
    'auth:login_failed': `Failed login attempt for ${user.username}`,
    'auth:password_changed': `User ${user.username} changed their password`,
  };

  // For login failed, we might not have full user info
  const publicUser =
    'id' in user
      ? user
      : ({
          id: 'unknown',
          username: user.username,
          email: '',
          fullName: user.username,
          role: 'viewer',
          isActive: false,
          createdBy: 'system',
          createdAt: '',
          updatedAt: '',
        } as PublicUser);

  return logActivity(type, publicUser, descriptions[type], { metadata });
}

/**
 * Log document event
 */
export function logDocumentEvent(
  type:
    | 'document:created'
    | 'document:updated'
    | 'document:deleted'
    | 'document:status_changed'
    | 'document:approved'
    | 'document:printed',
  user: PublicUser,
  document: Document,
  metadata?: Record<string, any>
): ActivityLog {
  const actions = {
    'document:created': 'created',
    'document:updated': 'updated',
    'document:deleted': 'deleted',
    'document:status_changed': 'changed status of',
    'document:approved': 'approved',
    'document:printed': 'printed',
  };

  const description = `${user.fullName} ${actions[type]} ${document.documentType} ${document.documentNumber}`;

  return logActivity(type, user, description, {
    resourceId: document.id,
    resourceType: 'document',
    metadata: {
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      status: document.status,
      amount: document.amount,
      currency: document.currency,
      ...metadata,
    },
  });
}

/**
 * Log account event
 */
export function logAccountEvent(
  type: 'account:created' | 'account:updated' | 'account:deleted' | 'account:balance_changed',
  user: PublicUser,
  account: Account,
  metadata?: Record<string, any>
): ActivityLog {
  const actions = {
    'account:created': 'created',
    'account:updated': 'updated',
    'account:deleted': 'deleted',
    'account:balance_changed': 'balance changed for',
  };

  const description = `${user.fullName} ${actions[type]} account ${account.name}`;

  return logActivity(type, user, description, {
    resourceId: account.id,
    resourceType: 'account',
    metadata: {
      accountName: account.name,
      currency: account.currency,
      currentBalance: account.currentBalance,
      ...metadata,
    },
  });
}

/**
 * Log user management event
 */
export function logUserEvent(
  type:
    | 'user:created'
    | 'user:updated'
    | 'user:deleted'
    | 'user:activated'
    | 'user:deactivated',
  performedBy: PublicUser,
  targetUser: PublicUser,
  metadata?: Record<string, any>
): ActivityLog {
  const actions = {
    'user:created': 'created',
    'user:updated': 'updated',
    'user:deleted': 'deleted',
    'user:activated': 'activated',
    'user:deactivated': 'deactivated',
  };

  const description = `${performedBy.fullName} ${actions[type]} user ${targetUser.username}`;

  return logActivity(type, performedBy, description, {
    resourceId: targetUser.id,
    resourceType: 'user',
    metadata: {
      targetUsername: targetUser.username,
      targetRole: targetUser.role,
      ...metadata,
    },
  });
}

/**
 * Log system event
 */
export function logSystemEvent(
  type: 'system:settings_changed' | 'system:data_exported',
  user: PublicUser,
  description: string,
  metadata?: Record<string, any>
): ActivityLog {
  return logActivity(type, user, description, {
    resourceType: 'system',
    metadata,
  });
}

// ============================================================================
// QUERY & FILTERING
// ============================================================================

/**
 * Get all activity logs with optional filtering
 */
export function getActivityLogs(filter?: ActivityLogFilter): ActivityLog[] {
  let logs = loadActivityLogs();

  // Apply filters
  if (filter) {
    // Filter by user ID
    if (filter.userId) {
      logs = logs.filter((log) => log.userId === filter.userId);
    }

    // Filter by activity type
    if (filter.type) {
      logs = logs.filter((log) => log.type === filter.type);
    }

    // Filter by resource type
    if (filter.resourceType) {
      logs = logs.filter((log) => log.resourceType === filter.resourceType);
    }

    // Filter by date range
    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      logs = logs.filter((log) => new Date(log.timestamp) >= startDate);
    }

    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      logs = logs.filter((log) => new Date(log.timestamp) <= endDate);
    }

    // Search in description
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      logs = logs.filter((log) => log.description.toLowerCase().includes(searchLower));
    }
  }

  // Sort by timestamp (newest first)
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply pagination
  if (filter?.page !== undefined && filter?.limit !== undefined) {
    const start = (filter.page - 1) * filter.limit;
    const end = start + filter.limit;
    logs = logs.slice(start, end);
  }

  return logs;
}

/**
 * Get activity logs for a specific user
 */
export function getUserActivityLogs(userId: string, limit?: number): ActivityLog[] {
  return getActivityLogs({
    userId,
    limit: limit || 50,
    page: 1,
  });
}

/**
 * Get activity logs for a specific document
 */
export function getDocumentActivityLogs(documentId: string): ActivityLog[] {
  return getActivityLogs({
    resourceType: 'document',
  }).filter((log) => log.resourceId === documentId);
}

/**
 * Get activity logs for a specific account
 */
export function getAccountActivityLogs(accountId: string): ActivityLog[] {
  return getActivityLogs({
    resourceType: 'account',
  }).filter((log) => log.resourceId === accountId);
}

/**
 * Get recent activity logs
 */
export function getRecentActivity(limit: number = 50): ActivityLog[] {
  const logs = loadActivityLogs();
  return logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get activity statistics
 */
export function getActivityStats(startDate?: string, endDate?: string) {
  const logs = getActivityLogs({ startDate, endDate });

  // Count by type
  const byType: Record<string, number> = {};
  logs.forEach((log) => {
    byType[log.type] = (byType[log.type] || 0) + 1;
  });

  // Count by user
  const byUser: Record<string, number> = {};
  logs.forEach((log) => {
    byUser[log.username] = (byUser[log.username] || 0) + 1;
  });

  // Count by resource type
  const byResourceType: Record<string, number> = {};
  logs.forEach((log) => {
    if (log.resourceType) {
      byResourceType[log.resourceType] = (byResourceType[log.resourceType] || 0) + 1;
    }
  });

  return {
    total: logs.length,
    byType,
    byUser,
    byResourceType,
    period: {
      start: startDate,
      end: endDate,
    },
  };
}

/**
 * Get user activity summary
 */
export function getUserActivitySummary(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = getActivityLogs({
    userId,
    startDate: startDate.toISOString(),
  });

  const activityByDay: Record<string, number> = {};

  logs.forEach((log) => {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    activityByDay[date] = (activityByDay[date] || 0) + 1;
  });

  return {
    totalActions: logs.length,
    activityByDay,
    mostRecentAction: logs[0]?.timestamp,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export activity logs to JSON
 */
export function exportActivityLogsToJSON(filter?: ActivityLogFilter): string {
  const logs = getActivityLogs(filter);
  return JSON.stringify(logs, null, 2);
}

/**
 * Export activity logs to CSV
 */
export function exportActivityLogsToCSV(filter?: ActivityLogFilter): string {
  const logs = getActivityLogs(filter);

  // CSV header
  const headers = [
    'Timestamp',
    'Type',
    'User',
    'Description',
    'Resource Type',
    'Resource ID',
  ];
  const csvRows = [headers.join(',')];

  // CSV data
  logs.forEach((log) => {
    const row = [
      new Date(log.timestamp).toLocaleString(),
      log.type,
      log.username,
      `"${log.description.replace(/"/g, '""')}"`, // Escape quotes
      log.resourceType || '',
      log.resourceId || '',
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Download activity logs as file
 */
export function downloadActivityLogs(
  format: 'json' | 'csv' = 'json',
  filter?: ActivityLogFilter
): void {
  const content =
    format === 'json'
      ? exportActivityLogsToJSON(filter)
      : exportActivityLogsToCSV(filter);

  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json' : 'text/csv',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `activity_logs_${new Date().toISOString().split('T')[0]}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clear old activity logs (keep last N days)
 */
export function cleanupOldLogs(daysToKeep: number = 90): number {
  const logs = loadActivityLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const filteredLogs = logs.filter((log) => new Date(log.timestamp) >= cutoffDate);
  const removedCount = logs.length - filteredLogs.length;

  if (removedCount > 0) {
    saveActivityLogs(filteredLogs);
  }

  return removedCount;
}

/**
 * Get storage usage info
 */
export function getStorageInfo() {
  const logs = loadActivityLogs();
  const stored = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY) || '';

  return {
    logCount: logs.length,
    storageSizeKB: (stored.length / 1024).toFixed(2),
    maxLogs: MAX_LOGS_IN_MEMORY,
    percentageFull: ((logs.length / MAX_LOGS_IN_MEMORY) * 100).toFixed(1),
  };
}
