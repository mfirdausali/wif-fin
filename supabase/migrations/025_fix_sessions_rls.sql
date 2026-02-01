-- ============================================================================
-- WIF Finance - Fix Sessions RLS Policies
-- Migration: 025
-- Description: Fix sessions table RLS to match hardened security model.
--              Remove flawed sessions_select_own policy and implement
--              service_role-only access pattern.
-- ============================================================================
-- SECURITY MODEL:
-- - Custom authentication using service_role key from backend
-- - Anonymous/public access completely blocked
-- - Sessions are managed server-side by application backend only
-- - Follows same pattern as migrations 020 and 024
-- ============================================================================

-- ============================================================================
-- SESSIONS TABLE - FIX RLS POLICIES
-- ============================================================================
-- The sessions table currently has a flawed policy from migration 003:
--   sessions_select_own uses circular logic: user_id IN (SELECT id FROM users WHERE id = user_id)
-- This policy doesn't provide meaningful access control.
--
-- Since we use custom auth with service_role, we need to:
-- 1. Remove the flawed policy
-- 2. Block all anonymous/public access
-- 3. Keep service_role full access for backend session management

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS sessions_select_own ON sessions;
DROP POLICY IF EXISTS sessions_service_all ON sessions;
DROP POLICY IF EXISTS sessions_no_anon_access ON sessions;
DROP POLICY IF EXISTS sessions_service_role_full ON sessions;

-- Policy: Block ALL access from anonymous/public roles
-- Sessions contain sensitive authentication tokens and must not be accessible publicly
CREATE POLICY sessions_no_anon_access ON sessions
    FOR ALL
    TO anon, public
    USING (false)
    WITH CHECK (false);

-- Policy: Service role has full access (application backend)
-- All session operations (create, validate, update, delete) go through the backend
CREATE POLICY sessions_service_role_full ON sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Update table comment for documentation
COMMENT ON TABLE sessions IS 'Server-side session storage with token hashing. Access restricted to service_role only.';

-- ============================================================================
-- REVOKE UNNECESSARY GRANTS
-- ============================================================================
-- The authenticated role grant from migration 003 is not needed since we use
-- service_role for all operations in our custom auth system

-- Revoke the authenticated role grants (keep service_role only)
REVOKE ALL ON sessions FROM authenticated;

-- Verify service_role still has access (should already exist from migration 003)
GRANT ALL ON sessions TO service_role;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this query to verify sessions table RLS is properly configured:
--
-- SELECT
--   schemaname,
--   tablename,
--   rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename = 'sessions';
--
-- Expected result: rowsecurity = true
--
-- List policies:
-- SELECT policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'sessions'
-- ORDER BY policyname;
--
-- Expected policies:
-- 1. sessions_no_anon_access (anon, public) - FOR ALL - USING false
-- 2. sessions_service_role_full (service_role) - FOR ALL - USING true
-- ============================================================================

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- BEFORE (Migration 003):
-- - sessions_select_own: Flawed circular logic, ineffective access control
-- - sessions_service_all: Correct service_role access
-- - Granted SELECT, INSERT, UPDATE, DELETE to authenticated role (unused)
--
-- AFTER (Migration 025):
-- - sessions_no_anon_access: Blocks all anonymous/public access
-- - sessions_service_role_full: Service role maintains full access
-- - Removed authenticated role grants (not used in custom auth model)
--
-- SECURITY IMPROVEMENTS:
-- - Fixed circular/ineffective SELECT policy
-- - Blocked anonymous/public access explicitly
-- - Aligned with service_role-only security model (migrations 020, 024)
-- - Removed unused authenticated role permissions
-- - Sessions now properly secured for custom authentication system
--
-- IMPACT:
-- - No breaking changes (we already use service_role for all session operations)
-- - Improved security posture by explicitly blocking public access
-- - Consistent with rest of application's RLS architecture
-- ============================================================================
