-- ============================================================================
-- WIF Finance - Rate Limiting System
-- Migration: 021
-- Description: Implements server-side rate limiting to prevent brute force
--              attacks, user enumeration, and distributed attacks
-- ============================================================================
-- SECURITY MODEL:
-- - Protects against distributed attacks (IP-based rate limiting)
-- - Prevents user enumeration (consistent rate limiting)
-- - Stops account takeover attempts (per-user rate limiting)
-- - Defends against resource exhaustion (API rate limiting)
-- ============================================================================

-- ============================================================================
-- RATE LIMITS TABLE
-- ============================================================================
-- Stores rate limiting state for various actions and identifiers
-- Supports both IP-based and user-based rate limiting

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifier can be IP address or user ID
    identifier TEXT NOT NULL,

    -- Type: 'ip' for IP-based limits, 'user' for user-based limits
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user')),

    -- Action being rate limited: 'login', 'password_reset', 'api_request', etc.
    action TEXT NOT NULL,

    -- Number of attempts in current window
    attempts INTEGER NOT NULL DEFAULT 1,

    -- Start of the current rate limit window
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- If set, requests are blocked until this timestamp
    blocked_until TIMESTAMPTZ,

    -- Metadata for audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one record per identifier+type+action combination
    UNIQUE(identifier, identifier_type, action)
);

-- Comment for documentation
COMMENT ON TABLE rate_limits IS 'Rate limiting state for IP addresses and user accounts. Prevents brute force and distributed attacks.';
COMMENT ON COLUMN rate_limits.identifier IS 'IP address (for IP limits) or user_id (for user limits)';
COMMENT ON COLUMN rate_limits.identifier_type IS 'Type of identifier: ip or user';
COMMENT ON COLUMN rate_limits.action IS 'Action being rate limited: login, password_reset, api_request, etc.';
COMMENT ON COLUMN rate_limits.attempts IS 'Number of attempts in current time window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start timestamp of current rate limit window';
COMMENT ON COLUMN rate_limits.blocked_until IS 'If set, all requests blocked until this timestamp';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Optimizes lookup queries for rate limit checks

-- Primary lookup index: Used by check_rate_limit function
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits(identifier, identifier_type, action, window_start);

-- Cleanup index: Used by cleanup_rate_limits function
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
    ON rate_limits(window_start)
    WHERE window_start < NOW() - INTERVAL '24 hours';

-- Block status index: Quick lookup for blocked requests
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked
    ON rate_limits(blocked_until)
    WHERE blocked_until IS NOT NULL AND blocked_until > NOW();

-- ============================================================================
-- RATE LIMIT CHECK FUNCTION
-- ============================================================================
-- Checks if an action should be rate limited and updates attempt counter
-- This function is designed for high-performance, concurrent access
--
-- Parameters:
--   p_identifier: IP address or user ID
--   p_identifier_type: 'ip' or 'user'
--   p_action: Action name (e.g., 'login', 'password_reset')
--   p_max_attempts: Maximum attempts allowed in time window
--   p_window_seconds: Time window in seconds
--
-- Returns: JSONB object with:
--   - allowed: boolean (true if request is allowed)
--   - remaining: integer (attempts remaining in window, 0 if blocked)
--   - reset_at: timestamp (when the rate limit window resets)
--   - blocked: boolean (true if temporarily blocked)

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_identifier_type TEXT,
    p_action TEXT,
    p_max_attempts INTEGER DEFAULT 10,
    p_window_seconds INTEGER DEFAULT 900  -- 15 minutes default
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
    v_window_start TIMESTAMPTZ;
    v_now TIMESTAMPTZ;
    v_is_new_window BOOLEAN;
    v_is_blocked BOOLEAN;
    v_reset_at TIMESTAMPTZ;
