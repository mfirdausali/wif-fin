-- ============================================================================
-- WIF Finance - Booking Forms Table
-- Migration: 005
-- Description: Add booking forms table for detailed trip cost breakdown
-- ============================================================================

-- Booking Forms Table
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

-- Indexes for performance
CREATE INDEX idx_booking_forms_cost_center ON booking_forms(cost_center_id);
CREATE INDEX idx_booking_forms_document ON booking_forms(document_id);
CREATE INDEX idx_booking_forms_dates ON booking_forms(trip_start_date, trip_end_date);

-- Row Level Security (RLS)
ALTER TABLE booking_forms ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view booking forms
CREATE POLICY booking_forms_select_all ON booking_forms
    FOR SELECT
    USING (true);

-- Policy: Service role can do anything (for backend operations)
CREATE POLICY booking_forms_service_all ON booking_forms
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_forms TO authenticated;
GRANT ALL ON booking_forms TO service_role;
