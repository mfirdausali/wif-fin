/**
 * Activity Log Service - Google Sheets Backend
 *
 * Provides comprehensive audit trail functionality:
 * - Log all user actions to Google Sheets
 * - Search and filter logs
 * - Export logs
 * - System integrity tracking
 *
 * Uses Google Apps Script as backend for reliability and free storage.
 * Falls back to localStorage if Google Sheets is unavailable.
 */

import {
  ActivityLog,
  ActivityType,
  ActivityLogFilter,
  PublicUser,
} from '../types/auth';
import { Document } from '../types/document';
import { Account } from '../types/account';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEETS_URL = import.meta.env.VITE_ACTIVITY_LOG_URL || '';
const LOCAL_STORAGE_KEY = 'wif_activity_logs_pending';
const MAX_RETRY_QUEUE = 100;

// ============================================================================
// GOOGLE SHEETS API
// ============================================================================

/**
 * Check if Google Sheets integration is configured
 */
function isGoogleSheetsConfigured(): boolean {
  return !!GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL.includes('script.google.com');
}

/**
 * Send log to Google Sheets
 */
async function sendToGoogleSheets(log: ActivityLog): Promise<boolean> {
  if (!isGoogleSheetsConfigured()) {
    return false;
  }

  try {
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'log',
        log: log,
      }),
      mode: 'no-cors', // Google Apps Script requires this
    });

    // With no-cors, we can't read the response, assume success if no error
    return true;
  } catch (error) {
    console.error('Failed to send log to Google Sheets:', error);
    return false;
  }
}

/**
 * Send batch of logs to Google Sheets
 */
async function sendBatchToGoogleSheets(logs: ActivityLog[]): Promise<boolean> {
  if (!isGoogleSheetsConfigured() || logs.length === 0) {
    return false;
  }

  try {
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'batch',
        logs: logs,
      }),
      mode: 'no-cors',
    });

    return true;
  } catch (error) {
    console.error('Failed to send batch to Google Sheets:', error);
    return false;
  }
}

/**
 * Fetch logs from Google Sheets
 */
