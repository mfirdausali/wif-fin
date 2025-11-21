# WIF Finance - Supabase Migration Testing Checklist

## Pre-Migration Testing

### Backup Current Data
- [ ] Export all localStorage data to JSON file
- [ ] Save backup in safe location
- [ ] Verify backup file integrity
- [ ] Document current document count
- [ ] Document current account balances

### Environment Setup
- [ ] Verify `.env.production` has correct Supabase credentials
- [ ] Test Supabase connection from browser console
- [ ] Verify Supabase project is active and accessible
- [ ] Check database tables are created successfully

---

## Database Schema Testing

### Tables Creation
- [ ] companies table exists with correct schema
- [ ] accounts table exists with constraints
- [ ] documents table exists with all fields
- [ ] invoices table linked correctly
- [ ] receipts table linked correctly
- [ ] payment_vouchers table linked correctly
- [ ] statements_of_payment table linked correctly
- [ ] line_items table exists
- [ ] transactions table exists
- [ ] document_counters table exists

### Functions
- [ ] `generate_document_number()` function works
- [ ] `update_updated_at_column()` function works
- [ ] `validate_payment_balance()` function works
- [ ] `create_transaction_on_document_complete()` function works

### Triggers
- [ ] updated_at triggers fire on all tables
- [ ] Transaction creation trigger fires correctly
- [ ] Validation trigger prevents insufficient balance

### Indexes
- [ ] All foreign key indexes created
- [ ] Query performance indexes created
- [ ] Compound indexes for complex queries

---

## Service Layer Testing

### Supabase Service
- [ ] `getOrCreateDefaultCompany()` works
- [ ] `updateCompanyInfo()` works
- [ ] `createAccount()` creates accounts successfully
- [ ] `getAccounts()` retrieves all accounts
- [ ] `updateAccount()` updates account data
- [ ] `deleteAccount()` soft deletes accounts
- [ ] `generateDocumentNumber()` generates unique numbers
- [ ] `createDocument()` creates complete documents
- [ ] `getDocuments()` retrieves all documents
- [ ] `getDocument()` retrieves single document with all data
- [ ] `updateDocument()` updates documents
- [ ] `deleteDocument()` soft deletes documents
- [ ] `getTransactions()` retrieves transaction history

---

## Account Management Testing

### Create Account
- [ ] Create main bank account (Malaysia, MYR)
- [ ] Create main bank account (Japan, JPY)
- [ ] Create petty cash account (Malaysia, MYR)
- [ ] Create petty cash account (Japan, JPY)
- [ ] Verify initial balance is set
- [ ] Verify current balance equals initial balance
- [ ] Verify account appears in account list

### Update Account
- [ ] Update account name
- [ ] Update account notes
- [ ] Verify updated_at timestamp changes
- [ ] Verify changes persist after refresh

### Delete Account
- [ ] Soft delete account
- [ ] Verify deleted account doesn't appear in list
- [ ] Verify deleted_at is set
- [ ] Verify account data still exists in database

### Account Balance
- [ ] Verify initial balance calculation
- [ ] Verify current balance updates after transactions
- [ ] Verify balance never goes negative (for payments)
- [ ] Verify balance matches transaction history

---

## Document Creation Testing

### Invoice Creation
- [ ] Create invoice with single line item
- [ ] Create invoice with multiple line items
- [ ] Verify document number format (WIF-INV-YYYYMMDD-XXX)
- [ ] Verify document number increments daily
- [ ] Verify subtotal calculation
- [ ] Verify tax calculation
- [ ] Verify total calculation
- [ ] Verify invoice data saves to invoices table
- [ ] Verify line items save to line_items table
- [ ] Invoice appears in document list
- [ ] Invoice status is 'issued'

### Receipt Creation
- [ ] Create standalone receipt
- [ ] Create receipt linked to invoice
- [ ] Verify linked invoice ID saved
- [ ] Verify receipt date
- [ ] Verify payment method saved
- [ ] Verify account balance INCREASES
- [ ] Verify transaction record created
- [ ] Verify linked invoice status changes to 'paid'
- [ ] Receipt appears in document list
- [ ] Receipt status is 'completed'

