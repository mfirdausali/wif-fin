-- Test Script: Verify Balance Reversal on Document Deletion
-- Run this after applying the balance reversal fix

-- =================================================================
-- SETUP: Get a test account
-- =================================================================
DO $$
DECLARE
    v_test_account_id UUID;
    v_test_account_name TEXT;
    v_initial_balance DECIMAL(15,2);
BEGIN
    -- Get the first active account
    SELECT id, name, current_balance
    INTO v_test_account_id, v_test_account_name, v_initial_balance
    FROM accounts
    WHERE is_active = true
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_test_account_id IS NULL THEN
        RAISE EXCEPTION 'No active accounts found. Please create an account first.';
    END IF;

    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TEST ACCOUNT: % (ID: %)', v_test_account_name, v_test_account_id;
    RAISE NOTICE 'INITIAL BALANCE: %', v_initial_balance;
    RAISE NOTICE '=================================================================';
END $$;

-- =================================================================
-- TEST 1: Receipt Deletion (Should DECREASE balance)
-- =================================================================
DO $$
DECLARE
    v_test_account_id UUID;
    v_company_id UUID;
    v_test_receipt_id UUID;
    v_test_receipt_number TEXT;
    v_balance_before DECIMAL(15,2);
    v_balance_after_create DECIMAL(15,2);
    v_balance_after_delete DECIMAL(15,2);
    v_test_amount DECIMAL(15,2) := 100.00;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'TEST 1: Receipt Deletion (Should DECREASE balance)';
    RAISE NOTICE '-----------------------------------------------------------------';

    -- Get test account and company
    SELECT id INTO v_test_account_id FROM accounts WHERE is_active = true AND deleted_at IS NULL LIMIT 1;
    SELECT id INTO v_company_id FROM companies LIMIT 1;

    -- Get balance before
    SELECT current_balance INTO v_balance_before FROM accounts WHERE id = v_test_account_id;
    RAISE NOTICE '1. Balance BEFORE creating receipt: %', v_balance_before;

    -- Create a test receipt with completed status
    INSERT INTO documents (
        company_id,
        account_id,
        document_type,
        document_number,
        status,
        document_date,
        currency,
        country,
        amount
    ) VALUES (
        v_company_id,
        v_test_account_id,
        'receipt',
        'TEST-RCP-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        'completed',
        CURRENT_DATE,
        'MYR',
        'Malaysia',
        v_test_amount
    ) RETURNING id, document_number INTO v_test_receipt_id, v_test_receipt_number;

    -- Create receipt-specific data
    INSERT INTO receipts (
        document_id,
        payer_name,
        payer_contact,
        receipt_date,
        payment_method,
        received_by
    ) VALUES (
        v_test_receipt_id,
        'Test Payer',
        'test@example.com',
        CURRENT_DATE,
        'Cash',
        'Test User'
    );

    -- Get balance after creation (should increase)
    SELECT current_balance INTO v_balance_after_create FROM accounts WHERE id = v_test_account_id;
    RAISE NOTICE '2. Balance AFTER creating receipt: % (Change: +%)', v_balance_after_create, v_balance_after_create - v_balance_before;

    -- Delete the receipt (soft delete)
    UPDATE documents
    SET deleted_at = NOW()
    WHERE id = v_test_receipt_id;

    -- Get balance after deletion (should decrease back)
    SELECT current_balance INTO v_balance_after_delete FROM accounts WHERE id = v_test_account_id;
    RAISE NOTICE '3. Balance AFTER deleting receipt: % (Change: %)', v_balance_after_delete, v_balance_after_delete - v_balance_after_create;

    -- Verify
    IF v_balance_after_delete = v_balance_before THEN
        RAISE NOTICE '✅ TEST PASSED: Balance correctly reversed!';
    ELSE
        RAISE WARNING '❌ TEST FAILED: Balance not reversed correctly. Expected: %, Got: %',
            v_balance_before, v_balance_after_delete;
    END IF;

    -- Show transaction history for this document
    RAISE NOTICE '';
    RAISE NOTICE 'Transaction History for %:', v_test_receipt_number;
    RAISE NOTICE '-----------------------------------------------------------------';
    PERFORM
        RAISE NOTICE '% | % | % | % → %',
            to_char(transaction_date, 'YYYY-MM-DD HH24:MI:SS'),
            transaction_type,
            amount,
            balance_before,
            balance_after
    FROM transactions
    WHERE document_id = v_test_receipt_id
    ORDER BY created_at;

    -- Cleanup: Actually delete the test data
    DELETE FROM receipts WHERE document_id = v_test_receipt_id;
    DELETE FROM transactions WHERE document_id = v_test_receipt_id;
    DELETE FROM documents WHERE id = v_test_receipt_id;

    -- Restore original balance
    UPDATE accounts SET current_balance = v_balance_before WHERE id = v_test_account_id;

    RAISE NOTICE 'Test data cleaned up, balance restored to %', v_balance_before;
    RAISE NOTICE '=================================================================';
END $$;

