/**
 * Storage Service Type Definitions
 *
 * Type definitions for the Supabase Storage Service
 */

/**
 * Supported document types for storage organization
 */
export type DocumentType =
  | 'payment_voucher'
  | 'statement_of_payment'
  | 'invoice'
  | 'receipt';

/**
 * Result of an upload operation
 */
export interface UploadResult {
  /** Whether the upload was successful */
  success: boolean;

  /** Storage path of the uploaded file (if successful) */
  path?: string;

  /** Signed URL for accessing the file (if successful) */
  url?: string;

  /** Error message (if failed) */
  error?: string;
}

/**
 * File metadata stored in database
 */
export interface FileMetadata {
  /** Unique identifier */
  id: string;

  /** Document ID this file belongs to */
  document_id: string;

  /** Type of document */
  document_type: DocumentType;

  /** Storage path */
  file_path: string;

  /** Original filename */
  file_name: string;

  /** File size in bytes */
  file_size: number;

  /** MIME type */
  file_type: string;

  /** Upload timestamp */
  uploaded_at: string;

  /** User who uploaded the file */
  uploaded_by: string;
}

/**
 * Upload options for additional control
 */
export interface UploadOptions {
  /** Whether to overwrite existing files (default: false) */
  upsert?: boolean;

  /** Cache control header (default: '3600') */
  cacheControl?: string;

  /** Content type override */
  contentType?: string;

  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Supported MIME types
 */
export type SupportedMimeType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/gif'
  | 'image/webp'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * File validation result
 */
export interface ValidationResult {
  /** Whether the file is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total number of files */
  total_files: number;

  /** Total storage size in bytes */
  total_size: number;

  /** Breakdown by document type */
  by_type: Record<DocumentType, {
    count: number;
    size: number;
  }>;
}

/**
 * File list item
 */
export interface StorageFile {
  /** File name */
  name: string;

  /** File ID */
  id: string;

  /** Last modified timestamp */
  updated_at: string;

  /** Created timestamp */
  created_at: string;

  /** Last accessed timestamp */
  last_accessed_at: string;

  /** File metadata */
  metadata: Record<string, any>;
}

/**
 * Batch upload result
 */
export interface BatchUploadResult {
  /** Number of successful uploads */
  successful: number;

  /** Number of failed uploads */
  failed: number;

  /** Total files attempted */
  total: number;

  /** Individual results */
  results: UploadResult[];
}

/**
 * Progress callback for uploads
 */
export type UploadProgressCallback = (
  /** Number of completed uploads */
  completed: number,

  /** Total number of uploads */
  total: number,

  /** Current file being uploaded */
  currentFile?: string
) => void;
