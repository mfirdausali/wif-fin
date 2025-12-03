-- Fix: Reverse account balance when document is soft-deleted
--
-- Issue: When a receipt or statement_of_payment is deleted (soft-deleted by
-- setting deleted_at), the account balance is NOT reversed, causing incorrect
-- balances.
--
-- THE CORRECT FLOW:
-- 1. Document created with status='completed' → Trigger creates transaction + updates balance ✓
-- 2. Document DELETED (soft-delete) → Should REVERSE the balance (this fix)
--
-- IMPORTANT NOTES:
-- - Receipts INCREASE balance, so deletion should DECREASE
-- - Statements of Payment DECREASE balance, so deletion should INCREASE
-- - Only documents with status='completed' affect balance
-- - We only reverse if there's an associated transaction (safety check)

CREATE OR REPLACE FUNCTION reverse_transaction_on_document_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_account accounts%ROWTYPE;
    v_amount DECIMAL(15,2);
    v_txn_type TEXT;
    v_description TEXT;
    v_existing_transaction transactions%ROWTYPE;
BEGIN
    -- Only process if document is being soft-deleted (deleted_at changes from NULL to a timestamp)
    -- AND the document was completed (only completed documents have transactions)
    -- AND the document has an account_id
    IF OLD.deleted_at IS NULL
       AND NEW.deleted_at IS NOT NULL
       AND NEW.status = 'completed'
       AND NEW.account_id IS NOT NULL THEN

        -- Check if there's an existing transaction for this document
        SELECT * INTO v_existing_transaction
        FROM transactions
        WHERE document_id = NEW.id
        LIMIT 1;

        -- Only reverse if a transaction exists (safety check)
        IF FOUND THEN
            IF NEW.document_type = 'receipt' THEN
                -- Receipt originally increased balance, so deletion decreases it
                v_amount := v_existing_transaction.amount;
                v_txn_type := 'decrease';
                v_description := 'Reversal (deleted) - ' || NEW.document_number;

            ELSIF NEW.document_type = 'statement_of_payment' THEN
                -- Statement of payment originally decreased balance, so deletion increases it
                v_amount := v_existing_transaction.amount;
                v_txn_type := 'increase';
                v_description := 'Reversal (deleted) - ' || NEW.document_number;

            ELSE
                -- Not a document type that affects balance
                RETURN NEW;
            END IF;

            -- Get account and update balance (with row lock)
            SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id FOR UPDATE;

            -- Create reversal transaction record
            INSERT INTO transactions (
                account_id,
                document_id,
                transaction_type,
                description,
                amount,
                balance_before,
                balance_after,
                transaction_date,
                metadata
            ) VALUES (
                NEW.account_id,
                NEW.id,
                v_txn_type,
                v_description,
                v_amount,
                v_account.current_balance,
                v_account.current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END,
                NOW(),
                jsonb_build_object(
                    'reversal', true,
                    'original_transaction_id', v_existing_transaction.id,
                    'reason', 'document_deleted'
                )
            );

            -- Update account balance
            UPDATE accounts
            SET current_balance = current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END,
                updated_at = NOW()
            WHERE id = NEW.account_id;

            RAISE NOTICE 'Balance reversed for document %: % % (new balance: %)',
                NEW.document_number,
                v_txn_type,
                v_amount,
                v_account.current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires AFTER UPDATE (when deleted_at is set)
CREATE TRIGGER reverse_transaction_on_delete_trigger
AFTER UPDATE OF deleted_at ON documents
FOR EACH ROW
EXECUTE FUNCTION reverse_transaction_on_document_delete();

-- Add comment to document the trigger
COMMENT ON TRIGGER reverse_transaction_on_delete_trigger ON documents IS
'Automatically reverses account balance when a completed document (receipt/statement_of_payment) is soft-deleted';
