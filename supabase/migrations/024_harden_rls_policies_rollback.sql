-- ============================================================================
-- WIF Finance - Rollback Hardened RLS Policies
-- Migration: 024_rollback
-- Description: Restore previous permissive RLS policies if needed
-- ============================================================================
-- WARNING: This rollback restores PERMISSIVE policies that allow
--          anonymous access to sensitive data. Only use in emergency.
-- ============================================================================

-- ============================================================================
-- DROP HELPER FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS auth.user_company_id();

-- ============================================================================
-- COMPANIES TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS companies_public_read ON companies;
DROP POLICY IF EXISTS companies_no_anon_modify ON companies;
DROP POLICY IF EXISTS companies_service_role_full ON companies;

-- Restore original permissive policies
CREATE POLICY "Allow public read access to companies" ON companies
    FOR SELECT
    TO public, anon, authenticated
    USING (true);

CREATE POLICY "Allow public insert to companies" ON companies
    FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow public update to companies" ON companies
    FOR UPDATE
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete from companies" ON companies
    FOR DELETE
    TO public, anon, authenticated
    USING (true);

-- ============================================================================
-- ACCOUNTS TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS accounts_no_anon_access ON accounts;
DROP POLICY IF EXISTS accounts_service_role_full ON accounts;

CREATE POLICY "Allow all access to accounts" ON accounts
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- DOCUMENTS TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS documents_no_anon_access ON documents;
DROP POLICY IF EXISTS documents_service_role_full ON documents;

CREATE POLICY "Allow all access to documents" ON documents
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- INVOICES TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS invoices_no_anon_access ON invoices;
DROP POLICY IF EXISTS invoices_service_role_full ON invoices;

CREATE POLICY "Allow all access to invoices" ON invoices
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- RECEIPTS TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS receipts_no_anon_access ON receipts;
DROP POLICY IF EXISTS receipts_service_role_full ON receipts;

CREATE POLICY "Allow all access to receipts" ON receipts
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- PAYMENT VOUCHERS TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS payment_vouchers_no_anon_access ON payment_vouchers;
DROP POLICY IF EXISTS payment_vouchers_service_role_full ON payment_vouchers;

CREATE POLICY "Allow all access to payment_vouchers" ON payment_vouchers
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STATEMENTS OF PAYMENT TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS statements_of_payment_no_anon_access ON statements_of_payment;
DROP POLICY IF EXISTS statements_of_payment_service_role_full ON statements_of_payment;

CREATE POLICY "Allow all access to statements_of_payment" ON statements_of_payment
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- LINE ITEMS TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS line_items_no_anon_access ON line_items;
DROP POLICY IF EXISTS line_items_service_role_full ON line_items;

CREATE POLICY "Allow all access to line_items" ON line_items
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- COST CENTERS TABLE - Restore original policies
-- ============================================================================
DROP POLICY IF EXISTS cost_centers_no_anon_access ON cost_centers;
DROP POLICY IF EXISTS cost_centers_service_role_full ON cost_centers;

-- Restore original permissive policies
CREATE POLICY cost_centers_select_all ON cost_centers
    FOR SELECT
    USING (true);

CREATE POLICY cost_centers_service_all ON cost_centers
    FOR ALL
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON cost_centers TO authenticated;
GRANT ALL ON cost_centers TO service_role;

-- ============================================================================
-- REMOVE COMMENTS
-- ============================================================================
COMMENT ON TABLE companies IS NULL;
COMMENT ON TABLE accounts IS NULL;
COMMENT ON TABLE documents IS NULL;
COMMENT ON TABLE invoices IS NULL;
COMMENT ON TABLE receipts IS NULL;
COMMENT ON TABLE payment_vouchers IS NULL;
COMMENT ON TABLE statements_of_payment IS NULL;
COMMENT ON TABLE line_items IS NULL;
COMMENT ON TABLE cost_centers IS NULL;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- WARNING: Database is now in PERMISSIVE state with anonymous access
--          to sensitive data. This is NOT recommended for production.
--
-- Restored Tables:
-- - companies (public read/write)
-- - accounts (public full access)
-- - documents (public full access)
-- - invoices (public full access)
-- - receipts (public full access)
-- - payment_vouchers (public full access)
-- - statements_of_payment (public full access)
-- - line_items (public full access)
-- - cost_centers (public full access)
--
-- Note: Tables secured in previous migrations (users, transactions, etc.)
--       remain secured and are NOT rolled back by this script.
-- ============================================================================