-- =================================================================
-- TEST 2: Statement of Payment Deletion (Should INCREASE balance)
-- =================================================================
DO $$
DECLARE
    v_test_account_id UUID;
    v_company_id UUID;
    v_test_voucher_id UUID;
    v_test_sop_id UUID;
    v_test_sop_number TEXT;
    v_balance_before DECIMAL(15,2);
    v_balance_after_create DECIMAL(15,2);
    v_balance_after_delete DECIMAL(15,2);
    v_test_amount DECIMAL(15,2) := 100.00;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'TEST 2: Statement of Payment Deletion (Should INCREASE balance)';
    RAISE NOTICE '-----------------------------------------------------------------';

    -- Get test account and company
    SELECT id INTO v_test_account_id FROM accounts WHERE is_active = true AND deleted_at IS NULL LIMIT 1;
    SELECT id INTO v_company_id FROM companies LIMIT 1;

    -- Get balance before
    SELECT current_balance INTO v_balance_before FROM accounts WHERE id = v_test_account_id;
    RAISE NOTICE '1. Balance BEFORE creating SOP: %', v_balance_before;

    -- Create a test payment voucher first
    INSERT INTO documents (
        company_id,
        document_type,
        document_number,
        status,
        document_date,
        currency,
        country,
        amount
    ) VALUES (
        v_company_id,
        'payment_voucher',
        'TEST-PV-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        'draft',
        CURRENT_DATE,
        'MYR',
        'Malaysia',
        v_test_amount
    ) RETURNING id INTO v_test_voucher_id;

    -- Create voucher-specific data
    INSERT INTO payment_vouchers (
        document_id,
        payee_name,
        voucher_date,
        requested_by
    ) VALUES (
        v_test_voucher_id,
        'Test Payee',
        CURRENT_DATE,
        'Test User'
    );

    -- Create statement of payment with completed status
    INSERT INTO documents (
        company_id,
        account_id,
        document_type,
        document_number,
        status,
        document_date,
        currency,
        country,
        amount
    ) VALUES (
        v_company_id,
        v_test_account_id,
        'statement_of_payment',
        'TEST-SOP-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        'completed',
        CURRENT_DATE,
        'MYR',
        'Malaysia',
        v_test_amount
    ) RETURNING id, document_number INTO v_test_sop_id, v_test_sop_number;

    -- Create SOP-specific data
    INSERT INTO statements_of_payment (
        document_id,
        linked_voucher_id,
        payment_date,
        payment_method,
        transaction_reference,
        confirmed_by,
        payee_name,
        total_deducted
    ) VALUES (
        v_test_sop_id,
        (SELECT id FROM payment_vouchers WHERE document_id = v_test_voucher_id),
        CURRENT_DATE,
        'Bank Transfer',
        'TEST-REF-123',
        'Test User',
        'Test Payee',
        v_test_amount
    );

    -- Get balance after creation (should decrease)
    SELECT current_balance INTO v_balance_after_create FROM accounts WHERE id = v_test_account_id;
    RAISE NOTICE '2. Balance AFTER creating SOP: % (Change: %)', v_balance_after_create, v_balance_after_create - v_balance_before;

    -- Delete the SOP (soft delete)
    UPDATE documents
    SET deleted_at = NOW()
    WHERE id = v_test_sop_id;

    -- Get balance after deletion (should increase back)
    SELECT current_balance INTO v_balance_after_delete FROM accounts WHERE id = v_test_account_id;
    RAISE NOTICE '3. Balance AFTER deleting SOP: % (Change: +%)', v_balance_after_delete, v_balance_after_delete - v_balance_after_create;

    -- Verify
    IF v_balance_after_delete = v_balance_before THEN
        RAISE NOTICE '✅ TEST PASSED: Balance correctly reversed!';
    ELSE
        RAISE WARNING '❌ TEST FAILED: Balance not reversed correctly. Expected: %, Got: %',
            v_balance_before, v_balance_after_delete;
    END IF;

    -- Cleanup: Actually delete the test data
    DELETE FROM statements_of_payment WHERE document_id = v_test_sop_id;
    DELETE FROM payment_vouchers WHERE document_id = v_test_voucher_id;
    DELETE FROM transactions WHERE document_id = v_test_sop_id;
    DELETE FROM documents WHERE id IN (v_test_sop_id, v_test_voucher_id);

    -- Restore original balance
    UPDATE accounts SET current_balance = v_balance_before WHERE id = v_test_account_id;

    RAISE NOTICE 'Test data cleaned up, balance restored to %', v_balance_before;
    RAISE NOTICE '=================================================================';
END $$;

-- =================================================================
-- FINAL SUMMARY
-- =================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'BALANCE REVERSAL TESTS COMPLETE';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Check the output above for ✅ or ❌ marks';
    RAISE NOTICE 'Both tests should show: ✅ TEST PASSED: Balance correctly reversed!';
    RAISE NOTICE '';
    RAISE NOTICE 'To check reversal transactions in your database:';
    RAISE NOTICE 'SELECT * FROM transactions WHERE metadata->>''reversal'' = ''true'';';
    RAISE NOTICE '=================================================================';
END $$;
