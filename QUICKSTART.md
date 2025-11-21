# WIF Finance - Supabase Migration Quick Start

Get your database up and running in 5 minutes!

---

## Prerequisites Checklist

- [x] Supabase project created (https://fthkayaprkicvzgqeipq.supabase.co)
- [x] Environment variables in `.env.production`:
  ```
  VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
- [x] Migration SQL file created: `supabase/migrations/001_initial_schema.sql`
- [x] Service layer created: `services/supabaseService.ts`

---

## Step 1: Run Database Migration (2 minutes)

### Option A: Supabase Dashboard (Recommended)

1. **Go to SQL Editor**
   ```
   https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq/sql/new
   ```

2. **Copy Migration SQL**
   - Open `supabase/migrations/001_initial_schema.sql`
   - Copy all contents (Cmd+A, Cmd+C)

3. **Paste and Execute**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for confirmation (should take ~5 seconds)

4. **Verify Success**
   - Go to Table Editor
   - You should see 10 tables:
     - companies ✓
     - accounts ✓
     - documents ✓
     - invoices ✓
     - receipts ✓
     - payment_vouchers ✓
     - statements_of_payment ✓
     - line_items ✓
     - transactions ✓
     - document_counters ✓

### Option B: Supabase CLI

```bash
# Install CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref fthkayaprkicvzgqeipq

# Run migration
supabase db push
```

---

## Step 2: Test Connection (1 minute)

### In Browser Console

1. **Open your app**
   ```bash
   npm run dev
   ```

2. **Open browser console** (F12 or Cmd+Option+I)

3. **Run test query**
   ```javascript
   // Test Supabase connection
   const { data, error } = await window.supabase.from('companies').select('*');
   console.log('Companies:', data);
   console.log('Error:', error);
   ```

4. **Expected Result**
   ```javascript
   // Should return:
   {
     data: [
       {
         id: 'c0000000-0000-0000-0000-000000000001',
         name: 'WIF JAPAN SDN BHD',
         address: 'Malaysia Office\nKuala Lumpur, Malaysia',
         // ... other fields
       }
     ],
     error: null
   }
   ```

### Test Document Number Generation

```javascript
// Test document number generation
const { data, error } = await window.supabase.rpc('generate_document_number', {
  p_company_id: 'c0000000-0000-0000-0000-000000000001',
  p_document_type: 'invoice'
});

console.log('Generated Number:', data);
// Expected: "WIF-INV-20250121-001"
```

---

## Step 3: Quick Integration Test (2 minutes)

### Test Account Creation

```javascript
import { supabase } from './lib/supabase';
import { createAccount, getOrCreateDefaultCompany } from './services/supabaseService';

// Get company
const company = await getOrCreateDefaultCompany();
console.log('Company ID:', company.id);

// Create test account
const testAccount = {
  name: 'Test Bank Account',
  type: 'main_bank',
  currency: 'MYR',
  country: 'Malaysia',
  bankName: 'Test Bank',
  accountNumber: '1234567890',
  initialBalance: 10000,
  currentBalance: 10000,
  isActive: true
};

const account = await createAccount(company.id, testAccount);
console.log('Created Account:', account);
```

### Test Document Creation

```javascript
import { createDocument, generateDocumentNumber } from './services/supabaseService';

// Generate document number
const docNumber = await generateDocumentNumber(company.id, 'invoice');
console.log('Document Number:', docNumber);

// Create test invoice
const testInvoice = {
  id: '', // Will be generated
  documentType: 'invoice',
  documentNumber: docNumber,
  status: 'issued',
  date: new Date().toISOString().split('T')[0],
  currency: 'MYR',
  country: 'Malaysia',
  amount: 1000,
  subtotal: 1000,
  total: 1000,
  items: [
    {
      id: '1',
      description: 'Test Item',
      quantity: 1,
      unitPrice: 1000,
      amount: 1000
    }
  ],
  customerName: 'Test Customer',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const invoice = await createDocument(company.id, testInvoice);
console.log('Created Invoice:', invoice);
```

---

## Step 4: Verify in Supabase Dashboard

1. **Go to Table Editor**
   ```
   https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq/editor
   ```

2. **Check Tables**
   - **companies**: Should have 1 row (default company)
   - **accounts**: Should have your test account
   - **documents**: Should have your test invoice
   - **invoices**: Should have invoice details
   - **line_items**: Should have invoice line item
   - **document_counters**: Should have counter for invoice

3. **Run SQL Queries**
   ```sql
   -- View all accounts
   SELECT * FROM accounts;

   -- View all documents with details
   SELECT
     d.document_number,
     d.document_type,
     d.status,
     d.amount,
     d.currency
   FROM documents d
   ORDER BY d.created_at DESC;

   -- View document with line items
   SELECT
     d.document_number,
     li.description,
     li.amount
   FROM documents d
   JOIN line_items li ON li.document_id = d.id;
   ```

---

## Common Issues & Quick Fixes

### Issue: "Missing environment variables"
**Fix:**
```bash
# Check .env.production exists
cat .env.production

# Should contain:
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

### Issue: "Failed to connect to Supabase"
**Fix:**
1. Check internet connection
2. Verify Supabase project is active
3. Test with curl:
   ```bash
   curl https://fthkayaprkicvzgqeipq.supabase.co/rest/v1/
   ```

### Issue: "Table does not exist"
**Fix:**
- Re-run migration SQL
- Check SQL Editor for errors
- Verify all tables in Table Editor

### Issue: "Function generate_document_number does not exist"
**Fix:**
```sql
-- Re-create function in SQL Editor:
CREATE OR REPLACE FUNCTION generate_document_number(
    p_company_id UUID,
    p_document_type TEXT
) RETURNS TEXT AS $$
-- (copy from migration SQL)
```

---

## Next Steps

✅ **Migration Complete!** Now you can:

1. **Integrate Services** - Update components to use Supabase
2. **Test Workflows** - Follow `TESTING_CHECKLIST.md`
3. **Migrate Data** - If you have existing localStorage data
4. **Deploy** - Push to production when ready

---

## Useful Commands

### Database Queries

```sql
-- Get company info
SELECT * FROM companies;

-- Get all accounts with balances
SELECT
  name,
  type,
  currency,
  current_balance
FROM accounts
WHERE deleted_at IS NULL;

-- Get document counts by type
SELECT
  document_type,
  COUNT(*) as count
FROM documents
WHERE deleted_at IS NULL
GROUP BY document_type;

-- Get today's document numbers
SELECT
  document_type,
  counter
FROM document_counters
WHERE date_key = TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

-- Get account transaction history
SELECT
  t.transaction_date,
  t.transaction_type,
  t.description,
  t.amount,
  t.balance_before,
  t.balance_after
FROM transactions t
WHERE t.account_id = 'YOUR_ACCOUNT_ID'
ORDER BY t.transaction_date DESC;
```

### Service Functions

```typescript
// Company operations
const company = await getOrCreateDefaultCompany();
await updateCompanyInfo(companyId, { name: 'New Name' });

// Account operations
const accounts = await getAccounts(companyId);
const account = await createAccount(companyId, accountData);
await updateAccount(accountId, { currentBalance: 5000 });
await deleteAccount(accountId);

// Document operations
const docNumber = await generateDocumentNumber(companyId, 'invoice');
const documents = await getDocuments(companyId);
const document = await createDocument(companyId, documentData);
await updateDocument(documentId, { status: 'completed' });
await deleteDocument(documentId);

// Transaction operations
const transactions = await getTransactions(accountId);
```

---

## Support

- **Documentation**: See `MIGRATION_SUMMARY.md` for complete overview
- **Testing**: See `TESTING_CHECKLIST.md` for comprehensive tests
- **Migration Guide**: See `SUPABASE_MIGRATION.md` for detailed steps
- **Database Schema**: See `DATABASE_SCHEMA.md` for schema details

---

**Ready to Go!** 🚀

Your database is set up and ready. Follow the integration steps in `MIGRATION_SUMMARY.md` to complete the migration.
