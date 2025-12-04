-- ============================================================================
-- WIF Finance - Fix Missing Transactions and Recalculate Account Balances
-- Migration: 019
-- Description: Find completed receipts/SOPs without transactions, create them,
--              and recalculate account balances from scratch
-- ============================================================================

-- Problem:
-- Some receipts show in Transaction History (calculated from documents) but
-- the account.currentBalance doesn't match (calculated from transactions table).
-- This means some documents have no corresponding transaction records.

-- Root Cause:
-- 1. Race condition between web app's manual balance update and DB trigger
-- 2. Trigger may have failed or wasn't applied for some historical documents
-- 3. Documents created before trigger was properly configured

-- Solution:
-- 1. Find all completed documents that should affect balance but have no transaction
-- 2. Create missing transaction records
-- 3. Recalculate all account balances from transactions

-- ============================================================================
-- STEP 0: Diagnostic - Show current state before fix
-- ============================================================================

DO $$
DECLARE
    v_doc RECORD;
    v_missing_count INT := 0;
BEGIN
    RAISE NOTICE '=== DIAGNOSTICS: Finding completed documents without transactions ===';

    FOR v_doc IN
        SELECT
            d.id as document_id,
            d.document_number,
            d.document_type,
            d.status,
            d.amount,
            d.account_id,
            a.name as account_name
        FROM documents d
        LEFT JOIN accounts a ON d.account_id = a.id
        WHERE d.status = 'completed'
          AND d.account_id IS NOT NULL
          AND d.deleted_at IS NULL
          AND d.document_type IN ('receipt', 'statement_of_payment')
          AND NOT EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.document_id = d.id
          )
    LOOP
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE 'MISSING TXN: % (%) - % % - Account: %',
            v_doc.document_number,
            v_doc.document_type,
            v_doc.amount,
            v_doc.status,
            v_doc.account_name;
    END LOOP;

    RAISE NOTICE 'Total documents missing transactions: %', v_missing_count;
END $$;

-- ============================================================================
-- STEP 1: Create missing transactions for completed documents
-- ============================================================================

DO $$
DECLARE
    v_doc RECORD;
    v_account RECORD;
    v_txn_type TEXT;
    v_amount DECIMAL(15,2);
    v_description TEXT;
    v_created_count INT := 0;
BEGIN
    RAISE NOTICE '=== CREATING MISSING TRANSACTIONS ===';

    FOR v_doc IN
        SELECT
            d.id as document_id,
            d.document_number,
            d.document_type,
            d.status,
            d.amount,
            d.account_id,
            d.created_at,
            COALESCE(sop.total_deducted, d.amount) as effective_amount
        FROM documents d
        LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
        WHERE d.status = 'completed'
          AND d.account_id IS NOT NULL
          AND d.deleted_at IS NULL
          AND d.document_type IN ('receipt', 'statement_of_payment')
          AND NOT EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.document_id = d.id
          )
        ORDER BY d.created_at ASC
    LOOP
        -- Get current account balance (needed for balance_before)
        SELECT * INTO v_account FROM accounts WHERE id = v_doc.account_id FOR UPDATE;

        IF v_account IS NULL THEN
            RAISE NOTICE 'WARNING: Account not found for document %', v_doc.document_number;
            CONTINUE;
        END IF;

        -- Determine transaction type and amount
        IF v_doc.document_type = 'receipt' THEN
            v_txn_type := 'increase';
            v_amount := v_doc.amount;
            v_description := 'Payment received - ' || v_doc.document_number;
        ELSIF v_doc.document_type = 'statement_of_payment' THEN
            v_txn_type := 'decrease';
            v_amount := v_doc.effective_amount;
            v_description := 'Payment made - ' || v_doc.document_number;
        ELSE
            CONTINUE;
        END IF;

        -- Create the missing transaction
        -- Note: balance_before/balance_after will be recalculated in Step 2
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
            v_doc.account_id,
            v_doc.document_id,
            v_txn_type,
            v_description,
            v_amount,
            0,  -- Will be recalculated
            0,  -- Will be recalculated
            v_doc.created_at  -- Use document creation date
        );

        v_created_count := v_created_count + 1;
        RAISE NOTICE 'Created transaction for % (%) - % %',
            v_doc.document_number,
            v_doc.document_type,
            v_txn_type,
            v_amount;
    END LOOP;

    RAISE NOTICE 'Total transactions created: %', v_created_count;
