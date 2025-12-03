-- FINAL CLEANUP: Remove all duplicate transactions and recalculate from scratch
--
-- The previous cleanup didn't work because it used DISTINCT ON by transaction_date,
-- but duplicates have different timestamps.
--
-- This script:
-- 1. Groups transactions by document description (the actual duplicate indicator)
-- 2. Keeps only ONE transaction per unique document
-- 3. Deletes ALL manual reversal transactions (they're now wrong)
-- 4. Recalculates everything from scratch

-- Step 0: Disable user triggers
DO $$
DECLARE
    v_trigger_name TEXT;
BEGIN
    FOR v_trigger_name IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'transactions'::regclass
        AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE transactions DISABLE TRIGGER %I', v_trigger_name);
        RAISE NOTICE 'Disabled trigger: %', v_trigger_name;
    END LOOP;
END $$;

-- Step 1: Find and log all duplicates (transactions with same description pattern)
DO $$
DECLARE
    v_dup RECORD;
BEGIN
    RAISE NOTICE '=== FINDING DUPLICATES BY DESCRIPTION ===';
    FOR v_dup IN
        SELECT description, COUNT(*) as cnt
        FROM transactions
        WHERE description LIKE 'Payment received -%'
           OR description LIKE 'Payment made -%'
        GROUP BY description
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'DUPLICATE: "%" appears % times', v_dup.description, v_dup.cnt;
    END LOOP;
END $$;

-- Step 2: Create temp table with IDs to KEEP (oldest transaction per unique description)
CREATE TEMP TABLE txns_to_keep AS
SELECT DISTINCT ON (description) id, description, transaction_date
FROM transactions
WHERE (description LIKE 'Payment received -%' OR description LIKE 'Payment made -%')
ORDER BY description, transaction_date ASC, id ASC;

-- Step 3: Delete duplicate payment transactions (keep only first occurrence)
DELETE FROM transactions
WHERE (description LIKE 'Payment received -%' OR description LIKE 'Payment made -%')
  AND id NOT IN (SELECT id FROM txns_to_keep);

-- Step 4: Delete ALL manual reversal transactions - they have wrong balances now
-- We'll let the system create new ones if needed
DELETE FROM transactions
WHERE description LIKE 'REVERSAL:%'
   OR description LIKE '%Duplicate transaction correction%';

-- Step 5: Verify what's left
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM transactions;
    RAISE NOTICE 'Remaining transactions after cleanup: %', v_count;
END $$;

-- Step 6: Recalculate account balances from scratch
DO $$
DECLARE
    v_account RECORD;
    v_calculated_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING ACCOUNT BALANCES ===';

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

        RAISE NOTICE 'Account "%": old=% new=% (initial=%)',
            v_account.name,
            v_account.current_balance,
            v_calculated_balance,
            v_initial_balance;
    END LOOP;
END $$;

-- Step 7: Recalculate running balance_before/balance_after for all transactions
DO $$
DECLARE
    v_account RECORD;
    v_txn RECORD;
    v_running_balance DECIMAL(15,2);
    v_initial_balance DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
BEGIN
    RAISE NOTICE '=== RECALCULATING RUNNING BALANCES ===';

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

            RAISE NOTICE '  %: % -> %', v_txn.description, v_running_balance, v_new_balance;

            v_running_balance := v_new_balance;
        END LOOP;

        RAISE NOTICE 'Account "%" final balance: %', v_account.name, v_running_balance;
    END LOOP;
END $$;

-- Cleanup temp table
DROP TABLE txns_to_keep;

-- Step 8: Re-enable triggers
DO $$
DECLARE
    v_trigger_name TEXT;
BEGIN
    FOR v_trigger_name IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'transactions'::regclass
        AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE transactions ENABLE TRIGGER %I', v_trigger_name);
        RAISE NOTICE 'Re-enabled trigger: %', v_trigger_name;
    END LOOP;
END $$;

-- Final verification
SELECT
    id,
    description,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    transaction_date
FROM transactions
WHERE account_id = 'bc1db44c-b1fd-4ae8-b192-bcf9b7d53c0b'
ORDER BY transaction_date ASC, id ASC;
