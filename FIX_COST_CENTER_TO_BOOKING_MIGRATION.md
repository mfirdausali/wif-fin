# Fix: Payment Voucher Error - Cost Center to Booking Migration

## Error Details

**Error Message:**
```
Failed to create document: Could not find the 'cost_center_id' column of 'documents' in the schema cache
```

**Root Cause:**
The database schema has conflicting migrations between two architectural approaches:
1. **Cost Centers approach** (old) - documents linked to cost_centers table
2. **Bookings approach** (new) - documents linked to bookings table

The `cost_center_id` column needs to be renamed to `booking_id` to align with the new bookings architecture.

## Files Affected

1. **Database Schema:**
   - `/Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/007_migrate_to_bookings.sql` (NEW)

2. **TypeScript Types:**
   - `/Users/firdaus/Documents/2025/code/wif-fin/types/database.ts` (UPDATED)

3. **Service Layer:**
   - `/Users/firdaus/Documents/2025/code/wif-fin/services/supabaseService.ts` (UPDATED)

## Solution Steps

### Step 1: Apply the Database Migration

Run the migration SQL in your Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq/sql
2. Copy and paste the contents of `supabase/migrations/007_migrate_to_bookings.sql`
3. Click **RUN**

**What this migration does:**
- Renames `cost_center_id` to `booking_id` in the `documents` table
- Drops the foreign key constraint to `cost_centers`
- Adds a new foreign key constraint to `bookings`
- Creates an index on `booking_id` for performance
- Drops the old `cost_centers` and `booking_forms` tables (if no longer needed)
- Verifies the migration completed successfully

### Step 2: Verify Migration Success

After running the migration, you should see a query result showing:
```
column_name | data_type | is_nullable
------------|-----------|-------------
booking_id  | uuid      | YES
```

**Important:** You should NOT see `cost_center_id` in the results.

### Step 3: Code Changes (Already Applied)

The following code changes have been made:

#### A. Updated `types/database.ts`
- Changed `cost_center_id` to `booking_id` in the `documents` table type definitions
- Updated all Row, Insert, and Update types

#### B. Updated `services/supabaseService.ts`
- Renamed function parameter from `costCenterId` to `bookingId` in `createDocument()`
- Changed database field from `cost_center_id` to `booking_id`
- Renamed `linkDocumentToCostCenter()` to `linkDocumentToBooking()`
- Renamed `unlinkDocumentFromCostCenter()` to `unlinkDocumentFromBooking()`

### Step 4: Test the Fix

After applying the migration:

1. Try creating a payment voucher again
2. The error should be resolved
3. Payment vouchers will now optionally link to bookings instead of cost centers

## Migration SQL

```sql
-- Step 1: Drop old cost center constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_cost_center_id_fkey;

-- Step 2: Rename column
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

-- Step 3: Add booking_id if not exists
ALTER TABLE documents ADD COLUMN IF NOT EXISTS booking_id UUID;

-- Step 4: Add foreign key to bookings
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_booking_id_fkey;

ALTER TABLE documents
  ADD CONSTRAINT documents_booking_id_fkey
  FOREIGN KEY (booking_id)
  REFERENCES bookings(id)
  ON DELETE SET NULL;

-- Step 5: Create index
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);
```

## Architecture Changes

### Before (Cost Centers)
```
documents
├── cost_center_id → cost_centers.id
└── Used for trip/project tracking
```

### After (Bookings)
```
documents
├── booking_id → bookings.id
└── Links documents directly to bookings (trips)
```

## Benefits of the New Architecture

1. **Simpler Data Model** - One table (bookings) instead of two (cost_centers + booking_forms)
2. **Direct Linking** - Documents link directly to bookings
3. **Better Performance** - Fewer table joins required
4. **Clearer Semantics** - Booking is more descriptive than cost center for trip management

## Rollback (If Needed)

If you need to rollback to the old cost_centers approach:

```sql
-- Rename back to cost_center_id
ALTER TABLE documents RENAME COLUMN booking_id TO cost_center_id;

-- Re-create cost_centers table
-- (Use the schema from APPLY_ALL_MIGRATIONS.sql)

-- Update foreign key
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_booking_id_fkey;

ALTER TABLE documents
  ADD CONSTRAINT documents_cost_center_id_fkey
  FOREIGN KEY (cost_center_id)
  REFERENCES cost_centers(id)
  ON DELETE SET NULL;
```

Then revert the TypeScript changes manually.

## Next Steps

1. **Apply the migration** to your Supabase database
2. **Test all document creation** (invoices, receipts, payment vouchers, statements)
3. **Update any UI components** that reference cost centers to use bookings instead
4. **Clean up old migration files** that are no longer needed

## Questions?

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify the migration completed successfully
3. Ensure TypeScript types match the database schema
4. Clear your browser cache and reload the application
