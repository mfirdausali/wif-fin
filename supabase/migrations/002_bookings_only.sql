-- Migration: Remove Cost Centers, Keep Only Bookings
-- This simplifies the system to focus on bookings as the primary entity

-- Drop cost center tables (keep booking_forms which we'll rename)
DROP TABLE IF EXISTS cost_centers CASCADE;

-- Rename booking_forms to bookings and make it the primary table
ALTER TABLE booking_forms RENAME TO bookings;

-- Add missing fields that were in cost_centers
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS booking_code VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS country VARCHAR(50) DEFAULT 'Japan',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update document_id to be optional (will be null for bookings without documents yet)
ALTER TABLE bookings ALTER COLUMN document_id DROP NOT NULL;

-- Remove cost_center_id from bookings (it's redundant now)
ALTER TABLE bookings DROP COLUMN IF EXISTS cost_center_id;

-- Update documents table to reference bookings instead of cost_centers
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_cost_center_id_fkey;
ALTER TABLE documents RENAME COLUMN cost_center_id TO booking_id;
ALTER TABLE documents
  ADD CONSTRAINT documents_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_start_date ON bookings(trip_start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);

-- Add check constraint for status
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled'));

-- Update RLS policies for bookings
DROP POLICY IF EXISTS "Users can view their company bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their company bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete their company bookings" ON bookings;

CREATE POLICY "Users can view their company bookings"
  ON bookings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'accountant')
    )
  );

CREATE POLICY "Users can update their company bookings"
  ON bookings FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'accountant')
    )
  );

CREATE POLICY "Users can delete their company bookings"
  ON bookings FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

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

-- Add trigger to auto-generate booking code
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

-- Add comment
COMMENT ON TABLE bookings IS 'Main bookings table - stores all trip/tour bookings with detailed cost breakdown';