### Payment Voucher Creation
- [ ] Create payment voucher with line items
- [ ] Verify payee information saved
- [ ] Verify bank details saved
- [ ] Verify requested_by field
- [ ] Verify approval fields (optional)
- [ ] Voucher appears in document list
- [ ] Voucher status is 'issued'
- [ ] No account balance change yet

### Statement of Payment Creation
- [ ] Create SOP linked to payment voucher
- [ ] Verify linked voucher ID saved
- [ ] Verify payment details saved
- [ ] Verify transaction reference
- [ ] Verify transfer proof saved (if provided)
- [ ] Verify transaction fee calculation
- [ ] Verify total_deducted calculation
- [ ] Verify account balance DECREASES
- [ ] Verify transaction record created
- [ ] Verify linked voucher status changes to 'completed'
- [ ] SOP appears in document list
- [ ] SOP status is 'completed'

---

## Document Number Generation Testing

### Auto-increment
- [ ] First document of the day is -001
- [ ] Second document of the day is -002
- [ ] Numbers increment correctly
- [ ] Numbers reset daily
- [ ] Different document types have separate counters
- [ ] No duplicate numbers generated

### Format Verification
- [ ] Invoice: WIF-INV-YYYYMMDD-XXX
- [ ] Receipt: WIF-RCP-YYYYMMDD-XXX
- [ ] Payment Voucher: WIF-PV-YYYYMMDD-XXX
- [ ] Statement of Payment: WIF-SOP-YYYYMMDD-XXX
- [ ] Date format is YYYYMMDD
- [ ] Counter is 3 digits with leading zeros

---

## Transaction Testing

### Receipt Transactions
- [ ] Receipt creates 'increase' transaction
- [ ] Transaction amount matches receipt amount
- [ ] Balance_before is recorded correctly
- [ ] Balance_after = balance_before + amount
- [ ] Account current_balance updates
- [ ] Transaction appears in account history

### Payment Transactions
- [ ] SOP creates 'decrease' transaction
- [ ] Transaction amount matches total_deducted
- [ ] Balance_before is recorded correctly
- [ ] Balance_after = balance_before - amount
- [ ] Account current_balance updates
- [ ] Transaction appears in account history

### Balance Validation
- [ ] Cannot create payment with insufficient balance
- [ ] Error message shows current vs required balance
- [ ] Transaction is rolled back on error
- [ ] Account balance unchanged on failed payment

---

## Document Workflow Testing

### Invoice → Receipt Workflow
- [ ] Create invoice (status: issued)
- [ ] Invoice appears in "unpaid" list
- [ ] Create receipt for invoice
- [ ] Invoice status changes to 'paid'
- [ ] Invoice removed from "unpaid" list
- [ ] Account balance increases
- [ ] Transaction recorded

### Payment Voucher → Statement Workflow
- [ ] Create payment voucher (status: issued)
- [ ] Voucher appears in "pending" list
- [ ] Create statement for voucher
- [ ] Voucher status changes to 'completed'
- [ ] Voucher removed from "pending" list
- [ ] Account balance decreases
- [ ] Transaction recorded

---

## Data Integrity Testing

### Foreign Keys
- [ ] Cannot delete company with accounts
- [ ] Cannot delete account with transactions
- [ ] Cannot delete document with line items
- [ ] Can set account_id to null on document
- [ ] Cascading deletes work correctly

### Constraints
- [ ] Bank account requires bank_name
- [ ] Petty cash requires custodian
- [ ] Document type limited to valid values
- [ ] Status limited to valid values
- [ ] Currency limited to MYR or JPY
- [ ] Country limited to Malaysia or Japan

### Unique Constraints
- [ ] Document number unique per company
- [ ] One invoice record per document
- [ ] One receipt record per document
- [ ] One voucher record per document
- [ ] One statement record per document
- [ ] One statement per voucher

---

## UI Integration Testing

