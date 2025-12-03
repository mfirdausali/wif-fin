-- Migration: Add B2B totals and update draft status
-- Adds B2B total columns for tracking B2B prices separately from internal costs

-- Add B2B total columns for each category (JPY)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transportation_b2b_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meals_b2b_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entrance_b2b_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tour_guide_b2b_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_b2b_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accommodation_b2b_total DECIMAL(15,2) DEFAULT 0;

-- Add grand total B2B columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS grand_total_b2b_jpy DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS grand_total_b2b_myr DECIMAL(15,2) DEFAULT 0;

-- Update status constraint to include 'draft'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled'));

-- Add comment
COMMENT ON COLUMN bookings.transportation_b2b_total IS 'Total B2B price for transportation (JPY)';
COMMENT ON COLUMN bookings.grand_total_b2b_jpy IS 'Total B2B price for entire booking (JPY)';
COMMENT ON COLUMN bookings.grand_total_b2b_myr IS 'Total B2B price for entire booking (MYR)';
