-- ============================================================================
-- WIF Finance - BALANCE DIAGNOSTIC SCRIPT
-- ============================================================================
-- Run this in Supabase SQL Editor to identify the MYR 7,000 vs MYR 8,950 issue
-- ============================================================================

-- STEP 1: Show all accounts with their current stored balance
SELECT '=== STEP 1: All Accounts ===' as step;
SELECT
    id,
    name,
    currency,
    initial_balance,
    current_balance as "stored_balance_in_db"
FROM accounts
WHERE deleted_at IS NULL
ORDER BY name;

-- STEP 2: Calculate balance from TRANSACTIONS table
SELECT '=== STEP 2: Balance from TRANSACTIONS table ===' as step;
SELECT
    a.id,
    a.name,
    a.initial_balance,
    a.current_balance as "stored_balance",
    COALESCE(SUM(
        CASE
            WHEN t.transaction_type = 'increase' THEN t.amount
            WHEN t.transaction_type = 'decrease' THEN -t.amount
            ELSE 0
        END
    ), 0) + a.initial_balance as "calculated_from_transactions",
    a.current_balance - (COALESCE(SUM(
        CASE
            WHEN t.transaction_type = 'increase' THEN t.amount
            WHEN t.transaction_type = 'decrease' THEN -t.amount
            ELSE 0
        END
    ), 0) + a.initial_balance) as "discrepancy"
FROM accounts a
LEFT JOIN transactions t ON a.id = t.account_id
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.name, a.initial_balance, a.current_balance
ORDER BY a.name;

-- STEP 3: Calculate balance from DOCUMENTS table (the TRUE source)
SELECT '=== STEP 3: Balance from DOCUMENTS (TRUE SOURCE) ===' as step;
SELECT
    a.id,
    a.name,
    a.initial_balance,
    a.current_balance as "stored_balance",
    COALESCE(SUM(
        CASE
            WHEN d.document_type = 'receipt' THEN d.amount
            WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
            ELSE 0
        END
    ), 0) + a.initial_balance as "calculated_from_documents",
    a.current_balance - (COALESCE(SUM(
        CASE
            WHEN d.document_type = 'receipt' THEN d.amount
            WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
            ELSE 0
        END
    ), 0) + a.initial_balance) as "discrepancy"
FROM accounts a
LEFT JOIN documents d ON a.id = d.account_id
    AND d.status = 'completed'
    AND d.deleted_at IS NULL
    AND d.document_type IN ('receipt', 'statement_of_payment')
LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.name, a.initial_balance, a.current_balance
ORDER BY a.name;

-- STEP 4: Show all completed documents that SHOULD affect balance
SELECT '=== STEP 4: Completed Documents Affecting Balance ===' as step;
SELECT
    d.document_number,
    d.document_type,
    d.status,
    d.amount as "document_amount",
    sop.total_deducted as "sop_total_deducted",
    CASE
        WHEN d.document_type = 'receipt' THEN d.amount
        WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
        ELSE 0
    END as "balance_impact",
    a.name as "account_name",
    d.created_at
FROM documents d
LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
LEFT JOIN accounts a ON d.account_id = a.id
WHERE d.status = 'completed'
  AND d.deleted_at IS NULL
  AND d.document_type IN ('receipt', 'statement_of_payment')
ORDER BY d.created_at ASC;

-- STEP 5: Show all TRANSACTIONS recorded
SELECT '=== STEP 5: All Transactions Recorded ===' as step;
SELECT
    t.id,
    t.transaction_type,
    t.amount,
    t.description,
    t.balance_before,
    t.balance_after,
    a.name as "account_name",
    d.document_number,
    d.document_type,
    t.transaction_date
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN documents d ON t.document_id = d.id
ORDER BY t.transaction_date ASC;

-- STEP 6: Find documents WITHOUT transactions (MISSING TRANSACTIONS!)
SELECT '=== STEP 6: MISSING TRANSACTIONS - Documents without transaction records ===' as step;
SELECT
    d.id as document_id,
    d.document_number,
    d.document_type,
    d.status,
    d.amount,
    sop.total_deducted,
    a.name as "account_name",
    d.created_at
FROM documents d
LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
LEFT JOIN accounts a ON d.account_id = a.id
WHERE d.status = 'completed'
  AND d.account_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.document_type IN ('receipt', 'statement_of_payment')
  AND NOT EXISTS (
      SELECT 1 FROM transactions t WHERE t.document_id = d.id
  )
ORDER BY d.created_at ASC;

-- STEP 7: Summary comparison
SELECT '=== STEP 7: FINAL COMPARISON ===' as step;
WITH
doc_balance AS (
    SELECT
        a.id as account_id,
        a.name,
        a.initial_balance,
        a.current_balance as stored_balance,
        COALESCE(SUM(
            CASE
                WHEN d.document_type = 'receipt' THEN d.amount
                WHEN d.document_type = 'statement_of_payment' THEN -COALESCE(sop.total_deducted, d.amount)
                ELSE 0
            END
        ), 0) + a.initial_balance as doc_calculated_balance
    FROM accounts a
    LEFT JOIN documents d ON a.id = d.account_id
        AND d.status = 'completed'
        AND d.deleted_at IS NULL
        AND d.document_type IN ('receipt', 'statement_of_payment')
    LEFT JOIN statements_of_payment sop ON d.id = sop.document_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.name, a.initial_balance, a.current_balance
),
txn_balance AS (
    SELECT
        a.id as account_id,
        COALESCE(SUM(
            CASE
                WHEN t.transaction_type = 'increase' THEN t.amount
                WHEN t.transaction_type = 'decrease' THEN -t.amount
                ELSE 0
            END
        ), 0) + a.initial_balance as txn_calculated_balance
    FROM accounts a
    LEFT JOIN transactions t ON a.id = t.account_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.initial_balance
)
SELECT
    db.name,
    db.initial_balance,
    db.stored_balance as "DB_current_balance",
    db.doc_calculated_balance as "From_Documents",
    tb.txn_calculated_balance as "From_Transactions",
    db.stored_balance - db.doc_calculated_balance as "Stored_vs_Docs_DIFF",
    db.doc_calculated_balance - tb.txn_calculated_balance as "Docs_vs_Txn_DIFF"
FROM doc_balance db
JOIN txn_balance tb ON db.account_id = tb.account_id
ORDER BY db.name;

-- The last query shows:
-- - If "Stored_vs_Docs_DIFF" is non-zero: DB balance is wrong, needs recalculation
-- - If "Docs_vs_Txn_DIFF" is non-zero: Missing transaction records (Step 6 shows which ones)
