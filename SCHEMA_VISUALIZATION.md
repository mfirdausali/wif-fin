# Database Schema - Visual Overview

## Simplified Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WIF FINANCIAL SYSTEM                              │
│                         Database Schema Architecture                         │
└─────────────────────────────────────────────────────────────────────────────┘


┌──────────────────┐
│    COMPANIES     │
│ ──────────────── │
│ • id (PK)        │───────┐
│ • name           │       │
│ • address        │       │  One company has many...
│ • registration_no│       │
└──────────────────┘       │
                           │
         ┌─────────────────┼─────────────────┬──────────────────┐
         │                 │                 │                  │
         ▼                 ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│    ACCOUNTS      │ │  DOCUMENTS   │ │   COUNTERS   │ │   (Future: Users)│
│ ──────────────── │ │ ──────────── │ │ ──────────── │ └──────────────────┘
│ • id (PK)        │ │ • id (PK)    │ │ • company_id │
│ • company_id (FK)│ │ • company_id │ │ • doc_type   │
│ • name           │ │ • account_id │ │ • date_key   │
│ • type           │ │ • doc_type   │ │ • counter    │
│ • currency       │ │ • doc_number │ └──────────────┘
│ • initial_bal    │ │ • status     │
│ • current_bal    │ │ • amount     │
└────────┬─────────┘ └──────┬───────┘
         │                  │
         │    ┌─────────────┴───────┬─────────────┬──────────────┐
         │    │                     │             │              │
         │    ▼                     ▼             ▼              ▼
         │ ┌─────────┐      ┌──────────┐   ┌──────────┐  ┌─────────┐
         │ │INVOICES │      │ RECEIPTS │   │ VOUCHERS │  │   SOP   │
         │ │────────│◄──┐  │──────────│   │──────────│  │─────────│
         │ │• doc_id│   │  │• doc_id  │   │• doc_id  │  │• doc_id │
         │ │        │   │  │• invoice_│   │• payee   │  │• voucher│
         │ └─────────┘   │  │  id (FK) │   │• approval│  │  _id(FK)│
         │               │  └──────────┘   └──────────┘  │• tx_fee │
         │               │                               └─────────┘
         │               │  Links invoice                     ▲
         │               │  to receipt                        │
         │               └────────────────────────────────────┘
         │                     Links voucher to statement
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│  TRANSACTIONS    │◄────────│   LINE_ITEMS     │
│ ──────────────── │         │ ──────────────── │
│ • id (PK)        │         │ • id (PK)        │
│ • account_id (FK)│         │ • document_id(FK)│
│ • document_id(FK)│         │ • description    │
│ • type           │         │ • quantity       │
│ • amount         │         │ • unit_price     │
│ • balance_before │         │ • amount         │
│ • balance_after  │         └──────────────────┘
└──────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                          DATA FLOW VISUALIZATION
═══════════════════════════════════════════════════════════════════════════════

INCOME FLOW (Money In):
════════════════════════

   1. Create Invoice                2. Issue Invoice           3. Receive Payment
   ┌─────────────┐                 ┌─────────────┐            ┌─────────────┐
   │  INVOICE    │                 │  INVOICE    │            │   RECEIPT   │
   │ ─────────── │                 │ ─────────── │            │ ─────────── │
   │ Status:     │  Approve        │ Status:     │  Payment   │ Status:     │
   │   DRAFT     │ ────────────>   │   ISSUED    │ ────────>  │  COMPLETED  │
   └─────────────┘                 └─────────────┘            └──────┬──────┘
                                                                      │
                                                                      │ Creates
                                                                      ▼
                                                            ┌──────────────────┐
                                                            │  TRANSACTION     │
                                                            │  Type: INCREASE  │
                                                            │  Account: +$$$   │
                                                            └──────────────────┘


