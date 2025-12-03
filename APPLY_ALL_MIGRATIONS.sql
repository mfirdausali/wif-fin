-- ============================================================================
-- WIF Finance - Complete Cost Center Migration
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Create cost_centers table
-- ============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON cost_centers(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_type ON cost_centers(type);
CREATE INDEX IF NOT EXISTS idx_cost_centers_status ON cost_centers(status);
CREATE INDEX IF NOT EXISTS idx_cost_centers_dates ON cost_centers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON cost_centers(code);

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

-- Comments
COMMENT ON TABLE cost_centers IS 'Cost centers for trip/project budget tracking and profit/loss analysis';
COMMENT ON COLUMN cost_centers.code IS 'Auto-generated unique code (e.g., TRIP-2025-001)';
COMMENT ON COLUMN cost_centers.actual_revenue IS 'Auto-calculated from linked invoices/receipts';
COMMENT ON COLUMN cost_centers.actual_cost IS 'Auto-calculated from linked payment vouchers/statements';


-- STEP 2: Create booking_forms table
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,

    guest_name TEXT NOT NULL,
    trip_start_date DATE,
    trip_end_date DATE,
    number_of_pax TEXT,
    car_types TEXT[],

    -- Cost breakdown (JSONB arrays of line items)
    -- Each item: {date, description, quantity, pricePerUnit, total, notes}
    transportation_items JSONB DEFAULT '[]',
    meals_items JSONB DEFAULT '[]',
    entrance_items JSONB DEFAULT '[]',
    tour_guide_items JSONB DEFAULT '[]',
    flight_items JSONB DEFAULT '[]',
    accommodation_items JSONB DEFAULT '[]',

    -- Category totals (in JPY)
    transportation_total DECIMAL(12,2) DEFAULT 0,
    meals_total DECIMAL(12,2) DEFAULT 0,
    entrance_total DECIMAL(12,2) DEFAULT 0,
    tour_guide_total DECIMAL(12,2) DEFAULT 0,
    flight_total DECIMAL(12,2) DEFAULT 0,
    accommodation_total DECIMAL(12,2) DEFAULT 0,

    -- Grand totals
    grand_total_jpy DECIMAL(12,2),
    grand_total_myr DECIMAL(12,2),
    exchange_rate DECIMAL(10,6),

    -- Pricing comparison (WIF cost vs B2B selling price)
    wif_cost DECIMAL(12,2),
    b2b_price DECIMAL(12,2),
    expected_profit DECIMAL(12,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_forms_cost_center ON booking_forms(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_booking_forms_document ON booking_forms(document_id);
CREATE INDEX IF NOT EXISTS idx_booking_forms_dates ON booking_forms(trip_start_date, trip_end_date);

-- Row Level Security (RLS)
ALTER TABLE booking_forms ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view booking forms
CREATE POLICY booking_forms_select_all ON booking_forms
    FOR SELECT
    USING (true);

-- Policy: Service role can do anything
CREATE POLICY booking_forms_service_all ON booking_forms
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_forms TO authenticated;
GRANT ALL ON booking_forms TO service_role;

-- Comments
COMMENT ON TABLE booking_forms IS 'Detailed trip cost breakdown with line items by category';
COMMENT ON COLUMN booking_forms.transportation_items IS 'JSONB array of transportation line items';
COMMENT ON COLUMN booking_forms.wif_cost IS 'Total cost WIF pays to suppliers';
COMMENT ON COLUMN booking_forms.b2b_price IS 'Total price WIF charges to customer';
COMMENT ON COLUMN booking_forms.expected_profit IS 'Calculated as b2b_price - wif_cost';


-- STEP 3: Add cost_center_id to documents table
-- ============================================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_documents_cost_center ON documents(cost_center_id);

-- Comment for documentation
COMMENT ON COLUMN documents.cost_center_id IS 'Links document to a cost center (trip/project) for profit/loss tracking';


-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================

-- Verify tables created
SELECT 'cost_centers' as table_name, COUNT(*) as columns FROM information_schema.columns WHERE table_name = 'cost_centers'
UNION ALL
SELECT 'booking_forms', COUNT(*) FROM information_schema.columns WHERE table_name = 'booking_forms'
UNION ALL
SELECT 'documents (cost_center_id)', COUNT(*) FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'cost_center_id';

-- If you see 3 rows with column counts, migration was successful!
-- Expected results:
-- cost_centers: ~20 columns
-- booking_forms: ~30 columns
-- documents (cost_center_id): 1 column
