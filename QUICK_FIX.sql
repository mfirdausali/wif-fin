-- QUICK FIX for Statement of Payment NULL transaction amount error
-- Copy and paste this entire content into Supabase SQL Editor and run it

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
