/**
 * Supabase Storage Service
 *
 * Shared storage service for file uploads that can be used by both web and mobile apps.
 * Handles file uploads to Supabase Storage 'documents' bucket with organized file paths.
 *
 * Features:
 * - Upload files from base64 strings or File/Blob objects
 * - Generate unique file paths: {document_type}/{document_id}/{timestamp}_{filename}
 * - Get signed URLs for secure file viewing (valid for 1 hour)
 * - Delete files when documents are removed
 * - Comprehensive error handling
 */

import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'documents';
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

/**
 * Convert base64 string to Blob
 * @param base64Data - Base64 encoded string (with or without data URI prefix)
 * @param contentType - MIME type of the file
 * @returns Blob object
 */
function base64ToBlob(base64Data: string, contentType: string = 'application/octet-stream'): Blob {
  // Remove data URI prefix if present (e.g., "data:application/pdf;base64,")
  const base64String = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  // Decode base64 to binary string
  const binaryString = atob(base64String);

  // Convert binary string to byte array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: contentType });
}

/**
 * Generate a unique file path for storage
 * @param documentType - Type of document (payment_voucher, statement_of_payment, etc.)
 * @param documentId - Unique identifier for the document
 * @param fileName - Original filename
 * @returns Formatted file path
 */
function generateFilePath(
  documentType: 'payment_voucher' | 'statement_of_payment' | 'invoice' | 'receipt',
  documentId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${documentType}/${documentId}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Get MIME type from filename extension
 * @param fileName - Filename with extension
 * @returns MIME type string
 */
function getMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

/**
 * Upload file from base64 string
 * @param base64Data - Base64 encoded file data
 * @param fileName - Original filename
 * @param documentType - Type of document
 * @param documentId - Document identifier
 * @returns Upload result with success status, file path, and URL
 */
export async function uploadFromBase64(
  base64Data: string,
  fileName: string,
  documentType: 'payment_voucher' | 'statement_of_payment' | 'invoice' | 'receipt',
  documentId: string
): Promise<UploadResult> {
  try {
    // Validate inputs
    if (!base64Data || !fileName || !documentType || !documentId) {
      return {
        success: false,
        error: 'Missing required parameters for file upload',
      };
    }

    // Convert base64 to blob
    const contentType = getMimeType(fileName);
    const blob = base64ToBlob(base64Data, contentType);

    // Upload using the common upload function
    return await uploadFile(blob, fileName, documentType, documentId);
  } catch (error) {
    console.error('Error uploading file from base64:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file from base64',
    };
  }
}

/**
 * Upload file from File or Blob object
 * @param file - File or Blob object to upload
 * @param fileName - Original filename
 * @param documentType - Type of document
 * @param documentId - Document identifier
 * @returns Upload result with success status, file path, and URL
 */
export async function uploadFile(
  file: File | Blob,
  fileName: string,
  documentType: 'payment_voucher' | 'statement_of_payment' | 'invoice' | 'receipt',
  documentId: string
): Promise<UploadResult> {
  try {
    // Validate inputs
    if (!file || !fileName || !documentType || !documentId) {
      return {
        success: false,
        error: 'Missing required parameters for file upload',
      };
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size exceeds maximum limit of 50MB',
      };
    }

    // Generate unique file path
    const filePath = generateFilePath(documentType, documentId, fileName);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return {
        success: false,
        error: `Failed to upload file: ${error.message}`,
      };
    }

    if (!data || !data.path) {
      return {
        success: false,
        error: 'Upload succeeded but no path was returned',
      };
    }

    // Get signed URL for the uploaded file
    const signedUrl = await getSignedUrl(data.path);

    return {
      success: true,
      path: data.path,
      url: signedUrl || undefined,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    };
  }
}

/**
 * Get signed URL for viewing a file
 * @param path - File path in storage
 * @returns Signed URL string or null if failed
 */
export async function getSignedUrl(path: string): Promise<string | null> {
  try {
    if (!path) {
      console.error('Cannot get signed URL: path is empty');
      return null;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

/**
 * Delete file from storage
 * @param path - File path in storage
 * @returns True if deletion was successful, false otherwise
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    if (!path) {
      console.error('Cannot delete file: path is empty');
      return false;
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Error deleting file:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Delete all files for a specific document
 * @param documentType - Type of document
 * @param documentId - Document identifier
 * @returns True if deletion was successful, false otherwise
 */
export async function deleteDocumentFiles(
  documentType: 'payment_voucher' | 'statement_of_payment' | 'invoice' | 'receipt',
  documentId: string
): Promise<boolean> {
  try {
    if (!documentType || !documentId) {
      console.error('Cannot delete document files: missing parameters');
      return false;
    }

    // List all files for this document
    const folderPath = `${documentType}/${documentId}`;
    const { data: fileList, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folderPath);

    if (listError) {
      console.error('Error listing files for deletion:', listError);
      return false;
    }

    if (!fileList || fileList.length === 0) {
      // No files to delete, consider this a success
      return true;
    }

    // Delete all files in the folder
    const filePaths = fileList.map(file => `${folderPath}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('Error deleting document files:', deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting document files:', error);
    return false;
  }
}

/**
 * Get public URL for a file (if bucket is public)
 * Note: For private buckets, use getSignedUrl instead
 * @param path - File path in storage
 * @returns Public URL string
 */
export function getPublicUrl(path: string): string | null {
  try {
    if (!path) {
      console.error('Cannot get public URL: path is empty');
      return null;
    }

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return data?.publicUrl || null;
  } catch (error) {
    console.error('Error getting public URL:', error);
    return null;
  }
}

/**
 * Check if a file exists in storage
 * @param path - File path in storage
 * @returns True if file exists, false otherwise
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    if (!path) {
      return false;
    }

    // Try to get file metadata
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(path.substring(0, path.lastIndexOf('/')), {
        search: path.substring(path.lastIndexOf('/') + 1),
      });

    if (error) {
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}