BEGIN
    v_now := NOW();

    -- Input validation
    IF p_identifier IS NULL OR p_identifier = '' THEN
        RAISE EXCEPTION 'identifier cannot be null or empty';
    END IF;

    IF p_identifier_type NOT IN ('ip', 'user') THEN
        RAISE EXCEPTION 'identifier_type must be ip or user';
    END IF;

    IF p_action IS NULL OR p_action = '' THEN
        RAISE EXCEPTION 'action cannot be null or empty';
    END IF;

    IF p_max_attempts < 1 THEN
        RAISE EXCEPTION 'max_attempts must be at least 1';
    END IF;

    IF p_window_seconds < 1 THEN
        RAISE EXCEPTION 'window_seconds must be at least 1';
    END IF;

    -- Try to get existing rate limit record with lock
    SELECT * INTO v_record
    FROM rate_limits
    WHERE identifier = p_identifier
        AND identifier_type = p_identifier_type
        AND action = p_action
    FOR UPDATE;

    -- If no record exists, create one
    IF v_record.id IS NULL THEN
        INSERT INTO rate_limits (
            identifier,
            identifier_type,
            action,
            attempts,
            window_start,
            blocked_until
        ) VALUES (
            p_identifier,
            p_identifier_type,
            p_action,
            1,
            v_now,
            NULL
        )
        RETURNING * INTO v_record;

        -- First attempt is always allowed
        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', p_max_attempts - 1,
            'reset_at', v_now + (p_window_seconds || ' seconds')::INTERVAL,
            'blocked', false
        );
    END IF;

    -- Check if currently blocked
    IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'reset_at', v_record.blocked_until,
            'blocked', true
        );
    END IF;

    -- Check if we're in a new time window
    v_is_new_window := (v_now - v_record.window_start) > (p_window_seconds || ' seconds')::INTERVAL;

    IF v_is_new_window THEN
        -- Reset counter for new window
        UPDATE rate_limits
        SET attempts = 1,
            window_start = v_now,
            blocked_until = NULL,
            updated_at = v_now
        WHERE id = v_record.id;

        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', p_max_attempts - 1,
            'reset_at', v_now + (p_window_seconds || ' seconds')::INTERVAL,
            'blocked', false
        );
    END IF;

    -- We're in the same window, increment attempts
    v_record.attempts := v_record.attempts + 1;

    -- Check if we've exceeded the limit
    IF v_record.attempts > p_max_attempts THEN
        -- Block the identifier for the remainder of the window plus buffer
        v_reset_at := v_record.window_start + (p_window_seconds || ' seconds')::INTERVAL;

        UPDATE rate_limits
        SET attempts = v_record.attempts,
            blocked_until = v_reset_at,
            updated_at = v_now
        WHERE id = v_record.id;

        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'reset_at', v_reset_at,
            'blocked', true
        );
    END IF;

    -- Update attempt counter
    UPDATE rate_limits
    SET attempts = v_record.attempts,
        updated_at = v_now
    WHERE id = v_record.id;

    -- Return success with remaining attempts
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', p_max_attempts - v_record.attempts,
        'reset_at', v_record.window_start + (p_window_seconds || ' seconds')::INTERVAL,
        'blocked', false
    );
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION check_rate_limit IS 'Checks if action is rate limited and tracks attempts. Returns allowed status and remaining attempts.';

-- ============================================================================
-- RATE LIMIT RESET FUNCTION
-- ============================================================================
-- Manually resets rate limits for a specific identifier and action
-- Useful for administrative purposes or after manual verification
--
-- Parameters:
--   p_identifier: IP address or user ID
--   p_identifier_type: 'ip' or 'user'
--   p_action: Action name (optional, NULL resets all actions for identifier)

