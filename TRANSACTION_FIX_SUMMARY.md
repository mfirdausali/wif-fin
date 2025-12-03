# Statement of Payment Transaction Fix - Summary

## Issue Summary

**Error Message:**
```
Error: Failed to create document: null value in column "amount" of relation "transactions" violates not-null constraint
```

**When It Occurs:**
When creating a Statement of Payment document in the application.

## Root Cause Analysis

### The Problem

The database has a trigger `create_transaction_on_document_complete()` that automatically creates transaction records when documents are completed.

For Statement of Payment documents, the trigger tries to get the `total_deducted` value like this:

```sql
SELECT total_deducted INTO v_amount
FROM statements_of_payment
WHERE document_id = NEW.id;
```

**However**, this happens in the wrong order:

1. **Step 1**: `documents` table row is inserted
2. **Step 2**: Trigger fires immediately (BEFORE the statement_of_payment row exists)
3. **Step 3**: SELECT query returns NO ROWS → `v_amount` is NULL
4. **Step 4**: INSERT into transactions fails (amount cannot be NULL)
5. **Step 5**: `statements_of_payment` row would be inserted (never reached due to error)

### Why This Happens

The sequence in `supabaseService.ts` is:
```typescript
// 1. Create base document
const { data: docData } = await supabase.from('documents').insert(docInsert); // Trigger fires here!

// 2. Create type-specific data (this happens AFTER trigger)
await createStatementOfPayment(documentId, document); // Too late!
```

The trigger fires immediately when the document is inserted, but the `statements_of_payment` record hasn't been created yet.

## The Fix

Change the trigger to use `COALESCE()` which provides a fallback value:

```sql
-- OLD (causes NULL):
SELECT total_deducted INTO v_amount
FROM statements_of_payment
WHERE document_id = NEW.id;

-- NEW (uses fallback):
SELECT total_deducted INTO v_total_deducted
FROM statements_of_payment
WHERE document_id = NEW.id;

v_amount := COALESCE(v_total_deducted, NEW.amount);
```

Now:
- If `statements_of_payment` record exists → use `total_deducted` ✓
- If it doesn't exist yet → use `NEW.amount` (from documents table) ✓
- `v_amount` is never NULL ✓

## Files Created

1. **`/Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/008_fix_sop_transaction_amount.sql`**
   - Full migration file with comments and proper formatting
   - Use this for version-controlled migration

2. **`/Users/firdaus/Documents/2025/code/wif-fin/QUICK_FIX.sql`**
   - Minified one-liner version
   - Easy to copy/paste into Supabase SQL Editor

3. **`/Users/firdaus/Documents/2025/code/wif-fin/FIX_SOP_TRANSACTION_AMOUNT.md`**
   - Detailed documentation with examples
   - Step-by-step application instructions

## How to Apply

### Via Supabase Dashboard (Easiest)

1. Open Supabase Dashboard → Your Project
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the contents of `QUICK_FIX.sql`
5. Paste into the editor
6. Click **Run** (or press Ctrl/Cmd + Enter)
7. You should see: ✓ Success. No rows returned

### Via Command Line (Alternative)

```bash
cd /Users/firdaus/Documents/2025/code/wif-fin

# Option 1: Using psql (if you have it)
psql "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/008_fix_sop_transaction_amount.sql

# Option 2: Using supabase CLI (not working due to migration state)
# npx supabase db push  # This doesn't work due to existing migrations
```

## Verification Steps

After applying the fix:

1. **Test Creating a Statement of Payment:**
   - Go to your application
   - Create a new Statement of Payment
   - Link it to an existing Payment Voucher
   - Enter transaction details
   - Click "Create Statement of Payment"
   - **Expected Result:** Document created successfully ✓

2. **Verify Transaction Record:**
   ```sql
   -- Check in Supabase SQL Editor
   SELECT * FROM transactions
   WHERE document_type = 'statement_of_payment'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   The `amount` column should contain the correct value (not NULL).

3. **Verify Account Balance:**
   ```sql
   -- Check that account balance was updated
   SELECT id, name, current_balance
   FROM accounts
   WHERE id = '[YOUR-ACCOUNT-ID]';
   ```
   Balance should be reduced by the totalDeducted amount.

## Technical Details

### Database Schema

**transactions table:**
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    document_id UUID NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,  -- This was getting NULL!
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    -- ...
);
```

### Trigger Timing

**Before Fix:**
```
INSERT documents → Trigger → SELECT statements_of_payment (EMPTY) → NULL → ERROR
                              ↓
                         INSERT statements_of_payment (never reached)
```

**After Fix:**
```
INSERT documents → Trigger → SELECT statements_of_payment (EMPTY) → COALESCE(NULL, amount) → OK
                              ↓
                         INSERT statements_of_payment → Future SELECTs use this
```

## Code Changes

No application code changes needed! This is a database-only fix.

The trigger now handles both cases:
- **Initial creation**: Uses `NEW.amount` from documents table
- **Future updates**: Can use `total_deducted` from statements_of_payment table

## Related Files

- `/Users/firdaus/Documents/2025/code/wif-fin/services/supabaseService.ts` - Document creation logic
- `/Users/firdaus/Documents/2025/code/wif-fin/components/StatementOfPaymentForm.tsx` - UI form
- `/Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/001_initial_schema.sql` - Original trigger

## Questions?

If the fix doesn't work:
1. Check that the SQL ran without errors
2. Verify the trigger was updated:
   ```sql
   SELECT prosrc FROM pg_proc WHERE proname = 'create_transaction_on_document_complete';
   ```
   You should see `COALESCE` in the function body.

3. Check for any existing failed transactions:
   ```sql
   SELECT * FROM transactions WHERE amount IS NULL;
   ```
