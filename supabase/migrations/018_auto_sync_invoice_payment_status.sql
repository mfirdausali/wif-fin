-- ============================================================================
-- WIF Finance - Auto-Sync Invoice Payment Status
-- Migration: 018
-- Description: Automatically update invoice status based on payment progress
-- ============================================================================

-- Problem:
-- When receipts are created/updated/deleted, the invoice status should
-- automatically reflect the payment state:
--   - 'issued' when balance_due > 0 (unpaid or partially paid)
--   - 'paid' when balance_due <= 0 (fully paid)

-- Solution:
-- Create a trigger on receipts table that recalculates and updates
-- the linked invoice's status whenever a receipt is inserted, updated, or deleted.

-- ============================================================================
-- STEP 0: Update validation function to allow paid <-> issued transitions
-- ============================================================================

-- First, let's check and update the validation function to allow
-- system-initiated status changes between 'issued' and 'paid'
CREATE OR REPLACE FUNCTION validate_document_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow same status (no change)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow any transition to 'cancelled'
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- Allow draft -> issued
    IF OLD.status = 'draft' AND NEW.status = 'issued' THEN
        RETURN NEW;
    END IF;

    -- Allow issued -> paid (manual or automatic via receipt)
    IF OLD.status = 'issued' AND NEW.status = 'paid' THEN
        RETURN NEW;
    END IF;

    -- Allow paid -> issued (when receipts are deleted/cancelled)
    IF OLD.status = 'paid' AND NEW.status = 'issued' THEN
        RETURN NEW;
    END IF;

    -- Allow paid -> completed
    IF OLD.status = 'paid' AND NEW.status = 'completed' THEN
        RETURN NEW;
    END IF;

    -- Allow cancelled -> draft (reopen)
    IF OLD.status = 'cancelled' AND NEW.status = 'draft' THEN
        RETURN NEW;
    END IF;

    -- Block all other transitions
    RAISE EXCEPTION 'Invalid status transition from % to % for document %',
        OLD.status, NEW.status, OLD.document_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1: Create function to sync invoice payment status
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_invoice_document_id UUID;
    v_invoice_total DECIMAL(15,2);
    v_amount_paid DECIMAL(15,2);
    v_current_status TEXT;
    v_new_status TEXT;
