-- ============================================================================
-- WIF Finance - Cost Centers Table
-- Migration: 004
-- Description: Add cost centers table for trip/project budget tracking
-- ============================================================================

-- Cost Centers Table
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('trip', 'project', 'department')),

    -- Trip-specific fields
    guest_name TEXT,
    start_date DATE,
    end_date DATE,
    number_of_pax TEXT,

    -- Financial tracking
    budgeted_revenue DECIMAL(12,2) DEFAULT 0,
    budgeted_cost DECIMAL(12,2) DEFAULT 0,
    actual_revenue DECIMAL(12,2) DEFAULT 0,
    actual_cost DECIMAL(12,2) DEFAULT 0,

    currency TEXT NOT NULL CHECK (currency IN ('MYR', 'JPY')),
    country TEXT NOT NULL CHECK (country IN ('Malaysia', 'Japan')),
    exchange_rate DECIMAL(10,6),

    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'closed')),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cost_centers_company ON cost_centers(company_id);
CREATE INDEX idx_cost_centers_code ON cost_centers(code);
CREATE INDEX idx_cost_centers_type ON cost_centers(type);
CREATE INDEX idx_cost_centers_status ON cost_centers(status);
CREATE INDEX idx_cost_centers_dates ON cost_centers(start_date, end_date);

-- Row Level Security (RLS)
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view cost centers
CREATE POLICY cost_centers_select_all ON cost_centers
    FOR SELECT
    USING (true);

-- Policy: Service role can do anything (for backend operations)
CREATE POLICY cost_centers_service_all ON cost_centers
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_centers TO authenticated;
GRANT ALL ON cost_centers TO service_role;
