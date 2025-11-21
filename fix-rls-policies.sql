-- ============================================================================
-- FIX: RLS Policy Update for Anonymous Access
-- This fixes the 406 error when accessing the companies table
-- ============================================================================

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their company data" ON companies;
DROP POLICY IF EXISTS "Users can insert their company data" ON companies;
DROP POLICY IF EXISTS "Users can update their company data" ON companies;
DROP POLICY IF EXISTS "Users can access accounts" ON accounts;
DROP POLICY IF EXISTS "Users can access documents" ON documents;
DROP POLICY IF EXISTS "Users can access invoices" ON invoices;
DROP POLICY IF EXISTS "Users can access receipts" ON receipts;
DROP POLICY IF EXISTS "Users can access payment_vouchers" ON payment_vouchers;
DROP POLICY IF EXISTS "Users can access statements_of_payment" ON statements_of_payment;
DROP POLICY IF EXISTS "Users can access line_items" ON line_items;
DROP POLICY IF EXISTS "Users can access transactions" ON transactions;
DROP POLICY IF EXISTS "Users can access document_counters" ON document_counters;

-- Create new policies with explicit role permissions
-- Companies: Allow public read access (needed for initial setup check)
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

-- Apply similar policies to other tables
CREATE POLICY "Allow all access to accounts" ON accounts
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to documents" ON documents
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to invoices" ON invoices
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to receipts" ON receipts
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to payment_vouchers" ON payment_vouchers
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to statements_of_payment" ON statements_of_payment
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to line_items" ON line_items
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to transactions" ON transactions
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to document_counters" ON document_counters
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);