BEGIN
    -- Determine which invoice to check based on operation
    IF TG_OP = 'DELETE' THEN
        v_invoice_id := OLD.linked_invoice_id;
    ELSE
        v_invoice_id := NEW.linked_invoice_id;
    END IF;

    -- If no linked invoice, nothing to do
    IF v_invoice_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Get the invoice document details
    SELECT d.id, d.amount, d.status
    INTO v_invoice_document_id, v_invoice_total, v_current_status
    FROM invoices i
    JOIN documents d ON i.document_id = d.id
    WHERE i.id = v_invoice_id
      AND d.deleted_at IS NULL;

    -- If invoice not found or deleted, skip
    IF v_invoice_document_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Don't modify cancelled or completed invoices
    IF v_current_status IN ('cancelled', 'completed') THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Calculate total paid from all linked receipts (excluding soft-deleted)
    SELECT COALESCE(SUM(rd.amount), 0)
    INTO v_amount_paid
    FROM receipts r
    JOIN documents rd ON r.document_id = rd.id
    WHERE r.linked_invoice_id = v_invoice_id
      AND rd.deleted_at IS NULL
      AND rd.status IN ('completed', 'paid');

    -- Determine new status based on payment
    IF v_amount_paid >= v_invoice_total THEN
        v_new_status := 'paid';
    ELSE
        -- If was 'paid' but now not fully paid, revert to 'issued'
        -- If was 'draft', keep as 'draft' (don't auto-advance)
        IF v_current_status = 'paid' THEN
            v_new_status := 'issued';
        ELSE
            v_new_status := v_current_status;
        END IF;
    END IF;

    -- Update invoice status if changed
    IF v_new_status != v_current_status THEN
        UPDATE documents
        SET status = v_new_status,
            updated_at = NOW()
        WHERE id = v_invoice_document_id;

        RAISE NOTICE 'Invoice % status changed from % to % (paid: %, total: %)',
            v_invoice_document_id, v_current_status, v_new_status, v_amount_paid, v_invoice_total;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create trigger on receipts table
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_invoice_status_on_receipt_change ON receipts;

-- Create trigger for INSERT, UPDATE, DELETE on receipts
CREATE TRIGGER sync_invoice_status_on_receipt_change
    AFTER INSERT OR UPDATE OR DELETE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION sync_invoice_payment_status();

-- ============================================================================
-- STEP 3: Create trigger for document status/soft-delete changes
-- ============================================================================

-- We also need to sync when a receipt document's status changes
-- or when it's soft-deleted

CREATE OR REPLACE FUNCTION sync_invoice_on_receipt_document_change()
RETURNS TRIGGER AS $$
DECLARE
    v_receipt_record RECORD;
    v_invoice_id UUID;
    v_invoice_document_id UUID;
    v_invoice_total DECIMAL(15,2);
    v_amount_paid DECIMAL(15,2);
    v_current_status TEXT;
    v_new_status TEXT;
BEGIN
    -- Only process receipt documents
    IF NEW.document_type != 'receipt' THEN
        RETURN NEW;
    END IF;

    -- Only process if status changed or document was soft-deleted
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = NEW.status AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Get the linked invoice from receipts table
    SELECT r.linked_invoice_id
    INTO v_invoice_id
    FROM receipts r
    WHERE r.document_id = NEW.id;

    -- If no linked invoice, nothing to do
    IF v_invoice_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the invoice document details
    SELECT d.id, d.amount, d.status
    INTO v_invoice_document_id, v_invoice_total, v_current_status
    FROM invoices i
    JOIN documents d ON i.document_id = d.id
    WHERE i.id = v_invoice_id
      AND d.deleted_at IS NULL;

    -- If invoice not found or deleted, skip
    IF v_invoice_document_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Don't modify cancelled or completed invoices
    IF v_current_status IN ('cancelled', 'completed') THEN
        RETURN NEW;
    END IF;

    -- Calculate total paid from all linked receipts
    SELECT COALESCE(SUM(rd.amount), 0)
    INTO v_amount_paid
    FROM receipts r
    JOIN documents rd ON r.document_id = rd.id
    WHERE r.linked_invoice_id = v_invoice_id
      AND rd.deleted_at IS NULL
      AND rd.status IN ('completed', 'paid');

    -- Determine new status
    IF v_amount_paid >= v_invoice_total THEN
        v_new_status := 'paid';
    ELSE
        IF v_current_status = 'paid' THEN
            v_new_status := 'issued';
        ELSE
            v_new_status := v_current_status;
        END IF;
    END IF;

    -- Update if changed
    IF v_new_status != v_current_status THEN
        UPDATE documents
        SET status = v_new_status,
            updated_at = NOW()
        WHERE id = v_invoice_document_id;

        RAISE NOTICE 'Invoice % status changed from % to % via receipt document change',
            v_invoice_document_id, v_current_status, v_new_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_invoice_on_receipt_doc_change ON documents;

-- Create trigger for receipt document changes
CREATE TRIGGER sync_invoice_on_receipt_doc_change
    AFTER UPDATE OF status, deleted_at ON documents
    FOR EACH ROW
    WHEN (NEW.document_type = 'receipt')
    EXECUTE FUNCTION sync_invoice_on_receipt_document_change();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON FUNCTION sync_invoice_payment_status() IS
'Automatically updates invoice status based on payment progress when receipts are added/modified/deleted.
- Sets status to "paid" when total receipts >= invoice amount
- Reverts to "issued" if receipts are removed and balance becomes > 0
- Does not modify cancelled or completed invoices
- Does not auto-advance draft invoices';

COMMENT ON FUNCTION sync_invoice_on_receipt_document_change() IS
'Syncs invoice status when a receipt document status changes or is soft-deleted.
Works in conjunction with sync_invoice_payment_status trigger.';

-- ============================================================================
-- STEP 5: Backfill - Update existing invoices based on current payment status
-- ============================================================================

-- Update invoices that should be 'paid' but aren't
UPDATE documents d
SET status = 'paid',
    updated_at = NOW()
FROM invoices i
WHERE d.id = i.document_id
  AND d.deleted_at IS NULL
  AND d.status = 'issued'  -- Only update issued invoices
  AND (
    SELECT COALESCE(SUM(rd.amount), 0)
    FROM receipts r
    JOIN documents rd ON r.document_id = rd.id
    WHERE r.linked_invoice_id = i.id
      AND rd.deleted_at IS NULL
      AND rd.status IN ('completed', 'paid')
  ) >= d.amount;

-- Update invoices that are 'paid' but shouldn't be
UPDATE documents d
SET status = 'issued',
    updated_at = NOW()
FROM invoices i
WHERE d.id = i.document_id
  AND d.deleted_at IS NULL
  AND d.status = 'paid'  -- Only update paid invoices
  AND (
    SELECT COALESCE(SUM(rd.amount), 0)
    FROM receipts r
    JOIN documents rd ON r.document_id = rd.id
    WHERE r.linked_invoice_id = i.id
      AND rd.deleted_at IS NULL
      AND rd.status IN ('completed', 'paid')
  ) < d.amount;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'sync_invoice_payment_status function created' as check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_invoice_payment_status')
    THEN 'PASS' ELSE 'FAIL' END as status;

SELECT 'sync_invoice_status_on_receipt_change trigger created' as check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_invoice_status_on_receipt_change')
    THEN 'PASS' ELSE 'FAIL' END as status;

SELECT 'sync_invoice_on_receipt_doc_change trigger created' as check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_invoice_on_receipt_doc_change')
    THEN 'PASS' ELSE 'FAIL' END as status;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
