-- ============================================================================
-- Migration: Rename cost_center_id to booking_id in documents table
-- This aligns the database with the bookings-only architecture
-- ============================================================================

-- Step 1: Drop old cost center constraint if exists
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_cost_center_id_fkey;

-- Step 2: Rename column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name = 'cost_center_id'
  ) THEN
    ALTER TABLE documents RENAME COLUMN cost_center_id TO booking_id;
  END IF;
END $$;

-- Step 3: Add booking_id column if it doesn't exist (in case it was never created)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS booking_id UUID;

-- Step 4: Add foreign key constraint to bookings table
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_booking_id_fkey;

ALTER TABLE documents
  ADD CONSTRAINT documents_booking_id_fkey
  FOREIGN KEY (booking_id)
  REFERENCES bookings(id)
  ON DELETE SET NULL;

-- Step 5: Add index for performance
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);

-- Step 6: Drop old cost center tables (if you no longer need them)
DROP TABLE IF EXISTS booking_forms CASCADE;
DROP TABLE IF EXISTS cost_centers CASCADE;

-- Verify the migration
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name IN ('booking_id', 'cost_center_id');

-- Expected result: Only 'booking_id' should exist, 'cost_center_id' should not