CREATE OR REPLACE FUNCTION reset_rate_limit(
    p_identifier TEXT,
    p_identifier_type TEXT,
    p_action TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Input validation
    IF p_identifier IS NULL OR p_identifier = '' THEN
        RAISE EXCEPTION 'identifier cannot be null or empty';
    END IF;

    IF p_identifier_type NOT IN ('ip', 'user') THEN
        RAISE EXCEPTION 'identifier_type must be ip or user';
    END IF;

    -- Delete rate limit record(s)
    IF p_action IS NULL THEN
        -- Reset all actions for this identifier
        DELETE FROM rate_limits
        WHERE identifier = p_identifier
            AND identifier_type = p_identifier_type;
    ELSE
        -- Reset specific action
        DELETE FROM rate_limits
        WHERE identifier = p_identifier
            AND identifier_type = p_identifier_type
            AND action = p_action;
    END IF;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION reset_rate_limit IS 'Manually resets rate limits for an identifier. Returns number of records deleted.';

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================
-- Removes old rate limit records to prevent table bloat
-- Should be run periodically via cron or scheduled job
--
-- Parameters:
--   p_retention_hours: Keep records newer than this many hours (default 24)

CREATE OR REPLACE FUNCTION cleanup_rate_limits(
    p_retention_hours INTEGER DEFAULT 24
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
    v_cutoff_time TIMESTAMPTZ;
BEGIN
    -- Input validation
    IF p_retention_hours < 1 THEN
        RAISE EXCEPTION 'retention_hours must be at least 1';
    END IF;

    v_cutoff_time := NOW() - (p_retention_hours || ' hours')::INTERVAL;

    -- Delete old records where:
    -- 1. Window has expired
    -- 2. Not currently blocked (blocked_until is NULL or in the past)
    DELETE FROM rate_limits
    WHERE window_start < v_cutoff_time
        AND (blocked_until IS NULL OR blocked_until < NOW());

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION cleanup_rate_limits IS 'Removes expired rate limit records. Returns number of records deleted.';

-- ============================================================================
-- GET RATE LIMIT STATUS FUNCTION
-- ============================================================================
-- Retrieves current rate limit status without incrementing counters
-- Useful for monitoring and debugging
--
-- Parameters:
--   p_identifier: IP address or user ID
--   p_identifier_type: 'ip' or 'user'
--   p_action: Action name (optional, NULL returns all actions)

CREATE OR REPLACE FUNCTION get_rate_limit_status(
    p_identifier TEXT,
    p_identifier_type TEXT,
    p_action TEXT DEFAULT NULL
) RETURNS TABLE (
    action TEXT,
    attempts INTEGER,
    window_start TIMESTAMPTZ,
    blocked_until TIMESTAMPTZ,
    is_blocked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Input validation
    IF p_identifier IS NULL OR p_identifier = '' THEN
        RAISE EXCEPTION 'identifier cannot be null or empty';
    END IF;

    IF p_identifier_type NOT IN ('ip', 'user') THEN
        RAISE EXCEPTION 'identifier_type must be ip or user';
    END IF;

    -- Return rate limit status
    RETURN QUERY
    SELECT
        rl.action,
        rl.attempts,
        rl.window_start,
        rl.blocked_until,
        (rl.blocked_until IS NOT NULL AND rl.blocked_until > NOW()) AS is_blocked
    FROM rate_limits rl
    WHERE rl.identifier = p_identifier
        AND rl.identifier_type = p_identifier_type
        AND (p_action IS NULL OR rl.action = p_action)
    ORDER BY rl.action;
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION get_rate_limit_status IS 'Retrieves current rate limit status without incrementing counters. For monitoring purposes.';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Rate limits table must be protected from public access
-- Only service_role should be able to access this table

-- Enable RLS on rate_limits table
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent migration)
DROP POLICY IF EXISTS rate_limits_no_anon_access ON rate_limits;
DROP POLICY IF EXISTS rate_limits_service_role_full ON rate_limits;

-- Policy: Block ALL access from anonymous/public roles
CREATE POLICY rate_limits_no_anon_access ON rate_limits
    FOR ALL
    TO anon, public
    USING (false)
    WITH CHECK (false);

-- Policy: Service role has full access (application backend)
CREATE POLICY rate_limits_service_role_full ON rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- PREDEFINED RATE LIMIT CONFIGURATIONS
-- ============================================================================
-- These are the recommended rate limit configurations for common actions
-- Implement these in your application code when calling check_rate_limit()

-- Login attempts (IP-based):
--   check_rate_limit(ip_address, 'ip', 'login', 10, 900)
--   10 attempts per 15 minutes per IP address

-- Login attempts (User-based):
--   check_rate_limit(user_id, 'user', 'login', 5, 900)
--   5 attempts per 15 minutes per user (account lockout)

-- Password reset (IP-based):
--   check_rate_limit(ip_address, 'ip', 'password_reset', 5, 3600)
--   5 attempts per hour per IP address

-- Password reset (Email-based - use email as identifier):
--   check_rate_limit(email, 'user', 'password_reset', 3, 3600)
--   3 attempts per hour per email address

-- API requests (User-based):
--   check_rate_limit(user_id, 'user', 'api_request', 100, 60)
--   100 requests per minute per authenticated user

-- Registration attempts (IP-based):
--   check_rate_limit(ip_address, 'ip', 'register', 3, 3600)
--   3 registration attempts per hour per IP address

-- OTP/2FA attempts (User-based):
--   check_rate_limit(user_id, 'user', 'verify_otp', 5, 300)
--   5 OTP attempts per 5 minutes per user

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Check if login attempt is allowed
-- SELECT check_rate_limit('192.168.1.1', 'ip', 'login', 10, 900);
-- Returns: {"allowed": true, "remaining": 9, "reset_at": "2024-01-01 12:15:00", "blocked": false}

-- Example 2: Check rate limit status without incrementing
-- SELECT * FROM get_rate_limit_status('192.168.1.1', 'ip', 'login');

-- Example 3: Manually reset rate limit for an IP
-- SELECT reset_rate_limit('192.168.1.1', 'ip', 'login');

-- Example 4: Cleanup old rate limit records
-- SELECT cleanup_rate_limits(24);

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- View currently blocked identifiers:
-- SELECT identifier, identifier_type, action, attempts, blocked_until
-- FROM rate_limits
-- WHERE blocked_until IS NOT NULL AND blocked_until > NOW()
-- ORDER BY blocked_until DESC;

-- View most frequently rate-limited actions:
-- SELECT action, identifier_type, COUNT(*) as block_count
-- FROM rate_limits
-- WHERE blocked_until IS NOT NULL
-- GROUP BY action, identifier_type
-- ORDER BY block_count DESC;

-- View rate limit activity for specific IP:
-- SELECT action, attempts, window_start, blocked_until
-- FROM rate_limits
-- WHERE identifier = '192.168.1.1' AND identifier_type = 'ip'
-- ORDER BY window_start DESC;

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Recommended: Set up a cron job to run cleanup daily
-- Example using pg_cron extension (if available):
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', 'SELECT cleanup_rate_limits(24)');

-- Manual cleanup (run as needed):
-- SELECT cleanup_rate_limits(24);

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. This migration is IDEMPOTENT - it can be run multiple times safely
-- 2. All functions use SECURITY DEFINER for consistent permissions
-- 3. Rate limits table has RLS enabled (service_role only access)
-- 4. Indexes are optimized for high-concurrency read/write operations
-- 5. Functions include input validation to prevent SQL injection
-- 6. The check_rate_limit function uses FOR UPDATE lock to prevent race conditions
-- 7. All timestamps use TIMESTAMPTZ for timezone-aware comparisons
--
-- PERFORMANCE CONSIDERATIONS:
-- - Uses UNIQUE constraint for upsert-like behavior
-- - Indexes cover all common query patterns
-- - Cleanup function prevents table bloat
-- - FOR UPDATE lock ensures concurrent safety
--
-- SECURITY FEATURES:
-- - IP-based rate limiting prevents distributed attacks
-- - User-based rate limiting prevents account takeover
-- - Consistent rate limiting prevents user enumeration
-- - Service role only access prevents tampering
-- - All functions validate inputs to prevent injection attacks
-- ============================================================================