async function fetchFromGoogleSheets(filter?: ActivityLogFilter): Promise<ActivityLog[] | null> {
  if (!isGoogleSheetsConfigured()) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.append('action', 'fetch');

    if (filter?.userId) params.append('userId', filter.userId);
    if (filter?.type) params.append('type', filter.type);
    if (filter?.resourceType) params.append('resourceType', filter.resourceType);
    if (filter?.startDate) params.append('startDate', filter.startDate);
    if (filter?.endDate) params.append('endDate', filter.endDate);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.page) params.append('page', filter.page.toString());
    if (filter?.limit) params.append('limit', filter.limit.toString());

    const response = await fetch(`${GOOGLE_SHEETS_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.success) {
      return data.logs;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch from Google Sheets:', error);
    return null;
  }
}

// ============================================================================
// PENDING QUEUE (localStorage fallback)
// ============================================================================

/**
 * Get pending logs from localStorage
 */
function getPendingLogs(): ActivityLog[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as ActivityLog[];
  } catch {
    return [];
  }
}

/**
 * Save pending logs to localStorage
 */
function savePendingLogs(logs: ActivityLog[]): void {
  const logsToSave = logs.slice(-MAX_RETRY_QUEUE);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logsToSave));
}

/**
 * Add log to pending queue
 */
function addToPendingQueue(log: ActivityLog): void {
  const pending = getPendingLogs();
  pending.push(log);
  savePendingLogs(pending);
}

/**
 * Clear pending queue
 */
function clearPendingQueue(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * Retry sending pending logs
 */
async function retryPendingLogs(): Promise<void> {
  const pending = getPendingLogs();
  if (pending.length === 0) return;

  const success = await sendBatchToGoogleSheets(pending);
  if (success) {
    clearPendingQueue();
    console.log(`Successfully synced ${pending.length} pending activity logs`);
  }
}

// ============================================================================
// CREATE USER REFERENCE
// ============================================================================

/**
 * Create a user reference from a PublicUser
 */
export function createUserReference(user: PublicUser) {
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
    metadata?: Record<string, unknown>;
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

  // Send to Google Sheets (fire and forget)
  sendToGoogleSheets(log).then(success => {
    if (!success) {
      // Add to pending queue for retry
      addToPendingQueue(log);
    }
  });

  return log;
}

// ============================================================================
// SPECIALIZED LOGGING FUNCTIONS
// ============================================================================

/**
 * Log authentication event
 */
export function logAuthEvent(
  type:
    | 'auth:login'
    | 'auth:logout'
    | 'auth:login_failed'
    | 'auth:password_changed'
    | 'auth:account_locked'
    | 'auth:account_unlocked'
    | 'auth:session_created'
    | 'auth:session_revoked',
  user: PublicUser | { username: string },
  metadata?: Record<string, unknown>
): ActivityLog {
  const descriptions: Record<string, string> = {
    'auth:login': `User ${user.username} logged in successfully`,
    'auth:logout': `User ${user.username} logged out`,
    'auth:login_failed': `Failed login attempt for ${user.username}`,
    'auth:password_changed': `User ${user.username} changed their password`,
    'auth:account_locked': `Account ${user.username} was locked due to too many failed login attempts`,
    'auth:account_unlocked': `Account ${user.username} was unlocked`,
    'auth:session_created': `New session created for ${user.username}`,
    'auth:session_revoked': `Session revoked for ${user.username}`,
  };

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
    | 'document:printed'
    | 'document:linked_to_booking'
    | 'document:unlinked_from_booking',
  user: PublicUser,
  document: Document,
  metadata?: Record<string, unknown>
): ActivityLog {
  const actions: Record<string, string> = {
    'document:created': 'created',
    'document:updated': 'updated',
    'document:deleted': 'deleted',
    'document:status_changed': 'changed status of',
    'document:approved': 'approved',
    'document:printed': 'printed',
    'document:linked_to_booking': 'linked to booking',
    'document:unlinked_from_booking': 'unlinked from booking',
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
  metadata?: Record<string, unknown>
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
  metadata?: Record<string, unknown>
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
  metadata?: Record<string, unknown>
): ActivityLog {
  return logActivity(type, user, description, {
    resourceType: 'system',
    metadata,
  });
}

/**
 * Log booking event
 * Tracks all booking-related activities including CRUD operations,
 * status changes, and card printing
 */
export function logBookingEvent(
  type:
    | 'booking:created'
    | 'booking:updated'
    | 'booking:deleted'
    | 'booking:status_changed'
    | 'booking:card_printed'
    | 'booking:form_printed',
  user: PublicUser,
  booking: { id: string; bookingCode: string; guestName: string; status?: string },
  metadata?: Record<string, unknown>
): ActivityLog {
  const actions = {
    'booking:created': 'created',
    'booking:updated': 'updated',
    'booking:deleted': 'deleted',
    'booking:status_changed': 'changed status of',
    'booking:card_printed': 'printed cards for',
    'booking:form_printed': 'printed form for',
  };

  const description = `${user.fullName} ${actions[type]} booking ${booking.bookingCode} (${booking.guestName})`;

  return logActivity(type, user, description, {
    resourceId: booking.id,
    resourceType: 'booking',
    metadata: {
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      status: booking.status,
      ...metadata,
    },
  });
}

/**
 * Log transaction event
 * Tracks financial transactions including balance changes from document operations.
 * This is critical for audit trails of all financial movements.
 *
 * @param type - 'transaction:applied' when a document affects account balance,
 *               'transaction:reversed' when a document effect is undone
 * @param user - The user performing the action
 * @param transactionData - Details about the transaction
 */
export function logTransactionEvent(
  type: 'transaction:applied' | 'transaction:reversed',
  user: PublicUser,
  transactionData: {
    accountId: string;
    accountName: string;
    previousBalance: number;
    newBalance: number;
    changeAmount: number;
    documentId: string;
    documentNumber: string;
    documentType: string;
    transactionType: 'increase' | 'decrease';
    currency: string;
  }
): ActivityLog {
  const action = type === 'transaction:applied' ? 'applied' : 'reversed';
  const direction = transactionData.transactionType === 'increase' ? 'increased' : 'decreased';
  const changeDisplay = Math.abs(transactionData.changeAmount).toFixed(2);

  const description = `${user.fullName} ${action} transaction: ${transactionData.accountName} ${direction} by ${transactionData.currency} ${changeDisplay} (${transactionData.documentType} ${transactionData.documentNumber})`;

  return logActivity(type, user, description, {
    resourceId: transactionData.accountId,
    resourceType: 'transaction',
    metadata: {
      accountId: transactionData.accountId,
      accountName: transactionData.accountName,
      previousBalance: transactionData.previousBalance,
      newBalance: transactionData.newBalance,
      changeAmount: transactionData.changeAmount,
      documentId: transactionData.documentId,
      documentNumber: transactionData.documentNumber,
      documentType: transactionData.documentType,
      transactionType: transactionData.transactionType,
      currency: transactionData.currency,
    },
  });
}

// ============================================================================
// QUERY & FILTERING
// ============================================================================

/**
 * Get all activity logs with optional filtering
 * Fetches from Google Sheets, falls back to pending queue if unavailable
 */
export async function getActivityLogsAsync(filter?: ActivityLogFilter): Promise<ActivityLog[]> {
  // Try to fetch from Google Sheets
  const logs = await fetchFromGoogleSheets(filter);

  if (logs !== null) {
    return logs;
  }

  // Return pending logs if Google Sheets unavailable
  let pendingLogs = getPendingLogs();

  // Apply filters to pending logs
  if (filter) {
    if (filter.userId) {
      pendingLogs = pendingLogs.filter((log) => log.userId === filter.userId);
    }
    if (filter.type) {
      pendingLogs = pendingLogs.filter((log) => log.type === filter.type);
    }
    if (filter.resourceType) {
      pendingLogs = pendingLogs.filter((log) => log.resourceType === filter.resourceType);
    }
    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      pendingLogs = pendingLogs.filter((log) => new Date(log.timestamp) >= startDate);
    }
    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      pendingLogs = pendingLogs.filter((log) => new Date(log.timestamp) <= endDate);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      pendingLogs = pendingLogs.filter((log) =>
        log.description.toLowerCase().includes(searchLower)
      );
    }
  }

  // Sort by timestamp (newest first)
  pendingLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return pendingLogs;
}

/**
 * Synchronous version for backward compatibility
 * Returns pending logs only (cached locally)
 */
export function getActivityLogs(filter?: ActivityLogFilter): ActivityLog[] {
  let logs = getPendingLogs();

  if (filter) {
    if (filter.userId) {
      logs = logs.filter((log) => log.userId === filter.userId);
    }
    if (filter.type) {
      logs = logs.filter((log) => log.type === filter.type);
    }
    if (filter.resourceType) {
      logs = logs.filter((log) => log.resourceType === filter.resourceType);
    }
    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      logs = logs.filter((log) => new Date(log.timestamp) >= startDate);
    }
    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      logs = logs.filter((log) => new Date(log.timestamp) <= endDate);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      logs = logs.filter((log) => log.description.toLowerCase().includes(searchLower));
    }
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (filter?.page !== undefined && filter?.limit !== undefined) {
    const start = (filter.page - 1) * filter.limit;
    const end = start + filter.limit;
    logs = logs.slice(start, end);
  }

  return logs;
}

/**
 * Get recent activity logs
 */
export async function getRecentActivityAsync(limit: number = 50): Promise<ActivityLog[]> {
  return getActivityLogsAsync({ limit, page: 1 });
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

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export activity logs to JSON
 */
export async function exportActivityLogsToJSON(filter?: ActivityLogFilter): Promise<string> {
  const logs = await getActivityLogsAsync(filter);
  return JSON.stringify(logs, null, 2);
}

/**
 * Export activity logs to CSV
 */
export async function exportActivityLogsToCSV(filter?: ActivityLogFilter): Promise<string> {
  const logs = await getActivityLogsAsync(filter);

  const headers = [
    'Timestamp',
    'Type',
    'User',
    'Description',
    'Resource Type',
    'Resource ID',
  ];
  const csvRows = [headers.join(',')];

  logs.forEach((log) => {
    const row = [
      new Date(log.timestamp).toLocaleString(),
      log.type,
      log.username,
      `"${log.description.replace(/"/g, '""')}"`,
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
export async function downloadActivityLogs(
  format: 'json' | 'csv' = 'json',
  filter?: ActivityLogFilter
): Promise<void> {
  const content =
    format === 'json'
      ? await exportActivityLogsToJSON(filter)
      : await exportActivityLogsToCSV(filter);

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
// SYNC & MAINTENANCE
// ============================================================================

/**
 * Sync pending logs to Google Sheets
 * Call this periodically or on app initialization
 */
export async function syncPendingLogs(): Promise<number> {
  const pending = getPendingLogs();
  if (pending.length === 0) return 0;

  const success = await sendBatchToGoogleSheets(pending);
  if (success) {
    clearPendingQueue();
    return pending.length;
  }

  return 0;
}

/**
 * Get sync status
 */
export function getSyncStatus() {
  const pending = getPendingLogs();
  return {
    pendingCount: pending.length,
    googleSheetsConfigured: isGoogleSheetsConfigured(),
    lastPendingTimestamp: pending.length > 0 ? pending[pending.length - 1].timestamp : null,
  };
}

/**
 * Initialize activity log service
 * Attempts to sync pending logs on startup
 */
export async function initActivityLogService(): Promise<void> {
  if (isGoogleSheetsConfigured()) {
    console.log('Activity Log Service: Google Sheets integration enabled');
    await retryPendingLogs();
  } else {
    console.log('Activity Log Service: Running in offline mode (localStorage only)');
    console.log('To enable Google Sheets, set VITE_ACTIVITY_LOG_URL in your .env file');
  }
}