END $$;

-- ============================================================================
-- STEP 2: Recalculate account balances from scratch
-- ============================================================================

DO $$
DECLARE
    v_account RECORD;
    v_calculated_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING ACCOUNT BALANCES FROM TRANSACTIONS ===';

    FOR v_account IN SELECT id, name, current_balance, initial_balance FROM accounts LOOP
        v_initial_balance := COALESCE(v_account.initial_balance, 0);

        SELECT COALESCE(SUM(
            CASE
                WHEN transaction_type = 'increase' THEN amount
                WHEN transaction_type = 'decrease' THEN -amount
                ELSE 0
            END
        ), 0) + v_initial_balance INTO v_calculated_balance
        FROM transactions
        WHERE account_id = v_account.id;

        UPDATE accounts
        SET current_balance = v_calculated_balance, updated_at = NOW()
        WHERE id = v_account.id;

        IF v_account.current_balance != v_calculated_balance THEN
            RAISE NOTICE 'Account "%": was % now % (diff: %)',
                v_account.name,
                v_account.current_balance,
                v_calculated_balance,
                v_calculated_balance - v_account.current_balance;
        ELSE
            RAISE NOTICE 'Account "%": unchanged at %', v_account.name, v_calculated_balance;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Recalculate running balance_before/balance_after for all transactions
-- ============================================================================

DO $$
DECLARE
    v_account RECORD;
    v_txn RECORD;
    v_running_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING RUNNING BALANCES IN TRANSACTIONS ===';

    FOR v_account IN SELECT id, name, initial_balance FROM accounts LOOP
        v_initial_balance := COALESCE(v_account.initial_balance, 0);
        v_running_balance := v_initial_balance;

        FOR v_txn IN
            SELECT id, transaction_type, amount, description
            FROM transactions
            WHERE account_id = v_account.id
            ORDER BY transaction_date ASC, id ASC
        LOOP
            v_new_balance := v_running_balance +
                CASE
                    WHEN v_txn.transaction_type = 'increase' THEN v_txn.amount
                    WHEN v_txn.transaction_type = 'decrease' THEN -v_txn.amount
                    ELSE 0
                END;

            UPDATE transactions
            SET balance_before = v_running_balance,
                balance_after = v_new_balance
            WHERE id = v_txn.id;

            v_running_balance := v_new_balance;
        END LOOP;

        RAISE NOTICE 'Account "%": final running balance = %', v_account.name, v_running_balance;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

-- Check for any remaining mismatches
DO $$
DECLARE
    v_account RECORD;
    v_txn_balance DECIMAL(15,2);
    v_doc_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== VERIFICATION: Comparing transaction vs document totals ===';

    FOR v_account IN SELECT id, name, current_balance, initial_balance FROM accounts LOOP
        v_initial_balance := COALESCE(v_account.initial_balance, 0);

        -- Balance from transactions
        SELECT COALESCE(SUM(
            CASE WHEN transaction_type = 'increase' THEN amount
                 WHEN transaction_type = 'decrease' THEN -amount
                 ELSE 0 END
        ), 0) + v_initial_balance INTO v_txn_balance
        FROM transactions
        WHERE account_id = v_account.id;

        -- Balance from documents (completed receipts and SOPs)
        SELECT COALESCE(SUM(
            CASE WHEN d.document_type = 'receipt' THEN d.amount
                 WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
                 ELSE 0 END
        ), 0) + v_initial_balance INTO v_doc_balance
        FROM documents d
        LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
        WHERE d.account_id = v_account.id
          AND d.status = 'completed'
          AND d.deleted_at IS NULL
          AND d.document_type IN ('receipt', 'statement_of_payment');

        IF v_txn_balance != v_doc_balance THEN
            RAISE WARNING 'MISMATCH Account "%": transactions=% documents=% (diff=%)',
                v_account.name, v_txn_balance, v_doc_balance, v_doc_balance - v_txn_balance;
        ELSE
            RAISE NOTICE 'OK Account "%": %', v_account.name, v_txn_balance;
        END IF;

        IF v_account.current_balance != v_txn_balance THEN
            RAISE WARNING 'Account "%" current_balance mismatch: stored=% calculated=%',
                v_account.name, v_account.current_balance, v_txn_balance;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration 019 completed: Missing transactions created, balances recalculated' as status;
