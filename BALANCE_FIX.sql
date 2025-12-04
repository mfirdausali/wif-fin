-- ============================================================================
-- WIF Finance - BALANCE FIX SCRIPT
-- ============================================================================
-- Run this AFTER running BALANCE_DIAGNOSTIC.sql to understand the issue
-- This script will:
-- 1. Create missing transaction records
-- 2. Recalculate all account balances from documents (the TRUE source)
-- ============================================================================

-- SAFETY: Start a transaction so we can rollback if needed
BEGIN;

-- ============================================================================
-- STEP 1: Create missing transaction records
-- ============================================================================

DO $$
DECLARE
    v_doc RECORD;
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
            r.payer_name,
            sop.payee_name,
            COALESCE(sop.total_deducted, d.amount) as effective_amount
        FROM documents d
        LEFT JOIN receipts r ON d.id = r.document_id
        LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
        WHERE d.status = 'completed'
          AND d.account_id IS NOT NULL
          AND d.deleted_at IS NULL
          AND d.document_type IN ('receipt', 'statement_of_payment')
          AND NOT EXISTS (
              SELECT 1 FROM transactions t WHERE t.document_id = d.id
          )
        ORDER BY d.created_at ASC
    LOOP
        -- Determine transaction type and amount
        IF v_doc.document_type = 'receipt' THEN
            v_txn_type := 'increase';
            v_amount := v_doc.amount;
            v_description := 'Payment received from ' || COALESCE(v_doc.payer_name, 'Customer') || ' - ' || v_doc.document_number;
        ELSIF v_doc.document_type = 'statement_of_payment' THEN
            v_txn_type := 'decrease';
            v_amount := v_doc.effective_amount;
            v_description := 'Payment made to ' || COALESCE(v_doc.payee_name, 'Vendor') || ' - ' || v_doc.document_number;
        ELSE
            CONTINUE;
        END IF;

        -- Create the missing transaction
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
            0,  -- Will be recalculated in Step 3
            0,  -- Will be recalculated in Step 3
            v_doc.created_at
        );

        v_created_count := v_created_count + 1;
        RAISE NOTICE 'Created transaction for % (%) - % amount: %',
            v_doc.document_number, v_doc.document_type, v_txn_type, v_amount;
    END LOOP;

    RAISE NOTICE 'Total transactions created: %', v_created_count;
END $$;

-- ============================================================================
-- STEP 2: Recalculate account balances from DOCUMENTS (TRUE SOURCE)
-- ============================================================================

DO $$
DECLARE
    v_account RECORD;
    v_calculated_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING ACCOUNT BALANCES FROM DOCUMENTS ===';

    FOR v_account IN SELECT id, name, current_balance, initial_balance FROM accounts WHERE deleted_at IS NULL LOOP
        -- Calculate correct balance from completed documents
        SELECT COALESCE(SUM(
            CASE
                WHEN d.document_type = 'receipt' THEN d.amount
                WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
                ELSE 0
            END
        ), 0) + COALESCE(v_account.initial_balance, 0) INTO v_calculated_balance
        FROM documents d
        LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
        WHERE d.account_id = v_account.id
          AND d.status = 'completed'
          AND d.deleted_at IS NULL
          AND d.document_type IN ('receipt', 'statement_of_payment');

        -- Update the account balance
        UPDATE accounts
        SET current_balance = v_calculated_balance,
            updated_at = NOW()
        WHERE id = v_account.id;

        IF v_account.current_balance != v_calculated_balance THEN
            RAISE NOTICE 'Account "%": FIXED from % to % (diff: %)',
                v_account.name,
                v_account.current_balance,
                v_calculated_balance,
                v_calculated_balance - v_account.current_balance;
        ELSE
            RAISE NOTICE 'Account "%": OK at %', v_account.name, v_calculated_balance;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Recalculate running balance_before/balance_after in transactions
-- ============================================================================

DO $$
DECLARE
    v_account RECORD;
    v_txn RECORD;
    v_running_balance DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING RUNNING BALANCES IN TRANSACTIONS ===';

    FOR v_account IN SELECT id, name, initial_balance FROM accounts WHERE deleted_at IS NULL LOOP
        v_running_balance := COALESCE(v_account.initial_balance, 0);

        FOR v_txn IN
            SELECT id, transaction_type, amount
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
-- STEP 4: Verification - confirm fix worked
-- ============================================================================

SELECT '=== VERIFICATION: Account balances after fix ===' as step;

WITH
doc_balance AS (
    SELECT
        a.id as account_id,
        a.name,
        a.current_balance as stored_balance,
        COALESCE(SUM(
            CASE
                WHEN d.document_type = 'receipt' THEN d.amount
                WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
                ELSE 0
            END
        ), 0) + COALESCE(a.initial_balance, 0) as doc_calculated_balance
    FROM accounts a
    LEFT JOIN documents d ON a.id = d.account_id
        AND d.status = 'completed'
        AND d.deleted_at IS NULL
        AND d.document_type IN ('receipt', 'statement_of_payment')
    LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.name, a.initial_balance, a.current_balance
)
SELECT
    name,
    stored_balance,
    doc_calculated_balance,
    CASE
        WHEN stored_balance = doc_calculated_balance THEN '✓ MATCH'
        ELSE '✗ STILL MISMATCHED'
    END as status
FROM doc_balance
ORDER BY name;

-- ============================================================================
-- COMMIT the transaction (uncomment when ready)
-- ============================================================================

-- If everything looks good, uncomment the next line to apply changes:
-- COMMIT;

-- If you see issues, rollback:
ROLLBACK;

-- ============================================================================
-- After verifying BALANCE_DIAGNOSTIC shows correct values,
-- run this script again with COMMIT uncommented to apply the fix.
-- ============================================================================
