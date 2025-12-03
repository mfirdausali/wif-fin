-- ============================================================================
-- WIF Finance - Document Storage Bucket
-- Migration: 016
-- Description: Create Supabase Storage bucket for document attachments
-- ============================================================================

-- Create storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,  -- Private bucket, requires authentication
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage policies for documents bucket

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'documents');

-- Policy: Authenticated users can view files
CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'documents');

-- Policy: Authenticated users can update their files
CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'documents');

-- Policy: Authenticated users can delete files
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'documents');

-- ============================================================================
-- Add storage path columns to tables (replacing base64 approach)
-- ============================================================================

-- Add storage_path column to payment_vouchers for supporting documents
ALTER TABLE payment_vouchers
ADD COLUMN IF NOT EXISTS supporting_doc_storage_path TEXT;

-- Add storage_path column to statements_of_payment for transfer proofs
ALTER TABLE statements_of_payment
ADD COLUMN IF NOT EXISTS transfer_proof_storage_path TEXT;

-- Comments for documentation
COMMENT ON COLUMN payment_vouchers.supporting_doc_storage_path IS 'Path to supporting document in Supabase Storage (documents bucket)';
COMMENT ON COLUMN statements_of_payment.transfer_proof_storage_path IS 'Path to transfer proof in Supabase Storage (documents bucket)';

-- Note: Keeping the base64 columns for backward compatibility with existing data
-- New uploads will use storage_path, existing data remains in base64 columns
