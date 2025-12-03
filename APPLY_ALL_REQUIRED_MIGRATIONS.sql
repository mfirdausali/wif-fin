-- ============================================================================
-- COMPLETE MIGRATION BUNDLE - Apply ALL of these in Supabase SQL Editor
-- ============================================================================
-- This file contains all pending migrations that need to be applied to your
-- Supabase database to fix current errors and enable new features.
--
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq/sql
-- 2. Copy this ENTIRE file
-- 3. Paste into the SQL Editor
-- 4. Click RUN
-- 5. Verify you see "Success" message
--
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Migrate cost_center_id to booking_id in documents table
-- ============================================================================
-- Fixes: "Could not find the 'cost_center_id' column"
-- From: supabase/migrations/007_migrate_to_bookings.sql

-- Drop old cost center constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_cost_center_id_fkey;

-- Rename column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name = 'cost_center_id'
  ) THEN
    ALTER TABLE documents RENAME COLUMN cost_center_id TO booking_id;
  END IF;
END $$;

-- Add booking_id if not exists
ALTER TABLE documents ADD COLUMN IF NOT EXISTS booking_id UUID;

-- Add foreign key to bookings
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_booking_id_fkey;

ALTER TABLE documents
  ADD CONSTRAINT documents_booking_id_fkey
  FOREIGN KEY (booking_id)
  REFERENCES bookings(id)
  ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);

-- Drop old tables (optional)
DROP TABLE IF EXISTS booking_forms CASCADE;
DROP TABLE IF EXISTS cost_centers CASCADE;

-- ============================================================================
-- MIGRATION 2: Add allow_negative_balance to companies table
-- ============================================================================
-- Enables: Allow accounts to have negative balances (overdraft)
-- From: supabase/migrations/008_add_allow_negative_balance.sql

-- Add the setting column
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS allow_negative_balance BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN companies.allow_negative_balance IS 'Allow accounts to have negative balances (overdraft). When FALSE, payments that would result in negative balance are blocked.';

-- Update existing companies to have the default setting
UPDATE companies
SET allow_negative_balance = FALSE
WHERE allow_negative_balance IS NULL;

-- ============================================================================
-- MIGRATION 3: Fix Statement of Payment transaction amount NULL error
-- ============================================================================
-- Fixes: "null value in column 'amount' of relation 'transactions' violates not-null constraint"
-- From: supabase/migrations/008_fix_sop_transaction_amount.sql

CREATE OR REPLACE FUNCTION create_transaction_on_document_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_account accounts%ROWTYPE;
    v_amount DECIMAL(15,2);
    v_txn_type TEXT;
    v_description TEXT;
    v_total_deducted DECIMAL(15,2);
BEGIN
    IF NEW.status = 'completed' AND NEW.account_id IS NOT NULL THEN
        IF NEW.document_type = 'receipt' THEN
            v_amount := NEW.amount;
            v_txn_type := 'increase';
            v_description := 'Payment received - ' || NEW.document_number;
        ELSIF NEW.document_type = 'statement_of_payment' THEN
            SELECT total_deducted INTO v_total_deducted
            FROM statements_of_payment
            WHERE document_id = NEW.id;
            -- Use COALESCE to fallback to NEW.amount if total_deducted is NULL
            v_amount := COALESCE(v_total_deducted, NEW.amount);
            v_txn_type := 'decrease';
            v_description := 'Payment made - ' || NEW.document_number;
        ELSE
            RETURN NEW;
        END IF;
        SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id FOR UPDATE;
        INSERT INTO transactions (account_id, document_id, transaction_type, description, amount, balance_before, balance_after, transaction_date)
        VALUES (NEW.account_id, NEW.id, v_txn_type, v_description, v_amount, v_account.current_balance, v_account.current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END, NOW());
        UPDATE accounts SET current_balance = current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END, updated_at = NOW() WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION 4: Add transfer_proof columns to statements_of_payment
-- ============================================================================
-- Fixes: "Could not find the 'transfer_proof_base64' column"
-- From: supabase/migrations/009_add_transfer_proof_to_sop.sql

-- Add transfer_proof_filename if it doesn't exist
ALTER TABLE statements_of_payment
ADD COLUMN IF NOT EXISTS transfer_proof_filename TEXT;

-- Add transfer_proof_base64 if it doesn't exist
ALTER TABLE statements_of_payment
ADD COLUMN IF NOT EXISTS transfer_proof_base64 TEXT;

-- Add comments
COMMENT ON COLUMN statements_of_payment.transfer_proof_filename IS 'Filename of the transfer proof/receipt image';
COMMENT ON COLUMN statements_of_payment.transfer_proof_base64 IS 'Base64 encoded transfer proof/receipt image. Consider moving to storage bucket for large files.';

-- ============================================================================
-- VERIFICATION - Check that all migrations were applied
-- ============================================================================

-- Check documents table has booking_id (not cost_center_id)
SELECT
  'documents.booking_id exists' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'documents' AND column_name = 'booking_id'
    ) THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

-- Check companies table has allow_negative_balance
SELECT
  'companies.allow_negative_balance exists' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'allow_negative_balance'
    ) THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

-- Check statements_of_payment has transfer_proof columns
SELECT
  'statements_of_payment.transfer_proof_base64 exists' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'statements_of_payment' AND column_name = 'transfer_proof_base64'
    ) THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

-- ============================================================================
-- ALL DONE!
-- ============================================================================
-- You should see three "✓ PASS" messages above.
-- If any show "✗ FAIL", please report the error.
-- ============================================================================