EXPENSE FLOW (Money Out):
═════════════════════════

   1. Create Voucher              2. Approve Voucher          3. Make Payment
   ┌─────────────┐                ┌─────────────┐             ┌─────────────┐
   │   VOUCHER   │                │   VOUCHER   │             │     SOP     │
   │ ─────────── │                │ ─────────── │             │ ─────────── │
   │ Status:     │  Approval      │ Status:     │  Payment    │ Status:     │
   │   DRAFT     │ ────────────>  │   ISSUED    │ ─────────>  │  COMPLETED  │
   │ Approved:   │                │ Approved:   │             │ + Proof     │
   │   NULL      │                │   ✓ Name    │             │ + Tx Ref    │
   └─────────────┘                └─────────────┘             └──────┬──────┘
                                                                      │
                                                                      │ Creates
                                                                      ▼
                                                            ┌──────────────────┐
                                                            │  TRANSACTION     │
                                                            │  Type: DECREASE  │
                                                            │  Account: -$$$   │
                                                            │  - Tx Fee        │
                                                            └──────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                          ACCOUNT BALANCE CALCULATION
═══════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────┐
│                         ACCOUNT LEDGER                                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Opening Balance (Nov 1)                         MYR 20,000.00        │
│                                                                        │
│  + Receipt #001 (Nov 5)                         + MYR  1,653.60       │
│  - Payment #001 (Nov 10)                        - MYR    980.00       │
│    └─ Voucher Amount: MYR 950.00                                      │
│    └─ Transaction Fee: MYR  30.00 (Wire Transfer)                     │
│                                                   ─────────────        │
│  Closing Balance (Nov 13)                        MYR 20,673.60        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Formula: Current Balance = Initial + Σ(Receipts) - Σ(Payments + Fees)


═══════════════════════════════════════════════════════════════════════════════
                          KEY RELATIONSHIPS
═══════════════════════════════════════════════════════════════════════════════

1. COMPANY ─┬─> ACCOUNTS (1:many)
            ├─> DOCUMENTS (1:many)
            └─> COUNTERS (1:many)

2. ACCOUNT ──> TRANSACTIONS (1:many)

3. DOCUMENT ─┬─> LINE_ITEMS (1:many)
             ├─> TRANSACTIONS (1:many)
             └─> TYPE_SPECIFIC_TABLE (1:1)

4. INVOICE ──> RECEIPT (1:1, optional)

5. VOUCHER ──> STATEMENT_OF_PAYMENT (1:1, required)

6. DOCUMENT + ACCOUNT ──> TRANSACTION (automatic on completion)


═══════════════════════════════════════════════════════════════════════════════
                          TABLE SIZE ESTIMATES
═══════════════════════════════════════════════════════════════════════════════

Estimated rows after 1 year of operation:

┌────────────────────────┬──────────────┬─────────────────────────────────┐
│ Table                  │ Est. Rows    │ Notes                           │
├────────────────────────┼──────────────┼─────────────────────────────────┤
│ companies              │ 1            │ Single company                  │
│ accounts               │ 10           │ Multiple bank/petty cash        │
│ documents              │ 2,000        │ ~40 documents/week              │
│ invoices               │ 500          │ ~25% of documents               │
│ receipts               │ 500          │ ~25% of documents               │
│ payment_vouchers       │ 500          │ ~25% of documents               │
│ statements_of_payment  │ 500          │ ~25% of documents               │
│ line_items             │ 5,000        │ Avg 2.5 items/doc               │
│ transactions           │ 1,000        │ Only completed docs             │
│ document_counters      │ 1,460        │ 4 types × 365 days              │
└────────────────────────┴──────────────┴─────────────────────────────────┘

Total estimated storage: < 50 MB (text data only, excluding attachments)


═══════════════════════════════════════════════════════════════════════════════
                          QUERIES EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

1. Get account balance sheet:
   SELECT * FROM transactions WHERE account_id = $1 ORDER BY transaction_date;

2. Get all unpaid invoices:
   SELECT i.*, d.* FROM invoices i
   JOIN documents d ON i.document_id = d.id
   WHERE d.status != 'paid' AND d.deleted_at IS NULL;

3. Get monthly expense summary:
   SELECT DATE_TRUNC('month', document_date) as month,
          SUM(total_deducted) as total_expenses
   FROM statements_of_payment sop
   JOIN documents d ON sop.document_id = d.id
   WHERE d.status = 'completed'
   GROUP BY month;

4. Get account running balance:
   SELECT account_id, transaction_date, description,
          amount, balance_after
   FROM transactions
   WHERE account_id = $1
   ORDER BY transaction_date DESC;


═══════════════════════════════════════════════════════════════════════════════
