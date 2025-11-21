# Supabase Migration Guide

## Overview

This guide walks you through migrating the WIF Finance application from localStorage to Supabase (PostgreSQL). The migration maintains all existing functionality while enabling cloud-based data persistence, better performance, and multi-device access.

---

## Prerequisites

1. **Supabase Account**: Already set up at https://fthkayaprkicvzgqeipq.supabase.co
2. **Environment Variables**: Configured in `.env.production`
3. **Database Schema**: Designed in `DATABASE_SCHEMA.md`
4. **Migration SQL**: Created in `supabase/migrations/001_initial_schema.sql`

---

## Migration Steps

### Step 1: Run SQL Migration

#### Option A: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `supabase/migrations/001_initial_schema.sql`
5. Paste and execute
6. Verify all tables were created successfully

#### Option B: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref fthkayaprkicvzgqeipq

# Run the migration
supabase db push
```

### Step 2: Verify Database Setup

After running the migration, verify the following in Supabase Dashboard:

**Tables Created** (10 tables):
- ✅ companies
- ✅ accounts
- ✅ documents
- ✅ invoices
- ✅ receipts
- ✅ payment_vouchers
- ✅ statements_of_payment
- ✅ line_items
- ✅ transactions
- ✅ document_counters

**Functions Created** (4 functions):
- ✅ update_updated_at_column()
- ✅ generate_document_number()
- ✅ validate_payment_balance()
- ✅ create_transaction_on_document_complete()

**Triggers Created** (~12 triggers):
- ✅ Updated_at triggers for all tables
- ✅ Validation triggers for documents
- ✅ Transaction creation triggers

**Indexes Created** (20+ indexes):
- ✅ All foreign keys indexed
- ✅ Query optimization indexes
- ✅ Compound indexes for common queries

**RLS Policies**:
- ✅ Basic policies enabled (currently open for development)
- ⚠️ **TODO**: Customize RLS policies when implementing multi-tenant auth

### Step 3: Test Supabase Connection

Test the connection from your application:

```bash
# Start the development server
npm run dev

# The app should connect to Supabase automatically
# Check browser console for any connection errors
```

Verify in code:
```typescript
import { supabase } from './lib/supabase';

// Test connection
const { data, error } = await supabase.from('companies').select('count');
console.log('Connection test:', data, error);
```

---

## Data Migration (Optional)

If you have existing data in localStorage that you want to migrate to Supabase:

### Migration Script

Create a migration helper script:

```typescript
// scripts/migrateLocalStorageToSupabase.ts

import { supabase } from './lib/supabase';
import {
  getOrCreateDefaultCompany,
  createAccount,
  createDocument
} from './services/supabaseService';

