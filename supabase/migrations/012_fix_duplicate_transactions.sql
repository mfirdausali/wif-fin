-- Fix: Prevent duplicate transactions when document is updated
--
-- ROOT CAUSE: The trigger fires on 'AFTER INSERT OR UPDATE OF status ON documents'
-- but does NOT check if a transaction already exists for that document.
-- This causes duplicates when:
--   1. Document is inserted with status='completed' → trigger fires → transaction created
--   2. ANY update to the document → trigger fires AGAIN → DUPLICATE transaction!
--
-- THE FIX:
--   1. For INSERT: Only create transaction if status is 'completed'
--   2. For UPDATE: Only create transaction if status CHANGED to 'completed' (was NOT 'completed' before)
--   3. Always check if a transaction already exists for this document to prevent duplicates

CREATE OR REPLACE FUNCTION create_transaction_on_document_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_account accounts%ROWTYPE;
    v_amount DECIMAL(15,2);
    v_txn_type TEXT;
    v_description TEXT;
    v_total_deducted DECIMAL(15,2);
    v_existing_transaction_count INT;
BEGIN
    -- Only process receipts and statements of payment with 'completed' status
    IF NEW.status = 'completed' AND NEW.account_id IS NOT NULL THEN

        -- CRITICAL FIX: For UPDATE, only proceed if status CHANGED to 'completed'
        -- This prevents duplicate transactions when document is updated while already completed
        IF TG_OP = 'UPDATE' THEN
            -- If status was already 'completed', skip (no change)
            IF OLD.status = 'completed' THEN
                RAISE NOTICE 'Skipping transaction creation: status was already completed for document %', NEW.document_number;
                RETURN NEW;
            END IF;
        END IF;

        -- SAFETY CHECK: Verify no transaction already exists for this document
        -- This is a belt-and-suspenders check to prevent any edge case duplicates
        SELECT COUNT(*) INTO v_existing_transaction_count
        FROM transactions
        WHERE document_id = NEW.id
          AND transaction_type IN ('increase', 'decrease')
          AND (metadata IS NULL OR NOT (metadata->>'reversal')::boolean);

        IF v_existing_transaction_count > 0 THEN
            RAISE NOTICE 'Skipping transaction creation: transaction already exists for document % (count: %)',
                NEW.document_number, v_existing_transaction_count;
            RETURN NEW;
        END IF;

        -- Determine transaction type and amount based on document type
        IF NEW.document_type = 'receipt' THEN
            -- Receipt increases balance
            v_amount := NEW.amount;
            v_txn_type := 'increase';
            v_description := 'Payment received - ' || NEW.document_number;

        ELSIF NEW.document_type = 'statement_of_payment' THEN
            -- Statement of payment decreases balance
            -- Try to get total_deducted from statements_of_payment table
            SELECT total_deducted INTO v_total_deducted
            FROM statements_of_payment
            WHERE document_id = NEW.id;

            -- Use total_deducted if available, otherwise fallback to NEW.amount
            -- This handles the case where the trigger fires before the statement record is created
            v_amount := COALESCE(v_total_deducted, NEW.amount);

            v_txn_type := 'decrease';
            v_description := 'Payment made - ' || NEW.document_number;

        ELSE
            -- Not a receipt or statement_of_payment, skip
            RETURN NEW;
        END IF;

        -- Get account and update balance (with row lock)
        SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id FOR UPDATE;

        -- Create transaction record
        INSERT INTO transactions (
            account_id,
            document_id,
            transaction_type,
            description,
            amount,
            balance_before,
            balance_after,
            transaction_date
        ) VALUES (
            NEW.account_id,
            NEW.id,
            v_txn_type,
            v_description,
            v_amount,
            v_account.current_balance,
            v_account.current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END,
            NOW()
        );

        -- Update account balance
        UPDATE accounts
        SET current_balance = current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END,
            updated_at = NOW()
        WHERE id = NEW.account_id;

        RAISE NOTICE 'Transaction created for document %: % % (new balance: %)',
            NEW.document_number,
            v_txn_type,
            v_amount,
            v_account.current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment documenting the fix
COMMENT ON FUNCTION create_transaction_on_document_complete() IS
'Creates a transaction record when a document (receipt/statement_of_payment) reaches completed status.
IMPORTANT: Only fires once per document - checks both OLD.status and existing transactions to prevent duplicates.
Fixed in migration 012 to prevent duplicate transactions.';
