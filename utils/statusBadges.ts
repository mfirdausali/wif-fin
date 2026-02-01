/**
 * Unified status badge utility for consistent status display across the application.
 * This ensures all status badges use the same color scheme and formatting.
 */

export interface StatusBadge {
  label: string;
  className: string;
}

// Define color mappings for common statuses
const STATUS_COLOR_MAP: Record<string, string> = {
  // Draft/Planning states - gray/slate tones
  'draft': 'bg-slate-100 text-slate-800',
  'planning': 'bg-gray-100 text-gray-800',

  // Pending/In-progress states - yellow/amber tones
  'pending': 'bg-yellow-100 text-yellow-800',
  'in progress': 'bg-yellow-100 text-yellow-800',
  'in_progress': 'bg-yellow-100 text-yellow-800',

  // Active/Confirmed states - blue tones
  'issued': 'bg-blue-100 text-blue-800',
  'confirmed': 'bg-blue-100 text-blue-800',
  'active': 'bg-blue-100 text-blue-800',

  // Success/Completed states - green tones
  'approved': 'bg-green-100 text-green-800',
  'paid': 'bg-green-100 text-green-800',
  'completed': 'bg-green-100 text-green-800',
  'success': 'bg-green-100 text-green-800',

  // Error/Cancelled states - red tones
  'cancelled': 'bg-red-100 text-red-800',
  'rejected': 'bg-red-100 text-red-800',
  'failed': 'bg-red-100 text-red-800',
  'error': 'bg-red-100 text-red-800',

  // Warning states - orange tones
  'overdue': 'bg-orange-100 text-orange-800',
  'warning': 'bg-orange-100 text-orange-800',

  // Info states - purple tones
  'processing': 'bg-purple-100 text-purple-800',
};

// Default color for unknown statuses
const DEFAULT_COLOR = 'bg-gray-100 text-gray-800';

/**
 * Get a unified status badge with consistent styling.
 *
 * @param status - The status string to convert to a badge
 * @returns StatusBadge object with label and className
 *
 * @example
 * const badge = statusBadge('in_progress');
 * // Returns: { label: 'In progress', className: 'bg-yellow-100 text-yellow-800' }
 */
export const statusBadge = (status: string): StatusBadge => {
  // Normalize status: lowercase and replace underscores with spaces for lookup
  const normalized = status.toLowerCase().replace(/_/g, ' ');

  // Also check original status (for cases like 'in_progress' that are mapped directly)
  const originalLower = status.toLowerCase();

  // Format label: capitalize first letter, replace underscores with spaces
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  // Look up color - try normalized first, then original lowercase, then default
  const className = STATUS_COLOR_MAP[normalized]
    || STATUS_COLOR_MAP[originalLower]
    || DEFAULT_COLOR;

  return { label, className };
};

/**
 * Get just the color class for a status (useful when you want to control the label separately)
 *
 * @param status - The status string
 * @returns The Tailwind CSS class string for the status color
 */
export const getStatusColor = (status: string): string => {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  const originalLower = status.toLowerCase();

  return STATUS_COLOR_MAP[normalized]
    || STATUS_COLOR_MAP[originalLower]
    || DEFAULT_COLOR;
};

/**
 * Check if a status represents a "positive" outcome (completed, paid, approved, etc.)
 */
export const isPositiveStatus = (status: string): boolean => {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  return ['approved', 'paid', 'completed', 'success'].includes(normalized);
};

/**
 * Check if a status represents a "negative" outcome (cancelled, rejected, failed, etc.)
 */
export const isNegativeStatus = (status: string): boolean => {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  return ['cancelled', 'rejected', 'failed', 'error'].includes(normalized);
};

/**
 * Check if a status represents an "in-progress" state
 */
export const isInProgressStatus = (status: string): boolean => {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  return ['pending', 'in progress', 'processing'].includes(normalized);
};
