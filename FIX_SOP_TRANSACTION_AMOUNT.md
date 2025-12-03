# Fix: Statement of Payment Transaction Amount NULL Error

## Problem

When creating a Statement of Payment document, you get this error:
```
Error: Failed to create document: null value in column "amount" of relation "transactions" violates not-null constraint
```

## Root Cause

The database trigger `create_transaction_on_document_complete()` fires when a document is created. For Statement of Payment documents, it tries to read `total_deducted` from the `statements_of_payment` table:

```sql
SELECT total_deducted INTO v_amount
FROM statements_of_payment
WHERE document_id = NEW.id;
```

However, this SELECT happens **BEFORE** the `statements_of_payment` record is inserted, causing `v_amount` to be NULL.

### Sequence of Events:
1. Document inserted into `documents` table
2. Trigger fires immediately
3. Trigger tries to SELECT from `statements_of_payment` → **NO ROWS YET**
4. `v_amount` becomes NULL
5. Transaction INSERT fails because `amount` is NOT NULL

## Solution

Update the trigger to use `COALESCE()` which falls back to `NEW.amount` when `total_deducted` is not available yet:

```sql
v_amount := COALESCE(v_total_deducted, NEW.amount);
```

## How to Apply the Fix

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `/Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/008_fix_sop_transaction_amount.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 2: Via Command Line (if you have psql)

```bash
# Get your database connection string from Supabase Dashboard > Settings > Database > Connection string
# Look for "Connection string" and copy the URI format

psql 'postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres' \
  -f supabase/migrations/008_fix_sop_transaction_amount.sql
```

## Verification

After applying the fix, try creating a Statement of Payment again. It should work without the NULL amount error.

The transaction will now properly use:
- `totalDeducted` if the Statement of Payment record exists
- `amount` as a fallback if the Statement record doesn't exist yet

## What Was Fixed

The updated trigger function now:
1. Declares a separate variable `v_total_deducted` for the SELECT result
2. Uses `COALESCE(v_total_deducted, NEW.amount)` to handle NULL values
3. Ensures `v_amount` is never NULL when inserting into transactions table

This maintains the correct behavior (using totalDeducted when available) while preventing NULL constraint violations.
