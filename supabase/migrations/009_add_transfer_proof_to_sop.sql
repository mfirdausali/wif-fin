-- Migration: Add transfer_proof columns to statements_of_payment table
-- These columns may be missing if the initial schema wasn't fully applied

-- Add transfer_proof_filename if it doesn't exist
ALTER TABLE statements_of_payment
ADD COLUMN IF NOT EXISTS transfer_proof_filename TEXT;

-- Add transfer_proof_base64 if it doesn't exist
ALTER TABLE statements_of_payment
ADD COLUMN IF NOT EXISTS transfer_proof_base64 TEXT;

-- Add comments
COMMENT ON COLUMN statements_of_payment.transfer_proof_filename IS 'Filename of the transfer proof/receipt image';
COMMENT ON COLUMN statements_of_payment.transfer_proof_base64 IS 'Base64 encoded transfer proof/receipt image. Consider moving to storage bucket for large files.';
