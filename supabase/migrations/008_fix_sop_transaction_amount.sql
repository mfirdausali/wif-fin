-- Fix: Statement of Payment transaction amount is null
--
-- Issue: The create_transaction_on_document_complete trigger tries to SELECT
-- total_deducted from statements_of_payment table BEFORE that record exists,
-- causing v_amount to be NULL and violating the NOT NULL constraint.
--
-- Solution: Use NEW.amount as fallback when total_deducted is not yet available

CREATE OR REPLACE FUNCTION create_transaction_on_document_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_account accounts%ROWTYPE;
    v_amount DECIMAL(15,2);
    v_txn_type TEXT;
    v_description TEXT;
    v_total_deducted DECIMAL(15,2);
BEGIN
    -- Only process receipts and statements of payment with 'completed' status
    IF NEW.status = 'completed' AND NEW.account_id IS NOT NULL THEN
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
