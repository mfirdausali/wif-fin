-- ============================================================================
-- WIF Finance - Rollback Sessions RLS Fix
-- Migration: 025_rollback
-- Description: Rollback sessions RLS policies to migration 003 state
-- ============================================================================
-- WARNING: This rollback restores the flawed sessions_select_own policy
--          from migration 003. Only use this if migration 025 causes issues.
-- ============================================================================

-- Drop migration 025 policies
DROP POLICY IF EXISTS sessions_no_anon_access ON sessions;
DROP POLICY IF EXISTS sessions_service_role_full ON sessions;

-- Restore original policies from migration 003

-- Policy: Users can only read their own sessions (FLAWED - circular logic)
-- Note: This policy has a bug - it uses: user_id IN (SELECT id FROM users WHERE id = user_id)
--       which is circular and doesn't provide meaningful access control
CREATE POLICY sessions_select_own ON sessions
    FOR SELECT
    USING (user_id IN (
        SELECT id FROM users WHERE id = user_id
    ));

-- Policy: Service role can do anything (for backend operations)
CREATE POLICY sessions_service_all ON sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Restore grants to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO authenticated;
GRANT ALL ON sessions TO service_role;

-- Restore original table comment
COMMENT ON TABLE sessions IS 'Server-side session storage';

-- ============================================================================
-- ROLLBACK VERIFICATION
-- ============================================================================
-- Verify rollback was successful:
--
-- SELECT policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'sessions'
-- ORDER BY policyname;
--
-- Expected policies after rollback:
-- 1. sessions_select_own (all roles) - FOR SELECT
-- 2. sessions_service_all (all roles) - FOR ALL
-- ============================================================================

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
-- This rollback restores the original state from migration 003, including:
-- - The flawed sessions_select_own policy with circular logic
-- - The sessions_service_all policy for service_role
-- - Grants to authenticated role (unused in custom auth system)
--
-- If you rolled back migration 025, you should:
-- 1. Investigate why migration 025 caused issues
-- 2. Fix the root cause
-- 3. Re-apply migration 025 to maintain proper security
--
-- The sessions_select_own policy from migration 003 is ineffective and
-- should not be relied upon for security.
-- ============================================================================
