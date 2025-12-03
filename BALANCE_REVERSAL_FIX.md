# Balance Reversal Fix - Document Deletion

## Problem Summary
When a document (receipt/statement_of_payment) with `status='completed'` is DELETED (soft-deleted), the account balance is NOT being reversed, causing incorrect balances.

## Root Cause Analysis

### Current Flow
1. ✅ **Document created with status='completed'**: Database trigger `create_transaction_on_document_complete()` creates transaction + updates balance (WORKING)
2. ❌ **Document DELETED**: No trigger exists to reverse the balance (NOT WORKING)

### Code Review Findings

#### Mobile App
- File: `/Users/firdaus/Documents/2025/code/wif-fin-mobile-app/wif-finance/src/services/documents/documentService.ts`
- Function: `deleteDocument()` (lines 613-644)
- **Issue**: Only soft-deletes the document (sets `deleted_at`), does NOT reverse balance
- **Note**: Comments indicate balance updates are handled by database trigger

#### Web App
- File: `/Users/firdaus/Documents/2025/code/wif-fin/services/supabaseService.ts`
- Function: `deleteDocument()` (lines 619-645)
- **Issue**: Same as mobile app - only soft-deletes, no balance reversal
- **Note**: Also relies on database triggers

#### Database
- File: `/Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/001_initial_schema.sql`
- **Existing Trigger**: `create_transaction_on_document_complete()` (lines 362-429)
  - Handles document creation/completion ✅
  - Does NOT handle deletion ❌
- **Missing**: No trigger to reverse balance on document deletion

## The Fix

### Solution Implemented
Added a new database trigger that automatically reverses account balance when a completed document is soft-deleted.

### Files Created/Modified

#### 1. New Migration File
**File**: `/Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/010_reverse_balance_on_document_delete.sql`

**What it does**:
- Creates function `reverse_transaction_on_document_delete()`
- Creates trigger `reverse_transaction_on_delete_trigger`
- Automatically reverses balance when `deleted_at` is set on a completed document

**Logic**:
- **Receipts** (originally INCREASE balance) → Deletion DECREASES balance
- **Statements of Payment** (originally DECREASE balance) → Deletion INCREASES balance
- Safety checks:
  - Only processes completed documents
  - Only if account_id exists
  - Only if an original transaction exists
  - Creates reversal transaction with metadata for audit trail

#### 2. Standalone Application Script
**File**: `/Users/firdaus/Documents/2025/code/wif-fin/apply_balance_reversal_fix.sql`

This is a standalone SQL script that can be run directly on Supabase SQL Editor if the migration doesn't apply automatically.

## How to Apply the Fix

### Option 1: Via Supabase SQL Editor (RECOMMENDED)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `apply_balance_reversal_fix.sql`
4. Click "Run"
5. Verify you see the success message

### Option 2: Via Supabase CLI
```bash
cd /Users/firdaus/Documents/2025/code/wif-fin
npx supabase db push
```

**Note**: If you get errors about existing tables, the migration may have already been applied. Check the SQL Editor instead.

## Verification

After applying the fix, you can test it:

### Test 1: Create and Delete a Receipt
```sql
-- 1. Create a test receipt with completed status
-- 2. Check account balance (should increase)
-- 3. Soft-delete the receipt (SET deleted_at = NOW())
-- 4. Check account balance again (should decrease back)
-- 5. Check transactions table for reversal transaction
```

### Test 2: Check Reversal Transaction
```sql
SELECT * FROM transactions
WHERE metadata->>'reversal' = 'true'
ORDER BY created_at DESC;
```

You should see:
- `transaction_type`: opposite of original (increase ↔ decrease)
- `description`: "Reversal (deleted) - [DOC-NUMBER]"
- `metadata`: Contains `reversal: true`, `original_transaction_id`, and `reason: document_deleted`

## Impact

### What Changes
- ✅ Document deletion now correctly reverses account balances
- ✅ Audit trail preserved (reversal transactions created)
- ✅ Both mobile and web apps benefit (no code changes needed)

### What Stays the Same
- ✅ Document creation flow (unchanged)
- ✅ Status update flow (unchanged)
- ✅ Mobile app code (unchanged)
- ✅ Web app code (unchanged)

## Technical Details

### Trigger Details
- **Name**: `reverse_transaction_on_delete_trigger`
- **Type**: AFTER UPDATE OF deleted_at
- **Function**: `reverse_transaction_on_document_delete()`
- **When**: Fires when `deleted_at` changes from NULL to a timestamp
- **Condition**: Only for completed documents with account_id

### Transaction Metadata
Reversal transactions include metadata for tracking:
```json
{
  "reversal": true,
  "original_transaction_id": "uuid-of-original-transaction",
  "reason": "document_deleted"
}
```

## Next Steps

1. **Apply the fix** using one of the options above
2. **Test** with a sample document deletion
3. **Monitor** account balances to ensure they're correct
4. **Optional**: Add UI indicator for reversal transactions in transaction history

## Questions?

If you have any issues applying this fix, check:
1. Supabase connection is active
2. You have admin/owner permissions
3. Run the standalone SQL script in SQL Editor as fallback
