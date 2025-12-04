# WIF Finance System - Database Schema Audit Report

**Generated:** 2025-12-04
**Purpose:** Audit database schema against frontend/backend code to identify discrepancies

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Schema Overview](#database-schema-overview)
3. [Table-Column Mapping](#table-column-mapping)
4. [TypeScript Type Mappings](#typescript-type-mappings)
5. [Service Layer Operations](#service-layer-operations)
6. [Mobile vs Web App Comparison](#mobile-vs-web-app-comparison)
7. [Discrepancies Found](#discrepancies-found)
8. [Recommendations](#recommendations)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Database Tables | 14 active |
| Total TypeScript Types | 33+ |
| Service Functions | 50+ |
| Discrepancies Found | 5 minor |
| Critical Issues | 0 |

**Overall Assessment:** The system is well-aligned between database and application code.

---

## Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WIF FINANCE DATABASE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐       ┌──────────────┐       ┌─────────────────┐           │
│  │  companies  │───┬───│   accounts   │───────│  transactions   │           │
│  └─────────────┘   │   └──────────────┘       └─────────────────┘           │
│                    │                                                         │
│                    │   ┌──────────────┐       ┌─────────────────┐           │
│                    ├───│   documents  │───┬───│   line_items    │           │
│                    │   └──────────────┘   │   └─────────────────┘           │
│                    │          │           │                                  │
│                    │          ├───────────┼─────────────────────────────┐   │
│                    │          │           │                             │   │
│                    │   ┌──────▼─────┐  ┌──▼──────────┐  ┌──────────────▼┐  │
│                    │   │  invoices  │  │  receipts   │  │payment_vouchers│  │
│                    │   └────────────┘  └─────────────┘  └───────────────┘  │
│                    │                          │                  │          │
│                    │                          │     ┌────────────▼────────┐ │
│                    │                          └─────│statements_of_payment│ │
│                    │                                └─────────────────────┘ │
│                    │                                                         │
│                    │   ┌──────────────┐       ┌─────────────────┐           │
│                    ├───│    users     │───────│    sessions     │           │
│                    │   └──────────────┘       └─────────────────┘           │
│                    │          │                                              │
│                    │          │               ┌─────────────────┐           │
│                    │          └───────────────│  activity_logs  │           │
│                    │                          └─────────────────┘           │
│                    │                                                         │
│                    │   ┌──────────────┐       ┌─────────────────┐           │
│                    └───│   bookings   │───────│document_counters│           │
│                        └──────────────┘       └─────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table-Column Mapping

### 1. COMPANIES

| DB Column | Type | TS Property | Web Type | Mobile Type |
|-----------|------|-------------|----------|-------------|
| id | UUID | id | string | string |
| name | TEXT | name | string | string |
| address | TEXT | address | string? | string? |
| tel | TEXT | tel | string? | string? |
| email | TEXT | email | string? | string? |
| registration_no | TEXT | registrationNo | string? | string? |
| registered_office | TEXT | registeredOffice | string? | string? |
| allow_negative_balance | BOOLEAN | allowNegativeBalance | boolean | boolean |
| created_at | TIMESTAMPTZ | createdAt | string | string |
| updated_at | TIMESTAMPTZ | updatedAt | string | string |

---

### 2. ACCOUNTS

| DB Column | Type | TS Property | Web Type | Mobile Type | Notes |
|-----------|------|-------------|----------|-------------|-------|
| id | UUID | id | string | string | |
| company_id | UUID | companyId | string | string | FK → companies |
| name | TEXT | name | string | string | |
| type | TEXT | type | AccountType | AccountType | 'main_bank' \| 'petty_cash' |
| currency | TEXT | currency | Currency | Currency | 'MYR' \| 'JPY' |
| country | TEXT | country | Country | Country | 'Malaysia' \| 'Japan' |
| bank_name | TEXT | bankName | string? | string? | Required if type='main_bank' |
| account_number | TEXT | accountNumber | string? | string? | |
| custodian | TEXT | custodian | string? | string? | Required if type='petty_cash' |
| initial_balance | DECIMAL(15,2) | initialBalance | number | number | |
| current_balance | DECIMAL(15,2) | currentBalance | number | number | Updated by trigger |
| is_active | BOOLEAN | isActive | boolean | boolean | |
| notes | TEXT | notes | string? | string? | |
| created_at | TIMESTAMPTZ | createdAt | string | string | |
| updated_at | TIMESTAMPTZ | updatedAt | string | string | |
| deleted_at | TIMESTAMPTZ | deletedAt | string? | string? | Soft delete |

---

### 3. DOCUMENTS (Base Table)

| DB Column | Type | TS Property | Web Type | Mobile Type | Notes |
|-----------|------|-------------|----------|-------------|-------|
| id | UUID | id | string | string | |
| company_id | UUID | companyId | string | string | FK → companies |
| account_id | UUID | accountId | string? | string? | FK → accounts |
| booking_id | UUID | bookingId | string? | string? | FK → bookings |
| document_type | TEXT | documentType | DocumentType | DocumentType | Polymorphic discriminator |
| document_number | TEXT | documentNumber | string | string | UNIQUE per company |
| status | TEXT | status | DocumentStatus | DocumentStatus | |
| document_date | DATE | date | string | string | |
| currency | TEXT | currency | Currency | Currency | |
| country | TEXT | country | Country | Country | |
| amount | DECIMAL(15,2) | amount | number | number | |
| subtotal | DECIMAL(15,2) | subtotal | number? | number? | |
| tax_rate | DECIMAL(5,2) | taxRate | number? | number? | |
| tax_amount | DECIMAL(15,2) | taxAmount | number? | number? | |
| total | DECIMAL(15,2) | total | number? | number? | |
| notes | TEXT | notes | string? | string? | |
| created_at | TIMESTAMPTZ | createdAt | string | string | |
| updated_at | TIMESTAMPTZ | updatedAt | string | string | |
| deleted_at | TIMESTAMPTZ | deletedAt | string? | string? | Soft delete |

---

### 4. INVOICES

| DB Column | Type | TS Property | Web Type | Mobile Type |
|-----------|------|-------------|----------|-------------|
| id | UUID | - | - | - | Internal |
| document_id | UUID | - | - | - | FK → documents |
| customer_name | TEXT | customerName | string | string |
| customer_address | TEXT | customerAddress | string? | string? |
| customer_email | TEXT | customerEmail | string? | string? |
| invoice_date | DATE | invoiceDate | string | string |
| due_date | DATE | dueDate | string | string |
| payment_terms | TEXT | paymentTerms | string? | string? |

---

### 5. RECEIPTS

| DB Column | Type | TS Property | Web Type | Mobile Type | Notes |
|-----------|------|-------------|----------|-------------|-------|
| id | UUID | - | - | - | Internal |
| document_id | UUID | - | - | - | FK → documents |
| linked_invoice_id | UUID | linkedInvoiceId | string? | string? | FK → invoices |
| payer_name | TEXT | payerName | string | string | |
| payer_contact | TEXT | payerContact | string? | string? | |
| receipt_date | DATE | receiptDate | string | string | |
| payment_method | TEXT | paymentMethod | string | string | |
| received_by | TEXT | receivedBy | string | string | |

---

### 6. PAYMENT_VOUCHERS

| DB Column | Type | TS Property | Web Type | Mobile Type |
|-----------|------|-------------|----------|-------------|
| id | UUID | - | - | - |
| document_id | UUID | - | - | - |
| payee_name | TEXT | payeeName | string | string |
| payee_address | TEXT | payeeAddress | string? | string? |
| payee_bank_account | TEXT | payeeBankAccount | string? | string? |
| payee_bank_name | TEXT | payeeBankName | string? | string? |
| voucher_date | DATE | voucherDate | string | string |
| payment_due_date | DATE | paymentDueDate | string? | string? |
| requested_by | TEXT | requestedBy | string | string |
| approved_by | TEXT | approvedBy | string? | string? |
| approval_date | DATE | approvalDate | string? | string? |
| supporting_doc_storage_path | TEXT | supportingDocStoragePath | string? | string? |

---

### 7. STATEMENTS_OF_PAYMENT

| DB Column | Type | TS Property | Web Type | Mobile Type | Notes |
|-----------|------|-------------|----------|-------------|-------|
| id | UUID | - | - | - | |
| document_id | UUID | - | - | - | |
| linked_voucher_id | UUID | linkedVoucherId | string | string | FK → payment_vouchers |
| payment_date | DATE | paymentDate | string | string | |
| payment_method | TEXT | paymentMethod | string | string | |
| transaction_reference | TEXT | transactionReference | string | string | |
| transfer_proof_filename | TEXT | transferProofFilename | string? | string? | |
| transfer_proof_base64 | TEXT | transferProofBase64 | string? | string? | Legacy |
| transfer_proof_storage_path | TEXT | transferProofStoragePath | string? | string? | New |
| confirmed_by | TEXT | confirmedBy | string | string | |
| payee_name | TEXT | payeeName | string | string | |
| transaction_fee | DECIMAL(15,2) | transactionFee | number? | number? | |
| transaction_fee_type | TEXT | transactionFeeType | string? | string? | |
| total_deducted | DECIMAL(15,2) | totalDeducted | number | number | **Critical for balance** |

---

### 8. LINE_ITEMS

| DB Column | Type | TS Property | Web Type | Mobile Type |
|-----------|------|-------------|----------|-------------|
| id | UUID | id | string | string |
| document_id | UUID | - | - | - |
| line_number | INTEGER | - | - | - |
| description | TEXT | description | string | string |
| quantity | DECIMAL(10,2) | quantity | number | number |
| unit_price | DECIMAL(15,2) | unitPrice | number | number |
| amount | DECIMAL(15,2) | amount | number | number |

---

### 9. TRANSACTIONS

| DB Column | Type | TS Property | Web Type | Mobile Type | Notes |
|-----------|------|-------------|----------|-------------|-------|
| id | UUID | id | string | string | |
| account_id | UUID | accountId | string | string | |
| document_id | UUID | documentId | string | string | |
| transaction_type | TEXT | type | TransactionType | 'increase' \| 'decrease' | **Name differs!** |
| description | TEXT | description | string | string? | |
| amount | DECIMAL(15,2) | amount | number | number | |
| balance_before | DECIMAL(15,2) | balanceBefore | number | number | |
| balance_after | DECIMAL(15,2) | balanceAfter | number | number | |
| metadata | JSONB | metadata | object? | - | Includes reversal flag |
| transaction_date | TIMESTAMPTZ | transactionDate | string | string | |
| created_at | TIMESTAMPTZ | createdAt | string | string | |

---

### 10. USERS

| DB Column | Type | TS Property | Web Type | Mobile Type |
|-----------|------|-------------|----------|-------------|
| id | UUID | id | string | string |
| company_id | UUID | companyId | string | string |
| username | TEXT | username | string | string |
| email | TEXT | email | string | string |
| full_name | TEXT | fullName | string | string |
| password_hash | TEXT | passwordHash | string | - |
| role | TEXT | role | UserRole | UserRole |
| is_active | BOOLEAN | isActive | boolean | boolean |
| failed_login_attempts | INTEGER | failedLoginAttempts | number | - |
| locked_until | TIMESTAMPTZ | lockedUntil | string? | - |
| last_login | TIMESTAMPTZ | lastLogin | string? | string? |
| created_by | UUID | createdBy | string | string |
| created_at | TIMESTAMPTZ | createdAt | string | string |
| updated_at | TIMESTAMPTZ | updatedAt | string | string |

**UserRole Enum:** `'viewer' | 'accountant' | 'manager' | 'admin' | 'operations'`

---

### 11. SESSIONS

| DB Column | Type | TS Property | Web Type |
|-----------|------|-------------|----------|
| id | UUID | id | string |
| user_id | UUID | userId | string |
| token_hash | TEXT | token | string |
| refresh_token_hash | TEXT | refreshToken | string? |
| device_info | JSONB | deviceInfo | object |
| last_activity | TIMESTAMPTZ | lastActivity | string |
| expires_at | TIMESTAMPTZ | expiresAt | string |
| created_at | TIMESTAMPTZ | createdAt | string |

---

### 12. BOOKINGS

| DB Column | Type | TS Property | Web Type | Mobile Type |
|-----------|------|-------------|----------|-------------|
| id | UUID | id | string | string |
| company_id | UUID | companyId | string | string |
| booking_code | VARCHAR(50) | bookingCode/bookingNumber | string | string |
| document_id | UUID | documentId/linkedDocumentId | string? | string? |
| guest_name | TEXT | guestName | string | string |
| trip_start_date | DATE | tripStartDate/startDate | string | string |
| trip_end_date | DATE | tripEndDate/endDate | string? | string? |
| number_of_pax | TEXT | numberOfPax/pax | string | number |
| country | VARCHAR(50) | country | string | string |
| car_types | TEXT[] | carTypes | string[] | string[] |
| transportation_items | JSONB | transportationItems/transportation | JSON | BookingCostItem[] |
| meals_items | JSONB | mealsItems/meals | JSON | BookingCostItem[] |
| entrance_items | JSONB | entranceItems/entranceFees | JSON | BookingCostItem[] |
| tour_guide_items | JSONB | tourGuideItems/tourGuides | JSON | BookingCostItem[] |
| flight_items | JSONB | flightItems/flights | JSON | BookingCostItem[] |
| accommodation_items | JSONB | accommodationItems/accommodation | JSON | BookingCostItem[] |
| grand_total_jpy | DECIMAL(15,2) | grandTotalJpy/totalInternalCostJPY | number | number |
| grand_total_myr | DECIMAL(15,2) | grandTotalMyr | number | number |
| exchange_rate | DECIMAL(10,6) | exchangeRate | number | number |
| wif_cost | DECIMAL(15,2) | wifCost/totalInternalCostMYR | number | number |
| b2b_price | DECIMAL(15,2) | b2bPrice/totalB2BCostMYR | number | number |
| expected_profit | DECIMAL(15,2) | expectedProfit/totalProfitMYR | number | number |
| status | TEXT | status | BookingStatus | BookingStatus |
| is_active | BOOLEAN | isActive | boolean | boolean |
| notes | TEXT | notes | string? | string? |
| created_at | TIMESTAMPTZ | createdAt | string | string |
| updated_at | TIMESTAMPTZ | updatedAt | string | string |

---

## Service Layer Operations

### Database Triggers (Automatic)

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| `create_transaction_trigger` | documents | INSERT/UPDATE status | Creates transaction, updates balance |
| `reverse_transaction_on_delete_trigger` | documents | UPDATE deleted_at | Reverses balance, creates reversal txn |
| `sync_invoice_payment_status` | receipts | INSERT/UPDATE/DELETE | Updates linked invoice status |
| `update_*_updated_at` | All tables | UPDATE | Auto-updates updated_at |

### Key Service Functions

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER OPERATIONS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  supabaseService.ts                                              │
│  ├── Company: getOrCreateDefaultCompany, updateCompanyInfo       │
│  ├── Account: createAccount, getAccounts, updateAccount          │
│  ├── Document: createDocument, getDocument, updateDocument       │
│  │             deleteDocument, generateDocumentNumber            │
│  ├── LineItem: createLineItems (cascade with document)           │
│  └── Transaction: getTransactions (read-only)                    │
│                                                                  │
│  userService.ts                                                  │
│  ├── loadUsers, getAllUsers, getUserById                         │
│  ├── createUser, updateUser, deleteUser                          │
│  └── updateUserPassword, updateUserLoginAttempts                 │
│                                                                  │
│  sessionService.ts                                               │
│  ├── createSession, validateSession, refreshSession              │
│  └── revokeSession, cleanupExpiredSessions                       │
│                                                                  │
│  bookingService.ts                                               │
│  ├── createBooking, getBooking, getAllBookings                   │
│  ├── updateBooking, deleteBooking                                │
│  └── getBookingWithProfit, getAllBookingsWithProfit              │
│                                                                  │
│  transactionService.ts (Business Logic - No DB Writes)           │
│  ├── validateTransaction, calculateBalanceChange                 │
│  ├── shouldAffectAccount, applyTransaction                       │
│  └── reverseTransaction, createTransaction                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mobile vs Web App Comparison

### Type Alignment Status

| Category | Web App | Mobile App | Status |
|----------|---------|------------|--------|
| Documents | types/document.ts | src/types/document.ts | ✅ Aligned |
| Accounts | types/account.ts | src/types/account.ts | ✅ Aligned |
| Transactions | types/transaction.ts | src/types/account.ts | ✅ Aligned |
| Users | types/auth.ts | src/types/auth.ts | ✅ Aligned |
| Bookings | types/booking.ts | src/types/booking.ts | ⚠️ Minor diffs |

### Property Naming Differences

| Entity | Web Property | Mobile Property | DB Column |
|--------|-------------|-----------------|-----------|
| Booking | bookingCode | bookingNumber | booking_code |
| Booking | tripStartDate | startDate | trip_start_date |
| Booking | numberOfPax (string) | pax (number) | number_of_pax |
| Transaction | type | type | transaction_type |

---

## Discrepancies Found

### 1. Transaction Type Column Name ⚠️
- **DB Column:** `transaction_type`
- **TS Property:** `type`
- **Impact:** Low - correctly mapped in service layer
- **Status:** Documented, working correctly

### 2. Booking Pax Type Mismatch ⚠️
- **DB Column:** `number_of_pax` (TEXT - stores "8A + 2CWB + 1TG")
- **Mobile Type:** `pax: number`
- **Impact:** Medium - service layer parses string to number
- **Status:** Works but inconsistent

### 3. Missing Mobile-Only Fields ⚠️
- **Mobile has:** `createdBy`, `updatedBy` in BaseDocument
- **DB has:** Not stored (computed on read)
- **Impact:** Low - intentional design choice

### 4. Booking "Other" Category ⚠️
- **Mobile has:** `other: BookingCostItem[]`
- **DB has:** No `other_items` column
- **Impact:** Medium - mobile feature not persisted

### 5. Legacy Base64 Storage Fields ⚠️
- **DB has:** `transfer_proof_base64`, `supporting_doc_base64`
- **Current:** Migrating to `*_storage_path` (Supabase Storage)
- **Impact:** Low - backward compatibility maintained

---

## Recommendations

### Immediate Actions

1. **Document the transaction_type mapping** - Add comment in mobile types
2. **Standardize booking pax field** - Consider storing as number in DB
3. **Add other_items column** - To persist mobile's "other" category

### Future Improvements

1. **Remove legacy base64 fields** - After full migration to storage
2. **Add database types generation** - Use Supabase CLI for type safety
3. **Unify property naming** - Standardize web/mobile naming conventions

### Code Quality

1. **Add schema validation** - Zod schemas matching DB constraints
2. **Implement migrations tracking** - Version control for schema changes
3. **Add integration tests** - Verify type mappings at runtime

---

## Appendix: Database Functions

### Document Number Generation
```sql
generate_document_number(p_company_id UUID, p_document_type TEXT)
-- Returns: WIF-{PREFIX}-{YYYYMMDD}-{XXX}
-- Prefixes: INV, RCP, PV, SOP
```

### Balance Validation
```sql
validate_payment_balance()
-- Checks: account.current_balance >= document.amount (for SOPs)
-- Skip if: company.allow_negative_balance = true
```

### Transaction Creation
```sql
create_transaction_on_document_complete()
-- Fires: AFTER INSERT OR UPDATE OF status ON documents
-- Creates: Transaction record with balance_before/after
-- Updates: accounts.current_balance
```

### Balance Reversal
```sql
reverse_transaction_on_document_delete()
-- Fires: AFTER UPDATE OF deleted_at ON documents
-- Creates: Reversal transaction
-- Updates: accounts.current_balance (reverses)
```

---

**End of Audit Report**