async function migrateData() {
  try {
    console.log('Starting migration...');

    // 1. Get or create company
    const companyInfo = JSON.parse(
      localStorage.getItem('wif_company_info') || '{}'
    );
    const company = await getOrCreateDefaultCompany(companyInfo);
    console.log('✓ Company ready:', company.name);

    // 2. Migrate accounts
    const accountsJson = localStorage.getItem('malaysia_japan_accounts');
    if (accountsJson) {
      const accounts = JSON.parse(accountsJson);
      console.log(`Migrating ${accounts.length} accounts...`);

      for (const account of accounts) {
        await createAccount(company.id, account);
        console.log(`✓ Migrated account: ${account.name}`);
      }
    }

    // 3. Migrate documents
    const documentsJson = localStorage.getItem('malaysia_japan_documents');
    if (documentsJson) {
      const documents = JSON.parse(documentsJson);
      console.log(`Migrating ${documents.length} documents...`);

      for (const doc of documents) {
        await createDocument(company.id, doc);
        console.log(`✓ Migrated document: ${doc.documentNumber}`);
      }
    }

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateData();
```

### Running the Migration

```bash
# Create the script
npm run migrate-data

# Or manually run in browser console
```

**Important Notes**:
- ⚠️ Run this ONLY ONCE to avoid duplicates
- ✅ Backup your localStorage data first (export to JSON)
- ✅ Test on a small dataset first
- ✅ Verify data integrity after migration

---

## Testing Checklist

After migration, test all functionality:

### Account Management
- [ ] Create new account
- [ ] View all accounts
- [ ] Update account balance
- [ ] Account balance calculations are correct

### Document Creation
- [ ] Create Invoice
- [ ] Create Receipt (linked to invoice)
- [ ] Create Payment Voucher
- [ ] Create Statement of Payment (linked to voucher)
- [ ] Document numbers auto-generate correctly
- [ ] Line items save correctly

### Document Workflow
- [ ] Invoice → Receipt workflow (status changes)
- [ ] Payment Voucher → Statement of Payment workflow
- [ ] Account balances update correctly on completion
- [ ] Transactions are created automatically

### Data Integrity
- [ ] All foreign key relationships work
- [ ] No orphaned records
- [ ] Balances match transaction history
- [ ] Soft deletes work (deleted_at)

### Performance
- [ ] Document list loads quickly
- [ ] Search and filter work smoothly
- [ ] No N+1 query issues
- [ ] Indexes are being used (check query plans)

---

## Rollback Plan

If you need to rollback to localStorage:

### Quick Rollback
1. Stop using Supabase services (comment out imports)
2. Revert to localStorage-based services
3. Your localStorage data should still be intact

### Data Export
Before migration, export all localStorage data:

```javascript
// Export localStorage data
const backup = {
  documents: localStorage.getItem('malaysia_japan_documents'),
  accounts: localStorage.getItem('malaysia_japan_accounts'),
  users: localStorage.getItem('wif_users'),
  company: localStorage.getItem('wif_company_info'),
  settings: localStorage.getItem('wif_security_settings'),
};

// Download as JSON
const blob = new Blob([JSON.stringify(backup, null, 2)], {
  type: 'application/json'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `wif-backup-${new Date().toISOString()}.json`;
a.click();
```

### Restore from Backup
```javascript
// Restore from backup file
const backup = JSON.parse(backupFileContent);
Object.keys(backup).forEach(key => {
  if (backup[key]) {
    localStorage.setItem(key, backup[key]);
  }
});
```

---

## Environment Configuration

### Development (.env.development)
```bash
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Production (.env.production)
```bash
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Common Issues & Solutions

### Issue: "Missing environment variables"
**Solution**: Ensure `.env.production` exists and contains valid Supabase credentials

### Issue: "Failed to connect to Supabase"
**Solution**:
- Check internet connection
- Verify Supabase project is active
- Confirm API keys are correct

### Issue: "RLS policy violation"
**Solution**:
- For development, RLS policies are set to allow all operations
- For production, customize RLS policies based on your auth setup

### Issue: "Document number conflicts"
**Solution**:
- The `generate_document_number()` function uses atomic operations
- If conflicts occur, check `document_counters` table for duplicate entries

### Issue: "Balance mismatch"
**Solution**:
- Transactions are created automatically via triggers
- Check `transactions` table for audit trail
- Recalculate balances from initial + sum of transactions

---

## Performance Optimization

### Database Indexes
All critical queries are indexed:
- Foreign keys (company_id, account_id, document_id)
- Common filters (status, type, date)
- Compound indexes for complex queries

### Query Optimization
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE company_id = 'xxx'
AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Caching Strategy
Consider implementing:
- React Query for client-side caching
- Supabase Realtime for live updates
- Service Worker for offline support

---

## Security Considerations

### Row Level Security (RLS)
Current setup: **Basic policies (open for development)**

**TODO for production**:
- Implement proper RLS policies based on user roles
- Ensure users can only access their company's data
- Add admin-only policies for sensitive operations

### API Keys
- ✅ Anon key is safe for client-side use (limited permissions)
- ⚠️ Service role key should NEVER be exposed to client
- ✅ Use environment variables, never hardcode

### Data Validation
- ✅ Database constraints enforce data integrity
- ✅ Type checking via TypeScript
- ✅ Validation functions in triggers

---

## Monitoring & Maintenance

### Database Monitoring
1. Go to Supabase Dashboard → Database → Logs
2. Monitor query performance
3. Check for errors and slow queries
4. Review table sizes and growth

### Backup Strategy
Supabase provides:
- ✅ Automatic daily backups
- ✅ Point-in-time recovery
- ✅ Manual backup/restore via dashboard

### Regular Maintenance
- Clean up old `document_counters` (keep last 90 days)
- Monitor `transactions` table growth
- Archive old documents if needed

---

## Next Steps

### Phase 1: Core Migration ✅
- [x] Create database schema
- [x] Set up Supabase client
- [x] Create service layer
- [x] Test basic operations

### Phase 2: Service Integration (In Progress)
- [ ] Update document services
- [ ] Update account services
- [ ] Update auth services
- [ ] Update activity log services

### Phase 3: UI Integration
- [ ] Update components to use Supabase
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test all user flows

### Phase 4: Advanced Features
- [ ] Implement Supabase Auth
- [ ] Add real-time subscriptions
- [ ] Implement file storage for transfer proofs
- [ ] Add advanced reporting

---

## Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Project Resources
- Database Schema: `DATABASE_SCHEMA.md`
- Migration SQL: `supabase/migrations/001_initial_schema.sql`
- Type Definitions: `types/database.ts`
- Service Layer: `services/supabaseService.ts`

### Getting Help
- Check browser console for errors
- Review Supabase logs in dashboard
- Consult database schema documentation
- Test queries in SQL Editor

---

## Summary

### What Was Migrated
✅ 10 tables with complete relationships
✅ 4 database functions for automation
✅ 12+ triggers for data consistency
✅ 20+ indexes for performance
✅ Row Level Security policies (basic)
✅ Type-safe service layer
✅ Error handling and validation

### What Changed
- **Storage**: localStorage → PostgreSQL
- **Architecture**: Client-side → Client-Server
- **Persistence**: Browser-only → Cloud-based
- **Reliability**: Manual saves → Automatic + ACID transactions
- **Scalability**: Limited → Unlimited

### What Stayed the Same
- ✅ All business logic unchanged
- ✅ UI/UX identical
- ✅ Document workflows preserved
- ✅ User permissions maintained
- ✅ Audit trail functionality

---

**Migration Status**: Ready for testing
**Last Updated**: 2025-01-21
**Version**: 1.0.0
