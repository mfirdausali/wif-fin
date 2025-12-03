-- Migration: Remove Cost Centers, Keep Only Bookings
-- Simple version without complex RLS policies

-- Drop cost center tables if they exist
DROP TABLE IF EXISTS cost_centers CASCADE;

-- Rename booking_forms to bookings (if booking_forms exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_forms') THEN
    ALTER TABLE booking_forms RENAME TO bookings;
  END IF;
END $$;

-- Create bookings table if it doesn't exist
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_code VARCHAR(50) UNIQUE,
  document_id UUID,

  -- Trip Details
  guest_name TEXT NOT NULL,
  trip_start_date DATE,
  trip_end_date DATE,
  number_of_pax TEXT,
  country TEXT DEFAULT 'Japan',
  car_types TEXT[],

  -- Cost Breakdown - Line Items (JSONB arrays)
  transportation_items JSONB DEFAULT '[]',
  meals_items JSONB DEFAULT '[]',
  entrance_items JSONB DEFAULT '[]',
  tour_guide_items JSONB DEFAULT '[]',
  flight_items JSONB DEFAULT '[]',
  accommodation_items JSONB DEFAULT '[]',

  -- Cost Breakdown - Totals (in JPY)
  transportation_total DECIMAL(15,2) DEFAULT 0,
  meals_total DECIMAL(15,2) DEFAULT 0,
  entrance_total DECIMAL(15,2) DEFAULT 0,
  tour_guide_total DECIMAL(15,2) DEFAULT 0,
  flight_total DECIMAL(15,2) DEFAULT 0,
  accommodation_total DECIMAL(15,2) DEFAULT 0,

  -- Grand Totals
  grand_total_jpy DECIMAL(15,2) DEFAULT 0,
  grand_total_myr DECIMAL(15,2) DEFAULT 0,
  exchange_rate DECIMAL(10,6) DEFAULT 0.031,

  -- Pricing & Profit (in MYR)
  wif_cost DECIMAL(15,2) DEFAULT 0,
  b2b_price DECIMAL(15,2) DEFAULT 0,
  expected_profit DECIMAL(15,2) DEFAULT 0,

  -- Metadata
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Add company_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'company_id') THEN
    ALTER TABLE bookings ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  -- Add booking_code if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'booking_code') THEN
    ALTER TABLE bookings ADD COLUMN booking_code VARCHAR(50) UNIQUE;
  END IF;

  -- Add status if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'status') THEN
    ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled'));
  END IF;

  -- Add country if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'country') THEN
    ALTER TABLE bookings ADD COLUMN country TEXT DEFAULT 'Japan';
  END IF;

  -- Add is_active if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'is_active') THEN
    ALTER TABLE bookings ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  -- Add notes if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'notes') THEN
    ALTER TABLE bookings ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Make document_id optional (if it's required)
ALTER TABLE bookings ALTER COLUMN document_id DROP NOT NULL;

-- Drop cost_center_id if it exists
ALTER TABLE bookings DROP COLUMN IF EXISTS cost_center_id;

-- Update documents table to reference bookings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'cost_center_id') THEN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_cost_center_id_fkey;
    ALTER TABLE documents RENAME COLUMN cost_center_id TO booking_id;
    ALTER TABLE documents ADD CONSTRAINT documents_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_start_date ON bookings(trip_start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);

-- Function to generate booking code
CREATE OR REPLACE FUNCTION generate_booking_code(p_company_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_year VARCHAR(4);
  v_sequence INTEGER;
  v_code VARCHAR(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get the highest sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(booking_code FROM 'BK-' || v_year || '-(.*)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM bookings
  WHERE company_id = p_company_id
    AND booking_code LIKE 'BK-' || v_year || '-%';

  -- Format: BK-2025-001
  v_code := 'BK-' || v_year || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate booking code
CREATE OR REPLACE FUNCTION set_booking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_code IS NULL THEN
    NEW.booking_code := generate_booking_code(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_booking_code ON bookings;
CREATE TRIGGER trigger_set_booking_code
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_code();

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies - allow all operations for authenticated users of the same company
DROP POLICY IF EXISTS "Users can view their company bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their company bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete their company bookings" ON bookings;

-- For now, allow all authenticated users full access to their company's bookings
-- You can tighten this later based on your auth setup
CREATE POLICY "Users can view their company bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their company bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete their company bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE bookings IS 'Main bookings table - stores all trip/tour bookings with detailed cost breakdown';
