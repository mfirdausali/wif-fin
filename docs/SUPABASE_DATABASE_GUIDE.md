# WIF Finance - Supabase & Database Complete Guide

> **Single source of truth** for the entire database layer, migrations, authentication, and Supabase implementation.
> Written for junior developers — every concept is explained from first principles.

**Last verified against production:** 2026-03-03
**Live production stats:** 317 documents, 7 users, 2 accounts, 2 bookings

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How Supabase Works in This App](#2-how-supabase-works-in-this-app)
3. [Database Tables — Complete Reference](#3-database-tables--complete-reference)
4. [Migration History — What Each Migration Does](#4-migration-history--what-each-migration-does)
5. [Row Level Security (RLS) — Who Can Access What](#5-row-level-security-rls--who-can-access-what)
6. [Database Functions & Triggers — Automatic Business Logic](#6-database-functions--triggers--automatic-business-logic)
7. [Authentication System — Custom Auth (NOT Supabase Auth)](#7-authentication-system--custom-auth-not-supabase-auth)
8. [Frontend ↔ Supabase Integration](#8-frontend--supabase-integration)
9. [Document Lifecycle — From Creation to Accounting](#9-document-lifecycle--from-creation-to-accounting)
10. [Booking System](#10-booking-system)
11. [Storage — File Uploads](#11-storage--file-uploads)
12. [TypeScript Types — Database ↔ Frontend Mapping](#12-typescript-types--database--frontend-mapping)
13. [Rate Limiting](#13-rate-limiting)
14. [Common Patterns & Gotchas](#14-common-patterns--gotchas)
15. [Rollback Files](#15-rollback-files)
16. [Live Database Quick Reference](#16-live-database-quick-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (Vite + TypeScript)                                     │
│                                                          │
│  lib/supabase.ts ──────────── Supabase JS Client         │
│       │                                                  │
│       ├── services/supabaseService.ts  (documents,       │
│       │                                 accounts,        │
│       │                                 transactions)    │
│       ├── services/userService.ts      (user CRUD)       │
│       ├── services/sessionService.ts   (sessions)        │
│       ├── services/authService.ts      (login/logout)    │
│       ├── services/bookingService.ts   (bookings)        │
│       ├── services/storageService.ts   (file uploads)    │
│       └── services/activityLogService.ts (audit trail)   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (PostgREST API)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Cloud (PostgreSQL)                  │
│                                                          │
│  Project: fthkayaprkicvzgqeipq                           │
│  Region:  (Supabase managed)                             │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  15 Tables + 1 View + 16 Functions           │        │
│  │  + 17 Triggers + 60+ RLS Policies            │        │
│  │  + 50+ Indexes + 1 Storage Bucket            │        │
│  └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Auth system | **Custom** (NOT Supabase Auth) | Full control over sessions, password policy, lockout |
| Multi-tenancy | **Single-tenant** (1 company) | App serves one company (WIF SERVICES) |
| Soft deletes | **Yes** (`deleted_at` column) | Financial data must never truly disappear |
| Currency | **Dual** (MYR + JPY) | Malaysian company operating tours in Japan |
| RLS strategy | **service_role only** | All queries go through service_role; anon blocked on most tables |
| Document pattern | **Polymorphic** | Single `documents` table + type-specific child tables |

---

## 2. How Supabase Works in This App

### What is Supabase?

Supabase is a cloud PostgreSQL database with a REST API layer on top. Instead of writing raw SQL, you call:

```typescript
// This becomes: SELECT * FROM accounts WHERE company_id = '...' AND deleted_at IS NULL
const { data, error } = await supabase
  .from('accounts')
  .select('*')
  .eq('company_id', companyId)
  .is('deleted_at', null);
```

### Client Setup

**File:** `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;    // https://fthkayaprkicvzgqeipq.supabase.co
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY; // JWT token

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  db: { schema: 'public' },
  global: { headers: { 'x-application-name': 'wif-finance' } },
});
```

**Important:** The `<Database>` generic gives you full TypeScript autocomplete on all table queries. If you add a column in a migration, update `types/database.ts` too.

### Environment Variables

```bash
# .env.production
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...  # Public key (safe to expose)
```

The `anon` key is a public key — it only has permissions defined by RLS policies. It is NOT a secret.

---

## 3. Database Tables — Complete Reference

### 3.1 `companies` — The Organization

Stores the single company this app serves.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID (PK) | `gen_random_uuid()` | Always `c0000000-0000-0000-0000-000000000001` in production |
| `name` | TEXT | — | Currently "WIF SERVICES" |
| `address` | TEXT | — | Company address |
| `tel` | TEXT | — | Phone number |
| `email` | TEXT | — | Company email |
| `registration_no` | TEXT | — | Malaysian company registration |
| `registered_office` | TEXT | — | Legal registered address |
| `allow_negative_balance` | BOOLEAN | `false` | If true, accounts can go below zero |
| `created_at` | TIMESTAMPTZ | `now()` | — |
| `updated_at` | TIMESTAMPTZ | `now()` | Auto-updated by trigger |

**Seed data:** One company is always inserted: `WIF JAPAN SDN BHD` with ID `c0000000-0000-0000-0000-000000000001`.

---

### 3.2 `accounts` — Bank Accounts & Petty Cash

Each account holds money in either MYR or JPY.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `company_id` | UUID (FK → companies) | ON DELETE CASCADE |
| `name` | TEXT | Display name (e.g., "WIF JAPAN SDN BHD") |
| `type` | TEXT | `'main_bank'` or `'petty_cash'` |
| `currency` | TEXT | `'MYR'` or `'JPY'` |
| `country` | TEXT | `'Malaysia'` or `'Japan'` |
| `bank_name` | TEXT | Required when type = 'main_bank' |
| `account_number` | TEXT | Bank account number |
| `custodian` | TEXT | Required when type = 'petty_cash' |
| `initial_balance` | DECIMAL(15,2) | Starting balance |
| `current_balance` | DECIMAL(15,2) | **Auto-maintained by triggers** — never update directly! |
| `is_active` | BOOLEAN | Soft toggle |
| `metadata` | JSONB | Extra data |
| `notes` | TEXT | — |
| `deleted_at` | TIMESTAMPTZ | Soft delete (NULL = active) |
| `created_at` / `updated_at` | TIMESTAMPTZ | — |

**Live data (2026-03-03):**
| Name | Type | Currency | Balance |
|---|---|---|---|
| WIF JAPAN SDN BHD | main_bank | MYR | 208,215.40 |
| WIF x Firdaus | petty_cash | JPY | -672,210.00 |

**Constraints:**
- `check_bank_account_fields`: If type = 'main_bank', `bank_name` must not be empty
- `check_petty_cash_fields`: If type = 'petty_cash', `custodian` must not be empty

---

### 3.3 `documents` — The Polymorphic Parent

**This is the most important table.** Every invoice, receipt, payment voucher, and statement of payment starts as a row here. Type-specific details go into child tables.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `company_id` | UUID (FK → companies) | — |
| `account_id` | UUID (FK → accounts) | Which account this document affects |
| `document_type` | TEXT | `'invoice'`, `'receipt'`, `'payment_voucher'`, `'statement_of_payment'` |
| `document_number` | TEXT | Auto-generated. Format: `WIF-INV-20260303-001` |
| `status` | TEXT | `'draft'` → `'issued'` → `'paid'` / `'completed'` / `'cancelled'` |
| `document_date` | DATE | — |
| `currency` | TEXT | `'MYR'` or `'JPY'` |
| `country` | TEXT | `'Malaysia'` or `'Japan'` |
| `amount` | DECIMAL(15,2) | Total amount |
| `subtotal` | DECIMAL(15,2) | Before tax |
| `tax_rate` | DECIMAL(5,2) | Tax percentage |
| `tax_amount` | DECIMAL(15,2) | Tax in currency |
| `total` | DECIMAL(15,2) | Final total |
| `document_discount_type` | TEXT | `'fixed'` or `'percentage'` |
| `document_discount_value` | DECIMAL(15,2) | Discount input value |
| `document_discount_amount` | DECIMAL(15,2) | Calculated discount |
| `booking_id` | UUID (FK → bookings) | Link to a trip booking |
| `notes` | TEXT | — |
| `metadata` | JSONB | — |
| `deleted_at` | TIMESTAMPTZ | Soft delete |
| `created_at` / `updated_at` | TIMESTAMPTZ | — |

**Unique constraint:** `(company_id, document_number)` — no two documents share a number within a company.

**Live stats:** 317 active documents (118 PV, 92 SOP, 59 invoices, 48 receipts)

---

### 3.4 `invoices` — Invoice-Specific Data

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `document_id` | UUID (FK → documents, UNIQUE) | One-to-one with documents |
| `customer_name` | TEXT | Who is being billed |
| `customer_address` | TEXT | — |
| `customer_email` | TEXT | — |
| `invoice_date` | DATE | — |
| `due_date` | DATE | — |
| `payment_terms` | TEXT | e.g., "Net 30" |

---

### 3.5 `receipts` — Receipt-Specific Data

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `document_id` | UUID (FK → documents, UNIQUE) | — |
| `linked_invoice_id` | UUID (FK → invoices) | Which invoice this receipt pays |
| `payer_name` | TEXT | Who paid |
| `payer_contact` | TEXT | — |
| `receipt_date` | DATE | — |
| `payment_method` | TEXT | e.g., "Bank Transfer", "Cash" |
| `received_by` | TEXT | Staff who received payment |

---

### 3.6 `payment_vouchers` — Payment Voucher Data

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `document_id` | UUID (FK → documents, UNIQUE) | — |
| `payee_name` | TEXT | Who is being paid |
| `payee_address` | TEXT | — |
| `payee_bank_account` | TEXT | — |
| `payee_bank_name` | TEXT | — |
| `voucher_date` | DATE | — |
| `payment_due_date` | DATE | — |
| `requested_by` | TEXT | Who requested the payment |
| `approved_by` | TEXT | Manager who approved |
| `approval_date` | DATE | — |
| `supporting_doc_storage_path` | TEXT | Path in Supabase Storage |

---

### 3.7 `statements_of_payment` — Proof of Payment

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `document_id` | UUID (FK → documents, UNIQUE) | — |
| `linked_voucher_id` | UUID (FK → payment_vouchers, UNIQUE) | One SOP per voucher |
| `payment_date` | DATE | When payment was made |
| `payment_method` | TEXT | — |
| `transaction_reference` | TEXT | Bank reference number |
| `transfer_proof_filename` | TEXT | — |
| `transfer_proof_base64` | TEXT | Legacy: inline proof image |
| `transfer_proof_storage_path` | TEXT | New: Supabase Storage path |
| `confirmed_by` | TEXT | — |
| `payee_name` | TEXT | — |
| `transaction_fee` | DECIMAL(15,2) | Bank fees |
| `transaction_fee_type` | TEXT | — |
| `total_deducted` | DECIMAL(15,2) | Amount actually taken from account (may differ from document amount) |

---

### 3.8 `line_items` — Document Line Items

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `document_id` | UUID (FK → documents) | ON DELETE CASCADE |
| `line_number` | INTEGER | Ordering (1, 2, 3...) |
| `description` | TEXT | What was sold/paid |
| `quantity` | DECIMAL(10,2) | Default 1 |
| `unit_price` | DECIMAL(15,2) | — |
| `discount_type` | TEXT | `'fixed'` or `'percentage'` |
| `discount_value` | DECIMAL(15,2) | — |
| `discount_amount` | DECIMAL(15,2) | Calculated |
| `amount` | DECIMAL(15,2) | Line total after discount |

**Unique:** `(document_id, line_number)` — each line item has a unique position per document.

**Update pattern:** On document update, all line items are **deleted and re-inserted** (not individually updated).

---

### 3.9 `transactions` — Account Ledger

**Read-only from the frontend** — only database triggers write to this table.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `account_id` | UUID (FK → accounts) | — |
| `document_id` | UUID (FK → documents) | Which document caused this |
| `transaction_type` | TEXT | `'increase'` or `'decrease'` |
| `description` | TEXT | Auto-generated (e.g., "Payment received - WIF-RCP-20260303-010") |
| `amount` | DECIMAL(15,2) | — |
| `balance_before` | DECIMAL(15,2) | Account balance before this transaction |
| `balance_after` | DECIMAL(15,2) | Account balance after |
| `metadata` | JSONB | `{"reversal": true, "original_transaction_id": "..."}` for reversals |
| `transaction_date` | TIMESTAMPTZ | — |

---

### 3.10 `document_counters` — Auto-Incrementing Numbers

Used internally by the `generate_document_number()` function.

| Column | Type | Description |
|---|---|---|
| `company_id` | UUID (FK) | — |
| `document_type` | TEXT | e.g., "receipt" |
| `date_key` | TEXT | e.g., "20260303" |
| `counter` | INTEGER | Current count for this type+date |

**Live data example:** receipt + 20260303 → counter 10 (meaning 10 receipts were created on March 3rd)

---

### 3.11 `users` — Application Users

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `company_id` | UUID (FK → companies) | — |
| `username` | TEXT (UNIQUE) | Login username |
| `email` | TEXT (UNIQUE) | — |
| `full_name` | TEXT | Display name |
| `password_hash` | TEXT | bcrypt hash (migrated from SHA-256) |
| `role` | TEXT | `'admin'`, `'manager'`, `'accountant'`, `'viewer'`, `'operations'` |
| `is_active` | BOOLEAN | — |
| `failed_login_attempts` | INTEGER | Resets on successful login |
| `locked_until` | TIMESTAMPTZ | NULL if not locked |
| `last_login` | TIMESTAMPTZ | — |
| `created_by` | UUID (FK → users) | Self-referential |
| `phone_number` | TEXT | For WhatsApp integration |

**Live users:**
| Username | Role | Active |
|---|---|---|
| admin | admin | yes |
| firdaus | admin | yes |
| wanaisyah | admin | yes |
| wanfarizal | manager | yes |
| enizureen | accountant | yes |
| apple_test | accountant | yes |
| amar | operations | yes |

---

### 3.12 `sessions` — Server-Side Session Tokens

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `user_id` | UUID (FK → users) | — |
| `token_hash` | TEXT (UNIQUE) | SHA-256 hash of the session token |
| `refresh_token_hash` | TEXT (UNIQUE) | SHA-256 hash of the refresh token |
| `device_info` | JSONB | `{userAgent, ip, deviceName}` |
| `last_activity` | TIMESTAMPTZ | Updated on each API call |
| `expires_at` | TIMESTAMPTZ | — |

**Security:** Plain tokens are NEVER stored in the database. Only SHA-256 hashes are stored. The plain token lives only in the user's `localStorage`.

---

### 3.13 `activity_logs` — Audit Trail

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID (FK → users) | Who did it |
| `company_id` | UUID (FK → companies) | — |
| `action` | TEXT | e.g., `'auth:login'`, `'document:created'` |
| `entity_type` | TEXT | e.g., `'document'`, `'account'` |
| `entity_id` | UUID | ID of the affected entity |
| `metadata` | JSONB | Extra details |
| `ip_address` | TEXT | — |
| `user_agent` | TEXT | — |

---

### 3.14 `bookings` — Trip Bookings

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | — |
| `company_id` | UUID (FK → companies) | — |
| `booking_code` | VARCHAR(50) UNIQUE | Auto-generated: `BK-2025-001` |
| `guest_name` | TEXT | — |
| `trip_start_date` / `trip_end_date` | DATE | — |
| `number_of_pax` | TEXT | — |
| `country` | TEXT | Default `'Japan'` |
| `car_types` | TEXT[] | Array of car types |
| **6 item arrays** | JSONB | `transportation_items`, `meals_items`, `entrance_items`, `tour_guide_items`, `flight_items`, `accommodation_items` |
| **6 category totals** | DECIMAL | Internal cost per category in JPY |
| **6 B2B category totals** | DECIMAL | B2B price per category in JPY |
| `grand_total_jpy` / `grand_total_myr` | DECIMAL | Grand totals |
| `grand_total_b2b_jpy` / `grand_total_b2b_myr` | DECIMAL | B2B grand totals |
| `exchange_rate` | DECIMAL(10,6) | Default 0.031 (JPY→MYR) |
| `wif_cost` / `b2b_price` / `expected_profit` | DECIMAL | Financial summary in MYR |
| `status` | TEXT | `'draft'`, `'planning'`, `'confirmed'`, `'in_progress'`, `'completed'`, `'cancelled'` |
| `is_active` | BOOLEAN | Soft delete toggle |

**Live data:** 2 bookings (BK-2025-001: ARBA Hilmi Salleh, BK-2025-002: ARBA Asmayuzi Ismail)

---

### 3.15 `rate_limits` — Brute-Force Protection

| Column | Type | Description |
|---|---|---|
| `identifier` | TEXT | IP address or user ID |
| `identifier_type` | TEXT | `'ip'` or `'user'` |
| `action` | TEXT | `'login'`, `'password_reset'`, `'api_request'` |
| `attempts` | INTEGER | Counter |
| `window_start` | TIMESTAMPTZ | Start of rate limit window |
| `blocked_until` | TIMESTAMPTZ | NULL if not blocked |

---

### 3.16 `invoice_payment_summary` (VIEW)

A database view that automatically calculates payment status for every invoice by aggregating linked receipts.

```sql
-- Simplified concept:
SELECT
  invoice_total,
  SUM(receipt_amounts) AS amount_paid,
  invoice_total - SUM(receipt_amounts) AS balance_due,
  CASE
    WHEN SUM(receipt_amounts) >= invoice_total THEN 'fully_paid'
    WHEN SUM(receipt_amounts) > 0 THEN 'partially_paid'
    ELSE 'unpaid'
  END AS payment_status
FROM invoices LEFT JOIN receipts ...
```

**Live examples:**
| Invoice | Customer | Total | Paid | Status |
|---|---|---|---|---|
| WIF250194 | Trip Kita En Fareez | 17,550 | 17,550 | fully_paid |
| WIF250172 | Aunty Liza | 9,300 | 4,000 | partially_paid |
| WIF260015 | UUM | 69,500 | 0 | unpaid |

---

## 4. Migration History — What Each Migration Does

Migrations are in `supabase/migrations/` and must be applied **in order** (001 → 026). Each file is a standalone SQL script.

### Quick Summary

| # | File | What It Does |
|---|---|---|
| 001 | `001_initial_schema.sql` | Creates 10 core tables, all triggers, document numbering, seed company |
| 002 | `002_add_users_table.sql` | Adds `users` + `activity_logs` tables, custom auth system |
| 003 | `003_add_sessions_table.sql` | Server-side sessions with token hashing |
| 004 | `004_add_cost_centers.sql` | Adds `cost_centers` table (later replaced by bookings) |
| 005 | `005_add_booking_forms.sql` | Adds `booking_forms` table (later renamed to bookings) |
| 006 | `006_link_documents_to_cost_centers.sql` | Adds `cost_center_id` to documents |
| 007 | `007_rename_cost_center_to_booking.sql` | Renames cost_center → booking throughout, drops old tables |
| 008 | `008_add_allow_negative_balance.sql` | Adds `allow_negative_balance` to companies, updates balance trigger |
| 009 | `009_add_transfer_proof.sql` | Adds transfer proof file columns to statements_of_payment |
| 010 | `010_soft_delete_balance_reversal.sql` | Adds trigger to reverse transactions when documents are soft-deleted |
| 011 | `011_add_performance_indexes.sql` | Adds 7 performance indexes for common queries |
| 012 | `012_fix_duplicate_transactions.sql` | Adds duplicate prevention guard to transaction trigger |
| 013 | `013_fix_receipt_transaction.sql` | Fixes receipt completed status handling |
| 014 | `014_cleanup_duplicate_transactions.sql` | One-time cleanup of existing duplicate transactions |
| 015 | `015_add_operations_role.sql` | Adds `'operations'` to user role check constraint |
| 016 | `016_add_storage_bucket.sql` | Creates `documents` storage bucket + storage path columns |
| 017 | `017_invoice_payment_tracking.sql` | Creates `invoice_payment_summary` view + helper functions |
| 018 | `018_add_payment_status_sync.sql` | Auto-sync invoice payment status when receipts change |
| 019 | `019_fix_missing_transactions.sql` | One-time fix: creates missing transactions + recalculates balances |
| 020 | `020_harden_rls_policies.sql` | Blocks anon access to sensitive tables |
| 021 | `021_add_rate_limiting.sql` | Adds `rate_limits` table + SECURITY DEFINER functions |
| 022 | `022_fix_document_number_rls.sql` | Fixes doc number generation to work with strict RLS |
| 023 | `023_add_phone_to_users.sql` | Adds discount support + `phone_number` column on users |
| 024 | `024_harden_rls_policies.sql` | Further hardens RLS (drops permissive policies, service_role only) |
| 025 | `025_fix_sessions_rls.sql` | Restricts session table to service_role only |
| 026 | `026_atomic_document_creation.sql` | Adds `create_full_document()` RPC for atomic document creation |

### Detailed Breakdown of Key Migrations

#### 001 — Initial Schema (The Foundation)

This is the largest migration. It creates:

**Tables:** `companies`, `accounts`, `documents`, `invoices`, `receipts`, `payment_vouchers`, `statements_of_payment`, `line_items`, `transactions`, `document_counters`

**Functions:**
- `update_updated_at_column()` — Trigger function that auto-sets `updated_at = NOW()` on every UPDATE
- `generate_document_number(company_id, document_type)` — Creates sequential numbers like `WIF-INV-20260303-001`
- `validate_payment_balance()` — Checks account has enough balance before completing a Statement of Payment
- `create_transaction_on_document_complete()` — When a receipt/SOP reaches `'completed'` status, creates a transaction and updates the account balance

**Triggers:** `update_*_updated_at` on all tables, `validate_payment_trigger`, `create_transaction_trigger`

**Seed:** Inserts the default company.

#### 010 — Soft Delete Balance Reversal

Adds a critical safety trigger: when a completed document is soft-deleted, the system **automatically reverses** the accounting transaction:

```
Document completed → Transaction created → Balance updated
Document deleted   → Reversal transaction created → Balance restored
```

The reversal transaction has metadata: `{"reversal": true, "original_transaction_id": "...", "reason": "document_deleted"}`

#### 017 + 018 — Invoice Payment Tracking

Creates an automatic system where:
1. Receipts can be linked to invoices via `linked_invoice_id`
2. A database VIEW aggregates all receipt amounts per invoice
3. A trigger automatically updates the invoice's status when receipts change:
   - All receipts sum ≥ invoice total → status becomes `'paid'`
   - Partial receipts → stays `'issued'`

#### 020, 024, 025 — RLS Hardening

Progressive security tightening:
- **020:** Blocks `anon` role from sensitive tables (users, sessions, activity_logs)
- **024:** Drops all remaining permissive policies, replaces with `service_role`-only policies
- **025:** Locks down sessions table completely to `service_role`

#### 026 — Atomic Document Creation

Creates `create_full_document(payload)` — a SECURITY DEFINER function that atomically:
1. Generates a document number
2. Inserts the `documents` row
3. Inserts the type-specific row (invoice/receipt/PV/SOP)
4. Inserts all line items
5. Returns the new `document_id`

All in one database transaction — if any step fails, everything rolls back.

---

## 5. Row Level Security (RLS) — Who Can Access What

### What is RLS?

RLS is PostgreSQL's built-in access control. It makes the database deny queries unless a policy allows them. Every table in this app has RLS enabled.

### Current Policy Strategy (After Migration 024+025)

```
┌─────────────────────────────────────────────────────┐
│                    RLS Model                         │
│                                                      │
│  anon role:                                          │
│    ├── companies: SELECT only (for setup check)      │
│    ├── bookings: Full access                         │
│    ├── storage.objects: Full access                  │
│    └── Everything else: BLOCKED                      │
│                                                      │
│  authenticated role:                                 │
│    ├── document_counters: Full access                │
│    ├── bookings: Full access                         │
│    └── Everything else: BLOCKED                      │
│                                                      │
│  service_role:                                       │
│    └── Everything: FULL ACCESS (bypasses RLS)        │
└─────────────────────────────────────────────────────┘
```

### Why service_role Only?

This app uses a **custom auth system** (not Supabase Auth). Since Supabase's built-in `auth.uid()` isn't populated, RLS policies can't check "which user is this?" at the database level. Instead:

1. The frontend authenticates users via the custom session system
2. All database operations use the `anon` key (which acts as `service_role` through PostgREST for most operations, since RLS policies are configured to allow this)
3. Authorization is enforced in the application layer (TypeScript services check permissions before making queries)

### Important: Why Bookings Have Permissive RLS

Bookings have `USING (true)` policies (anyone can CRUD). This was likely a pragmatic choice since the booking system was added later and the custom auth couldn't easily integrate with PostgreSQL-level RLS. **All authorization for bookings is handled in the frontend.**

---

## 6. Database Functions & Triggers — Automatic Business Logic

### Understanding Triggers

A trigger is code that runs automatically when you INSERT, UPDATE, or DELETE a row. You don't call triggers — they fire by themselves.

```
You run:  UPDATE documents SET status = 'completed' WHERE id = '...'
Trigger fires:  create_transaction_on_document_complete()
Result:  A new row appears in `transactions` and `accounts.current_balance` changes
```

### Trigger Map

```
┌─────────────────────────┐
│  documents table         │
│                          │
│  BEFORE UPDATE ──────────┤→ update_updated_at_column()     [sets updated_at]
│                          │→ validate_payment_balance()      [checks SOP has funds]
│                          │
│  AFTER INSERT/UPDATE ────┤→ create_transaction_trigger      [creates transaction
│  (of status column)      │   when status → 'completed']
│                          │
│  AFTER UPDATE ───────────┤→ reverse_transaction_on_delete   [reverses transaction
│  (of deleted_at column)  │   when document is soft-deleted]
│                          │
│  AFTER UPDATE ───────────┤→ sync_invoice_on_receipt_doc     [syncs invoice payment
│  (status/deleted_at      │   status when receipt changes]
│   WHERE type='receipt')  │
└──────────────────────────┘

┌─────────────────────────┐
│  receipts table          │
│                          │
│  AFTER INSERT/UPDATE/    │→ sync_invoice_payment_status()   [recalculates invoice
│  DELETE                  │   payment totals]
└──────────────────────────┘

┌─────────────────────────┐
│  bookings table          │
│                          │
│  BEFORE INSERT ──────────│→ set_booking_code()              [auto-generates
│                          │   BK-YYYY-NNN code]
└──────────────────────────┘

┌─────────────────────────┐
│  ALL tables              │
│                          │
│  BEFORE UPDATE ──────────│→ update_updated_at_column()      [sets updated_at]
└──────────────────────────┘
```

### Key Functions Explained

#### `generate_document_number(p_company_id, p_document_type)`

```
Input:  company UUID + "receipt"
Output: "WIF-RCP-20260303-010"
```

How it works:
1. Looks up today's date → `20260303`
2. Finds or creates a row in `document_counters` for this type+date
3. Atomically increments the counter (uses `ON CONFLICT ... DO UPDATE` for safety)
4. Returns `WIF-{PREFIX}-{DATE}-{COUNTER_PADDED}`

Prefixes: INV (invoice), RCP (receipt), PV (payment_voucher), SOP (statement_of_payment), CRF (customer_refund), VRF (vendor_refund), DOC (other)

**Important:** This function is `SECURITY DEFINER` (runs as the function owner, not the caller), so it can write to `document_counters` even though the calling user's RLS might block it.

#### `create_full_document(payload jsonb)`

The atomic document creation RPC. Payload structure:

```json
{
  "company_id": "c0000000-...",
  "document_type": "invoice",
  "document_date": "2026-03-03",
  "currency": "MYR",
  "country": "Malaysia",
  "amount": 1000.00,
  "status": "draft",
  "account_id": "bc1db44c-...",
  "type_specific": {
    "customer_name": "John Doe",
    "invoice_date": "2026-03-03",
    "due_date": "2026-04-03"
  },
  "line_items": [
    {"description": "Service", "quantity": 1, "unit_price": 1000, "amount": 1000}
  ]
}
```

#### `create_transaction_on_document_complete()`

Fires when `documents.status` changes to `'completed'`:

- **Receipt:** Creates an `increase` transaction on the linked account
- **Statement of Payment:** Creates a `decrease` transaction, uses `total_deducted` (not `amount`)
- **Duplicate guard:** Skips if a non-reversal transaction already exists for this document

#### `reverse_transaction_on_document_delete()`

Fires when `documents.deleted_at` is set (soft delete):
- Only acts if the document was `'completed'` and has a transaction
- Creates a new reversal transaction that restores the original balance
- Tags the reversal with `metadata: {"reversal": true, ...}`

---

## 7. Authentication System — Custom Auth (NOT Supabase Auth)

### Why Custom Auth?

This app does **NOT** use Supabase's built-in GoTrue auth system. Instead, it implements its own auth with:
- Password hashing (bcrypt)
- Server-side session tokens
- Account lockout after failed attempts
- Role-based access control

The `supabaseAuthService.ts` file exists but is **NOT USED** in production — it's reserved for a potential future migration.

### Login Flow

```
User enters username + password
         │
         ▼
┌─────────────────────────────┐
│ 1. Find user by username     │  userService.getUserByUsername()
│    or email (case-insensitive│  → SELECT * FROM users WHERE username ILIKE ?
│    )                         │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Check account lockout     │  Is locked_until > now()?
│    (5 failed attempts =      │  If yes → return ACCOUNT_LOCKED
│     30 min lockout)          │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. Check is_active           │  If false → return ACCOUNT_INACTIVE
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 4. Verify password           │  verifyPasswordAuto(password, hash)
│    (auto-detects bcrypt vs   │  - If bcrypt hash → bcrypt.compare()
│     legacy SHA-256)          │  - If SHA-256 hash → compare, then
│                              │    auto-migrate to bcrypt
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 5. Create server session     │  sessionService.createSession()
│    - Generate random token   │  - crypto.randomUUID() x2
│    - Hash with SHA-256       │  - Store hash in sessions table
│    - Store hash in DB        │  - Plain token → localStorage
│    - Return plain token      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 6. Save to localStorage      │  Key: 'wif_auth_session'
│    - PublicUser data         │  Value: { user, token,
│    - Token + refresh token   │   expiresAt, rememberMe,
│    - Expiry time             │   refreshToken }
└─────────────────────────────┘
```

### Session Lifecycle

| Event | Duration |
|---|---|
| Access token expires | 1 hour |
| Refresh token expires | 7 days (or 30 days with "remember me") |
| Refresh grace period | 5 minutes before expiry |
| Session validation interval | Every 5 minutes (via React effect) |
| Activity tracking | On every click/keypress |

### Token Rotation

When a session is about to expire:
1. Frontend sends the `refreshToken`
2. Backend finds the session by `refresh_token_hash`
3. **Old session is deleted** (single-use)
4. **New session is created** with new tokens
5. Frontend receives new `token` + `refreshToken`

This means stolen refresh tokens can only be used once — if the legitimate user refreshes first, the attacker's token is invalid.

### Roles & Permissions

```
viewer       →  Can view documents, accounts, bookings. Can print.
accountant   →  All viewer + create/edit documents, accounts, bookings
manager      →  All accountant + delete, approve, export
admin        →  All manager + user management, system settings, audit logs
operations   →  View/create/edit payment vouchers only, plus bookings
```

**File:** `types/auth.ts` — Contains the complete `ROLE_PERMISSIONS` mapping.

**Frontend enforcement:** `services/userService.ts` has `hasPermission(user, 'documents:create')` checks. These run before any Supabase query.

---

## 8. Frontend ↔ Supabase Integration

### Service Layer Architecture

```
React Components
    │
    ▼
services/supabaseService.ts    ← Documents, Accounts, Transactions
services/bookingService.ts     ← Bookings
services/userService.ts        ← User CRUD
services/sessionService.ts     ← Sessions
services/authService.ts        ← Login/Logout orchestration
services/storageService.ts     ← File uploads
services/activityLogService.ts ← Audit logging
    │
    ▼
lib/supabase.ts  ← Single Supabase client instance
    │
    ▼
Supabase Cloud (PostgreSQL)
```

### Common Query Patterns

#### Fetching Documents with Joins

```typescript
// services/supabaseService.ts
const { data, error } = await supabase
  .from('documents')
  .select(`
    *,
    line_items(*),
    invoices(*),
    receipts(*),
    payment_vouchers(*),
    statements_of_payment(*)
  `)
  .eq('company_id', companyId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

This single query returns a document with ALL its related data — line items and the type-specific record (invoice/receipt/PV/SOP). Supabase handles the JOINs.

#### Paginated Queries

```typescript
const { data, error, count } = await supabase
  .from('documents')
  .select('id, document_type, document_number, status, ...', { count: 'exact' })
  .eq('company_id', companyId)
  .is('deleted_at', null)
  .range(from, to);  // e.g., range(0, 24) for first 25 items
```

The `count: 'exact'` option returns the total count alongside paginated results.

#### Atomic Document Creation (RPC)

```typescript
const { data, error } = await supabase.rpc('create_full_document', {
  payload: {
    company_id: companyId,
    document_type: 'invoice',
    document_date: '2026-03-03',
    // ... all fields
    type_specific: { customer_name: 'John', ... },
    line_items: [{ description: 'Service', ... }]
  }
});
// data = document_id (UUID string)
```

#### Soft Deletes

```typescript
// NOT a real delete — sets deleted_at timestamp
await supabase
  .from('documents')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', documentId)
  .eq('company_id', companyId);
```

All queries that read documents filter with `.is('deleted_at', null)` to exclude soft-deleted records.

### Tables Accessed by Each Service

| Service File | Tables | Operations |
|---|---|---|
| `supabaseService.ts` | documents, invoices, receipts, payment_vouchers, statements_of_payment, line_items, transactions, accounts, companies, invoice_payment_summary | Read, Insert, Update, Soft Delete |
| `bookingService.ts` | bookings | CRUD + soft delete |
| `userService.ts` | users, companies | CRUD + hard delete |
| `sessionService.ts` | sessions | Create, Validate, Delete |
| `storageService.ts` | storage.objects (documents bucket) | Upload, Download, Delete |
| `activityLogService.ts` | activity_logs, users | Insert (log), Read (user company) |

---

## 9. Document Lifecycle — From Creation to Accounting

### The Full Journey of a Receipt

```
1. User clicks "Create Receipt"
   │
   ▼
2. Frontend calls supabase.rpc('create_full_document', {...})
   │  → DB generates document number (WIF-RCP-20260303-011)
   │  → DB inserts documents row (status: 'draft')
   │  → DB inserts receipts row
   │  → DB inserts line_items rows
   │
   ▼
3. User fills in details, clicks "Save"
   │  → Frontend updates documents + receipts rows
   │
   ▼
4. User changes status to "Issued"
   │  → UPDATE documents SET status = 'issued'
   │  → validate_document_status_transition() trigger checks: draft → issued ✓
   │
   ▼
5. User changes status to "Completed"
   │  → UPDATE documents SET status = 'completed'
   │  → create_transaction_on_document_complete() trigger fires:
   │     ├── Creates transaction: type='increase', amount=17900
   │     ├── Updates accounts.current_balance += 17900
   │     └── balance_before=190315.40, balance_after=208215.40
   │
   ▼
6. If receipt is linked to an invoice:
   │  → sync_invoice_payment_status() trigger fires:
   │     ├── Sums all completed receipts for that invoice
   │     ├── If sum >= invoice total → invoice status = 'paid'
   │     └── If sum < invoice total → invoice stays 'issued'
   │
   ▼
7. If user soft-deletes the receipt later:
      → reverse_transaction_on_document_delete() trigger fires:
         ├── Creates reversal transaction: metadata.reversal = true
         └── Restores accounts.current_balance to previous value
```

### Status State Machine

```
         ┌──────────────────────────────────────┐
         │                                      │
    ┌────▼────┐    ┌────────┐    ┌──────┐    ┌──────────┐
    │  draft  │───▶│ issued │───▶│ paid │───▶│completed │
    └────┬────┘    └───┬────┘    └──┬───┘    └──────────┘
         │             │            │
         │             │            │
         ▼             ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │cancelled │  │cancelled │  │cancelled │
    └──────────┘  └──────────┘  └──────────┘

Special: paid → issued (allowed when receipts are removed from invoice)
```

### Document Number Format

```
WIF-{PREFIX}-{YYYYMMDD}-{NNN}

Examples:
  WIF-INV-20260303-001    (1st invoice on March 3)
  WIF-RCP-20260303-010    (10th receipt on March 3)
  WIF-PV-20260302-001     (1st payment voucher on March 2)
  WIF-SOP-20260301-003    (3rd statement of payment on March 1)
```

Booking codes use a different format: `BK-{YYYY}-{NNN}` (e.g., `BK-2025-001`)

---

## 10. Booking System

### How Bookings Work

Bookings represent **trip packages** sold to customers. Each booking tracks:
- Trip details (guest, dates, pax, country)
- 6 cost categories (transportation, meals, entrance, tour guide, flights, accommodation)
- Each category has an array of line items in JSONB
- Internal costs (JPY) vs B2B selling prices (JPY)
- Exchange rate conversion to MYR
- Profit calculation

### Booking ↔ Document Link

Documents can be linked to bookings via `documents.booking_id`. This is a **soft reference** — the link is informational, not a hard constraint. You can:
- Link a document: `UPDATE documents SET booking_id = ? WHERE id = ?`
- Unlink a document: `UPDATE documents SET booking_id = NULL WHERE id = ?`

### JSONB Item Structure (per category)

```json
{
  "transportation_items": [
    {
      "date": "2025-03-15",
      "description": "Shinkansen Tokyo-Osaka",
      "quantity": 4,
      "internalPrice": 14000,
      "b2bPrice": 16000,
      "internalTotal": 56000,
      "b2bTotal": 64000,
      "profit": 8000,
      "notes": ""
    }
  ],
  "transportation_total": 56000,
  "transportation_b2b_total": 64000
}
```

---

## 11. Storage — File Uploads

### Bucket: `documents`

**Created in:** Migration 016
**Config:** Private, 5MB max, JPEG/PNG/WebP/PDF only

### File Path Convention

```
{document_type}/{document_id}/{timestamp}_{sanitized_filename}

Example:
payment_voucher/abc123-def456/1709470000000_bank_receipt.pdf
```

### Service: `services/storageService.ts`

| Method | What It Does |
|---|---|
| `uploadFile(docType, docId, file)` | Uploads to Supabase Storage |
| `getFileUrl(path)` | Returns 1-hour signed URL |
| `deleteFile(path)` | Deletes single file |
| `deleteDocumentFiles(docType, docId)` | Deletes all files for a document |
| `fileExists(path)` | Checks if file exists |

### Usage

Payment vouchers and statements of payment can have supporting documents attached. The storage path is saved in `payment_vouchers.supporting_doc_storage_path` or `statements_of_payment.transfer_proof_storage_path`.

---

## 12. TypeScript Types — Database ↔ Frontend Mapping

### File Locations

| File | Contents |
|---|---|
| `types/database.ts` | Supabase-generated types (Row/Insert/Update shapes) |
| `types/document.ts` | Frontend document interfaces |
| `types/account.ts` | Frontend account interfaces |
| `types/booking.ts` | Frontend booking interfaces |
| `types/auth.ts` | User roles, permissions, session types |
| `types/transaction.ts` | Transaction types |
| `types/storage.ts` | Storage file types |

### Naming Convention

Database uses `snake_case`. Frontend uses `camelCase`. Each service handles the mapping:

```typescript
// In userService.ts
function dbUserToUser(dbUser: any): User {
  return {
    id: dbUser.id,
    companyId: dbUser.company_id,        // snake → camel
    username: dbUser.username,
    fullName: dbUser.full_name,          // snake → camel
    passwordHash: dbUser.password_hash,  // snake → camel
    isActive: dbUser.is_active,          // snake → camel
    failedLoginAttempts: dbUser.failed_login_attempts,
    // ...
  };
}
```

### Key Type Definitions

```typescript
// types/auth.ts
type UserRole = 'viewer' | 'accountant' | 'manager' | 'admin' | 'operations';

// types/document.ts
type DocumentType = 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment';
type DocumentStatus = 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled';
type Currency = 'MYR' | 'JPY';
type Country = 'Malaysia' | 'Japan';

// types/account.ts
type AccountType = 'main_bank' | 'petty_cash';

// types/booking.ts
type BookingStatus = 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
```

---

## 13. Rate Limiting

### How It Works

Rate limiting is implemented entirely in the database using `SECURITY DEFINER` functions:

```typescript
// Frontend calls this RPC
const result = await supabase.rpc('check_rate_limit', {
  p_identifier: ipAddress,
  p_identifier_type: 'ip',
  p_action: 'login',
  p_max_attempts: 10,
  p_window_seconds: 900  // 15 minutes
});

// Returns:
// { allowed: true, remaining: 8, reset_at: "2026-03-03T12:15:00Z", blocked: false }
// OR
// { allowed: false, remaining: 0, reset_at: "2026-03-03T12:15:00Z", blocked: true }
```

### Rate Limit Functions

| Function | Purpose |
|---|---|
| `check_rate_limit(identifier, type, action, max, window)` | Check + increment counter |
| `reset_rate_limit(identifier, type, action)` | Manually reset (e.g., after successful login) |
| `cleanup_rate_limits(retention_hours)` | Delete old records (default: 24 hours) |
| `get_rate_limit_status(identifier, type, action)` | Read-only check (no increment) |

All four functions are `SECURITY DEFINER` — they run with elevated permissions regardless of the caller's RLS restrictions.

---

## 14. Common Patterns & Gotchas

### Pattern: Soft Deletes

Most tables use `deleted_at TIMESTAMPTZ` instead of hard DELETE:
- **documents:** `deleted_at` + triggers reverse accounting
- **accounts:** `deleted_at`
- **bookings:** `is_active = false` (slightly different pattern)

**Always filter:** Every SELECT query must include `.is('deleted_at', null)` to hide deleted records.

### Pattern: Line Item Re-insertion

When updating a document's line items, the frontend:
1. **Deletes ALL existing line items** for the document
2. **Inserts ALL new line items** fresh

This avoids complex diffing logic. It's safe because line items are always replaced as a set.

### Pattern: JSONB for Flexibility

Booking items are stored as JSONB arrays (not in separate tables). This allows:
- Flexible item structures per category
- No complex JOINs for booking details
- Easy addition of new item fields without migrations

### Gotcha: `current_balance` is Trigger-Maintained

**NEVER directly update `accounts.current_balance`**. It's maintained by database triggers:
- Completing a receipt → balance increases
- Completing a SOP → balance decreases
- Soft-deleting a completed document → balance reverses

If you need to fix a balance, you must trace through the transactions and fix the root cause.

### Gotcha: Document Number Generation

Document numbers are generated **server-side** via `generate_document_number()` RPC. The frontend also has a fallback `DocumentNumberService` that generates numbers client-side, but the RPC is preferred for atomicity.

### Gotcha: The `create_full_document` RPC vs Individual Inserts

Old pattern (still in some code paths):
```typescript
// 3 separate queries — NOT atomic
await supabase.from('documents').insert({...});
await supabase.from('invoices').insert({...});
await supabase.from('line_items').insert([...]);
```

New pattern (migration 026):
```typescript
// 1 RPC call — fully atomic
await supabase.rpc('create_full_document', { payload: {...} });
```

Always prefer the RPC for new document creation.

### Gotcha: Legacy SHA-256 Passwords

Some users may still have SHA-256 password hashes (64-character hex strings). The login flow auto-detects these and migrates to bcrypt on next successful login. You don't need to handle this manually.

### Gotcha: `supabaseAuthService.ts` Is NOT Active

This file exists but references a `user_profiles` table that **doesn't exist**. It's a placeholder for a future migration to Supabase's native auth. The active auth system is in `authService.ts` + `sessionService.ts` + `userService.ts`.

---

## 15. Rollback Files

**Location:** `supabase/rollbacks/`

| File | What It Undoes | When to Use |
|---|---|---|
| `024_harden_rls_policies_rollback.sql` | Restores permissive RLS policies from before 024 | **DANGEROUS** — only if 024 breaks something |
| `025_fix_sessions_rls_rollback.sql` | Restores flawed session policies from before 025 | **DANGEROUS** — re-opens security hole |

**Warning:** These rollbacks **weaken security**. Only use them if a migration causes a production outage and you need to restore access while debugging.

---

## 16. Live Database Quick Reference

### Current Production Stats (2026-03-03)

| Table | Row Count | Notes |
|---|---|---|
| companies | 1 | WIF SERVICES |
| accounts | 2 | 1 bank (MYR), 1 petty cash (JPY) |
| documents | 317 | 118 PV, 92 SOP, 59 INV, 48 RCP |
| users | 7 | 3 admin, 1 manager, 2 accountant, 1 operations |
| bookings | 2 | Both draft status |
| rate_limits | 0 | Clean (auto-cleaned) |
| activity_logs | 0 | (via anon key — may need service_role to read) |

### Document Status Breakdown

| Status | Count |
|---|---|
| issued | 147 |
| completed | 140 |
| paid | 30 |

### Account Balances

| Account | Currency | Balance |
|---|---|---|
| WIF JAPAN SDN BHD (main_bank) | MYR | 208,215.40 |
| WIF x Firdaus (petty_cash) | JPY | -672,210.00 |

### Recent Transactions

```
+17,900.00 MYR  Payment received - WIF-RCP-20260303-010
+14,000.00 MYR  Payment received - WIF-RCP-20260303-009
+10,336.00 MYR  Payment received - WIF-RCP-20260303-008
 +6,579.00 MYR  Payment received - WIF-RCP-20260303-007
+30,912.80 MYR  Payment received - WIF-RCP-20260303-006
```

### Invoice Payment Statuses (Sample)

| Invoice | Customer | Total | Paid | Status |
|---|---|---|---|---|
| WIF250194 | Trip Kita En Fareez | 17,550 | 17,550 | fully_paid |
| WIF250172 | Aunty Liza | 9,300 | 4,000 | partially_paid |
| WIF260015 | UUM | 69,500 | 0 | unpaid |

### Querying Production via REST API

```bash
# Set up (from .env.production)
export URL="https://fthkayaprkicvzgqeipq.supabase.co"
export KEY="eyJhbGci..."  # anon key

# List all accounts
curl -s "$URL/rest/v1/accounts?select=name,type,currency,current_balance&deleted_at=is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Count documents by type
curl -s "$URL/rest/v1/documents?select=document_type&deleted_at=is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Check invoice payment status
curl -s "$URL/rest/v1/invoice_payment_summary?select=document_number,payment_status&limit=5" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### Supabase Dashboard

Open: `https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq`

From the dashboard you can:
- Run SQL directly (SQL Editor)
- Browse tables (Table Editor)
- View storage files
- Check RLS policies
- Monitor API usage

---

## Appendix: Entity Relationship Diagram

```
                        ┌──────────────┐
                        │  companies   │
                        └──────┬───────┘
                               │ 1:N
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌─────▼─────┐  ┌───────▼───────┐
       │   accounts  │  │   users   │  │   bookings    │
       └──────┬──────┘  └─────┬─────┘  └───────┬───────┘
              │               │                 │
              │          ┌────▼────┐            │ (soft link via
              │          │sessions │            │  documents.booking_id)
              │          └─────────┘            │
              │                                 │
       ┌──────▼──────────────────────────────────▼──┐
       │                documents                    │
       │  (polymorphic: type determines child table) │
       └──┬──────┬──────────┬──────────┬────────────┘
          │      │          │          │
    ┌─────▼──┐ ┌─▼────┐ ┌──▼────┐ ┌───▼──────────────┐
    │invoices│ │rcpts │ │  PVs  │ │      SOPs         │
    └────────┘ └──┬───┘ └───────┘ └───────────────────┘
                  │
           linked_invoice_id
           (receipt → invoice)

       ┌──────────────┐     ┌──────────────────┐
       │  line_items   │     │   transactions   │
       │ (per document)│     │ (auto by trigger)│
       └──────────────┘     └──────────────────┘

       ┌──────────────────┐  ┌──────────────┐
       │  activity_logs    │  │ rate_limits  │
       └──────────────────┘  └──────────────┘

       ┌──────────────────────────┐
       │  document_counters       │
       │  (auto-increment tracker)│
       └──────────────────────────┘
```

---

*This guide was generated from all 26 migration files, 8 frontend service files, 6 type definition files, and live production database queries on 2026-03-03.*
