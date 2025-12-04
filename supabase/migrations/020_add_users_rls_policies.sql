-- ============================================================================
-- WIF Finance - Add RLS Policies for Security-Critical Tables
-- Migration: 020
-- Description: Enable Row Level Security on users and activity_logs tables,
--              and tighten security on transactions table
-- ============================================================================
-- SECURITY MODEL:
-- - We use custom authentication (NOT Supabase Auth)
-- - All authenticated operations go through service_role key from the backend
-- - Anonymous/public access is completely blocked for sensitive tables
-- - This prevents direct database access from untrusted clients
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- The users table contains sensitive authentication data (password hashes, etc.)
-- It must be protected from all direct public/anonymous access

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent migration)
DROP POLICY IF EXISTS users_no_anon_access ON users;
DROP POLICY IF EXISTS users_service_role_full ON users;

-- Policy: Block ALL access from anonymous/public roles
-- This prevents any unauthenticated access to user data
CREATE POLICY users_no_anon_access ON users
    FOR ALL
    TO anon, public
    USING (false)
    WITH CHECK (false);

-- Policy: Service role has full access (application backend)
-- All user operations must go through the authenticated backend
CREATE POLICY users_service_role_full ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE users IS 'User accounts with custom authentication. Access restricted to service_role only.';

-- ============================================================================
-- ACTIVITY LOGS TABLE
-- ============================================================================
-- Activity logs contain audit trail data that must not be accessible publicly

-- Enable RLS on activity_logs table
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent migration)
DROP POLICY IF EXISTS activity_logs_no_anon_access ON activity_logs;
DROP POLICY IF EXISTS activity_logs_service_role_full ON activity_logs;

-- Policy: Block ALL access from anonymous/public roles
CREATE POLICY activity_logs_no_anon_access ON activity_logs
    FOR ALL
    TO anon, public
    USING (false)
    WITH CHECK (false);

-- Policy: Service role has full access (application backend)
CREATE POLICY activity_logs_service_role_full ON activity_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE activity_logs IS 'Audit trail for user actions. Access restricted to service_role only.';

-- ============================================================================
-- TRANSACTIONS TABLE - TIGHTEN SECURITY
-- ============================================================================
-- The transactions table currently has overly permissive policies from migration 001
-- We need to replace the public access policy with service_role only

-- Drop the old overly permissive policy
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;

-- Drop any other existing policies (idempotent migration)
DROP POLICY IF EXISTS transactions_no_anon_access ON transactions;
DROP POLICY IF EXISTS transactions_service_role_full ON transactions;

-- Policy: Block ALL access from anonymous/public roles
CREATE POLICY transactions_no_anon_access ON transactions
    FOR ALL
    TO anon, public
    USING (false)
    WITH CHECK (false);

-- Policy: Service role has full access (application backend)
-- Transactions are created by triggers but queried by application
CREATE POLICY transactions_service_role_full ON transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE transactions IS 'Financial transaction audit trail. Access restricted to service_role only.';

-- ============================================================================
-- DOCUMENT COUNTERS TABLE - TIGHTEN SECURITY
-- ============================================================================
-- The document_counters table contains internal sequencing data

-- Drop the old overly permissive policy
DROP POLICY IF EXISTS "Allow all access to document_counters" ON document_counters;

-- Drop any other existing policies (idempotent migration)
DROP POLICY IF EXISTS document_counters_no_anon_access ON document_counters;
DROP POLICY IF EXISTS document_counters_service_role_full ON document_counters;

-- Policy: Block ALL access from anonymous/public roles
CREATE POLICY document_counters_no_anon_access ON document_counters
    FOR ALL
    TO anon, public
    USING (false)
    WITH CHECK (false);

-- Policy: Service role has full access (application backend)
-- Used by generate_document_number() function
CREATE POLICY document_counters_service_role_full ON document_counters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE document_counters IS 'Document numbering sequences. Access restricted to service_role only.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this query to verify RLS is properly enabled:
--
-- SELECT
--   schemaname,
--   tablename,
--   rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('users', 'activity_logs', 'transactions', 'document_counters')
-- ORDER BY tablename;
--
-- Expected result: All tables should show rowsecurity = true
-- ============================================================================

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. This migration is IDEMPOTENT - it can be run multiple times safely
-- 2. All policies use DROP IF EXISTS before CREATE to ensure clean state
-- 3. Users table: NO RLS -> Service role only (SECURED)
-- 4. Activity logs table: NO RLS -> Service role only (SECURED)
-- 5. Transactions table: Public access -> Service role only (SECURED)
-- 6. Document counters table: Public access -> Service role only (SECURED)
-- 7. Sessions table: Already secure (from migration 003)
--
-- SECURITY MODEL SUMMARY:
-- - Backend application uses service_role key for all operations
-- - Direct database access from clients is blocked via RLS
-- - Anonymous/public users cannot query or modify sensitive tables
-- - This follows the principle of least privilege
-- ============================================================================