### App Loading
- [ ] App connects to Supabase on startup
- [ ] Company info loads from database
- [ ] Accounts load from database
- [ ] Documents load from database
- [ ] No console errors on load

### Document List
- [ ] All documents display correctly
- [ ] Filter by type works
- [ ] Filter by status works
- [ ] Search functionality works
- [ ] Sort by date works
- [ ] Pagination works (if implemented)

### Account Balance Sheet
- [ ] Account details display correctly
- [ ] Transaction history loads
- [ ] Balance calculations are correct
- [ ] Transactions sorted by date
- [ ] All transaction details visible

### Settings
- [ ] Company info loads from database
- [ ] Company info updates save to database
- [ ] Changes persist after refresh

---

## Performance Testing

### Load Times
- [ ] Document list loads in < 2 seconds
- [ ] Account list loads in < 1 second
- [ ] Single document loads in < 500ms
- [ ] Transaction history loads in < 1 second

### Query Efficiency
- [ ] No N+1 query issues
- [ ] Indexes being used (check query plans)
- [ ] Joins optimized
- [ ] Large datasets handled efficiently

### Concurrent Operations
- [ ] Multiple documents can be created simultaneously
- [ ] Counter increments atomically (no conflicts)
- [ ] Balance updates are consistent
- [ ] No race conditions

---

## Error Handling Testing

### Network Errors
- [ ] Offline mode handled gracefully
- [ ] Connection timeout shows error message
- [ ] Retry logic works
- [ ] User-friendly error messages

### Validation Errors
- [ ] Required fields validated
- [ ] Invalid data rejected
- [ ] Error messages clear and helpful
- [ ] Form doesn't submit with errors

### Business Logic Errors
- [ ] Insufficient balance prevented
- [ ] Duplicate document numbers prevented
- [ ] Invalid document links prevented
- [ ] Constraint violations caught

---

## Security Testing

### Row Level Security
- [ ] RLS policies enabled
- [ ] Users can only see their company data (when multi-tenant)
- [ ] Anon key has limited permissions
- [ ] Service role not exposed to client

### Data Validation
- [ ] SQL injection prevented
- [ ] XSS attacks prevented
- [ ] Input sanitization working
- [ ] Type safety enforced

---

## Migration Testing

### Data Migration (if applicable)
- [ ] All accounts migrated
- [ ] All documents migrated
- [ ] All line items migrated
- [ ] All relationships preserved
- [ ] Balances match localStorage
- [ ] Document numbers preserved
- [ ] No data loss

### Rollback Testing
- [ ] localStorage backup intact
- [ ] Can restore from backup
- [ ] Rollback procedure documented
- [ ] No data corruption

---

## Regression Testing

### Existing Features
- [ ] Login/logout still works
- [ ] User management still works
- [ ] Activity logs still work
- [ ] PDF generation still works
- [ ] Print functionality still works
- [ ] Export functionality still works

### Permissions
- [ ] Admin permissions work
- [ ] Manager permissions work
- [ ] Accountant permissions work
- [ ] Viewer permissions work
- [ ] Permission checks enforced

---

## Browser Compatibility

### Desktop
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive design works

---

## Production Readiness

### Documentation
- [ ] Migration guide complete
- [ ] Testing checklist complete
- [ ] API documentation updated
- [ ] User guide updated

### Monitoring
- [ ] Error tracking set up
- [ ] Performance monitoring enabled
- [ ] Database monitoring configured
- [ ] Backup strategy verified

### Deployment
- [ ] Environment variables set
- [ ] Build process works
- [ ] Deployment successful
- [ ] Health check passing

---

## Sign-Off

### Testing Complete
- [ ] All critical tests passing
- [ ] No blocking bugs
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete

### Stakeholder Approval
- [ ] Technical lead approval
- [ ] Business owner approval
- [ ] End-user testing complete
- [ ] Ready for production

---

**Testing Date**: _______________
**Tested By**: _______________
**Status**: [ ] Pass [ ] Fail [ ] Needs Review
**Notes**: _______________________________________________
