-- Cleanup: Remove duplicate transactions and recalculate account balances
--
-- This script:
-- 1. Disables ONLY the user-defined immutability trigger (not system triggers)
-- 2. Identifies duplicate transactions (multiple transactions for the same document_id)
-- 3. Keeps only the FIRST transaction for each document
-- 4. Recalculates all account balances from scratch based on clean transaction history
-- 5. Re-enables the immutability trigger
--
-- WARNING: Run this AFTER migration 012 to prevent new duplicates from being created

-- Step 0: Find and disable ONLY the user-defined immutability trigger
-- First, let's see what triggers exist on the transactions table
DO $$
DECLARE
    v_trigger_name TEXT;
BEGIN
    FOR v_trigger_name IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'transactions'::regclass
        AND NOT tgisinternal  -- Only user-defined triggers
    LOOP
        RAISE NOTICE 'Found user trigger: %', v_trigger_name;
        EXECUTE format('ALTER TABLE transactions DISABLE TRIGGER %I', v_trigger_name);
        RAISE NOTICE 'Disabled trigger: %', v_trigger_name;
    END LOOP;
END $$;

-- Step 1: Create a temporary table to identify transactions to keep (the first one per document)
CREATE TEMP TABLE transactions_to_keep AS
SELECT DISTINCT ON (document_id) id
FROM transactions
WHERE document_id IS NOT NULL
  AND transaction_type IN ('increase', 'decrease')
  AND (metadata IS NULL OR NOT (metadata->>'reversal')::boolean)
ORDER BY document_id, transaction_date ASC, id ASC;

-- Step 2: Log how many duplicates we're about to delete
DO $$
DECLARE
    v_total_txns INT;
    v_keep_txns INT;
    v_delete_txns INT;
BEGIN
    SELECT COUNT(*) INTO v_total_txns
    FROM transactions
    WHERE document_id IS NOT NULL
      AND transaction_type IN ('increase', 'decrease')
      AND (metadata IS NULL OR NOT (metadata->>'reversal')::boolean);

    SELECT COUNT(*) INTO v_keep_txns FROM transactions_to_keep;

    v_delete_txns := v_total_txns - v_keep_txns;

    RAISE NOTICE '=== DUPLICATE TRANSACTION CLEANUP ===';
    RAISE NOTICE 'Total non-reversal transactions: %', v_total_txns;
    RAISE NOTICE 'Transactions to keep (first per document): %', v_keep_txns;
    RAISE NOTICE 'Duplicate transactions to delete: %', v_delete_txns;
END $$;

-- Step 3: Delete duplicate transactions (keep only the first one per document)
DELETE FROM transactions
WHERE document_id IS NOT NULL
  AND transaction_type IN ('increase', 'decrease')
  AND (metadata IS NULL OR NOT (metadata->>'reversal')::boolean)
  AND id NOT IN (SELECT id FROM transactions_to_keep);

-- Step 4: Also delete orphaned reversal transactions that were created for duplicates
-- These reversals reference the wrong balance and should be regenerated if needed
DELETE FROM transactions
WHERE metadata IS NOT NULL
  AND (metadata->>'reversal')::boolean = true
  AND document_id IN (
    SELECT document_id FROM transactions
    GROUP BY document_id
    HAVING COUNT(*) > 2  -- More than original + reversal means there were duplicates
  );

-- Step 5: Recalculate all account balances from transaction history
DO $$
DECLARE
    v_account RECORD;
    v_calculated_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING ACCOUNT BALANCES ===';

    FOR v_account IN SELECT id, name, current_balance, initial_balance FROM accounts LOOP
        v_initial_balance := COALESCE(v_account.initial_balance, 0);

        -- Calculate balance from all transactions
        SELECT COALESCE(SUM(
            CASE
                WHEN transaction_type = 'increase' THEN amount
                WHEN transaction_type = 'decrease' THEN -amount
                ELSE 0
            END
        ), 0) + v_initial_balance INTO v_calculated_balance
        FROM transactions
        WHERE account_id = v_account.id;

        -- Update if different
        IF v_calculated_balance != v_account.current_balance THEN
            UPDATE accounts
            SET current_balance = v_calculated_balance, updated_at = NOW()
            WHERE id = v_account.id;

            RAISE NOTICE 'Account "%": % -> % (diff: %)',
                v_account.name,
                v_account.current_balance,
                v_calculated_balance,
                v_calculated_balance - v_account.current_balance;
        ELSE
            RAISE NOTICE 'Account "%": % (no change)', v_account.name, v_account.current_balance;
        END IF;
    END LOOP;
END $$;

-- Step 6: Update balance_before and balance_after in transactions table
-- to reflect the correct running balance after cleanup
DO $$
DECLARE
    v_account RECORD;
    v_txn RECORD;
    v_running_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== UPDATING TRANSACTION RUNNING BALANCES ===';

    FOR v_account IN SELECT id, name, initial_balance FROM accounts LOOP
        v_initial_balance := COALESCE(v_account.initial_balance, 0);
        v_running_balance := v_initial_balance;

        FOR v_txn IN
            SELECT id, transaction_type, amount
            FROM transactions
            WHERE account_id = v_account.id
            ORDER BY transaction_date ASC, id ASC
        LOOP
            UPDATE transactions
            SET balance_before = v_running_balance,
                balance_after = v_running_balance +
                    CASE
                        WHEN v_txn.transaction_type = 'increase' THEN v_txn.amount
                        WHEN v_txn.transaction_type = 'decrease' THEN -v_txn.amount
                        ELSE 0
                    END
            WHERE id = v_txn.id;

            v_running_balance := v_running_balance +
                CASE
                    WHEN v_txn.transaction_type = 'increase' THEN v_txn.amount
                    WHEN v_txn.transaction_type = 'decrease' THEN -v_txn.amount
                    ELSE 0
                END;
        END LOOP;

        RAISE NOTICE 'Account "%": Updated running balances for all transactions', v_account.name;
    END LOOP;
END $$;

-- Cleanup temp table
DROP TABLE transactions_to_keep;

-- Step 7: Re-enable ONLY user-defined triggers
DO $$
DECLARE
    v_trigger_name TEXT;
BEGIN
    FOR v_trigger_name IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'transactions'::regclass
        AND NOT tgisinternal  -- Only user-defined triggers
    LOOP
        EXECUTE format('ALTER TABLE transactions ENABLE TRIGGER %I', v_trigger_name);
        RAISE NOTICE 'Re-enabled trigger: %', v_trigger_name;
    END LOOP;
END $$;

-- Final verification
DO $$
DECLARE
    v_duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT document_id
        FROM transactions
        WHERE document_id IS NOT NULL
          AND transaction_type IN ('increase', 'decrease')
          AND (metadata IS NULL OR NOT (metadata->>'reversal')::boolean)
        GROUP BY document_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF v_duplicate_count > 0 THEN
        RAISE WARNING 'CLEANUP INCOMPLETE: % documents still have duplicate transactions', v_duplicate_count;
    ELSE
        RAISE NOTICE '=== CLEANUP COMPLETE: No duplicate transactions remain ===';
    END IF;
END $$;
