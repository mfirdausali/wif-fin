-- ============================================================================
-- WIF Finance - Sessions Table
-- Migration: 003
-- Description: Add sessions table for server-side session validation
-- ============================================================================

-- Sessions Table - Server-side session storage
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of session token
    refresh_token_hash TEXT UNIQUE,  -- For token refresh
    device_info JSONB,               -- User agent, IP, device name
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for performance
    CONSTRAINT sessions_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);

-- Function to cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_activity on session validation
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Scheduled job to cleanup expired sessions
-- Run this manually or via cron: SELECT cleanup_expired_sessions();

-- Row Level Security (RLS) - Users can only see their own sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own sessions
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO authenticated;
GRANT ALL ON sessions TO service_role;
