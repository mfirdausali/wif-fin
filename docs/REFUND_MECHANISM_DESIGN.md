# Refund Mechanism Design Document

**Created:** 2025-12-05
**Status:** Pending Implementation
**Conversation:** Refund

---

## Executive Summary

This document outlines the design for implementing refund functionality in the WIF Finance system (web and mobile apps). The system will support two new document types: Customer Refunds and Vendor Refunds.

---

## Current System Flow

```
MONEY IN:  Invoice (doc only) → Receipt (completed) → Account Balance ↑
MONEY OUT: Payment Voucher (authorization) → Statement of Payment (completed) → Account Balance ↓
```

---

## Proposed Refund Types

### 1. Customer Refund (`customer_refund`)

**Scenario:** Customer paid via Receipt, now needs money back

**Key Fields:**
- `linkedReceiptId` - Original receipt being refunded (required)
- `linkedReceiptNumber` - For display
- `linkedInvoiceId` - Optional, for context
- `refundDate` - Date of refund
- `refundReason` - Why refund is needed (required for audit)
- `refundMethod` - bank_transfer, cash, credit_note
- `customerName` - Copied from original receipt
- `customerBankAccount` - For bank transfer refunds
- `customerBankName` - Bank name
- `originalAmount` - Amount from original receipt
- `refundAmount` - Can be partial or full
- `processedBy` - Who created the refund
- `approvedBy` - Manager/admin approval required
- `approvalDate` - When approved
- `refundProofFilename` - Supporting document
- `refundProofStoragePath` - Storage location

**Status Flow:** `draft` → `issued` → `paid` → `completed` → `cancelled`

**Ledger Impact:** Account balance **DECREASES** when status = `completed`

**Document Number Format:** `CRF-YYYY-NNNN` (e.g., CRF-2024-0001)

---

### 2. Vendor Refund (`vendor_refund`)

**Scenario:** Paid vendor via SOP, vendor returns money

**Key Fields:**
- `linkedStatementId` - Original SOP being refunded (required)
- `linkedStatementNumber` - For display
- `linkedVoucherId` - Optional, for context
- `refundDate` - Date refund received
- `refundReason` - Why vendor is refunding
- `refundMethod` - bank_transfer, cash, credit_note
- `vendorName` - Copied from original SOP
- `vendorContact` - Optional
- `originalAmount` - Amount from original SOP
- `refundAmount` - Can be partial or full
- `receivedBy` - Who received the refund
- `verifiedBy` - Verification that funds received
- `verificationDate` - When verified
- `refundProofFilename` - Supporting document
- `refundProofStoragePath` - Storage location

**Status Flow:** `draft` → `issued` → `paid` → `completed` → `cancelled`

**Ledger Impact:** Account balance **INCREASES** when status = `completed`

**Document Number Format:** `VRF-YYYY-NNNN` (e.g., VRF-2024-0001)

---

## Validation Rules

1. `refundAmount` must be > 0
2. `refundAmount` must be ≤ `originalAmount`
3. Total refunds for a document cannot exceed original amount (supports multiple partial refunds)
4. Refund currency must match original document currency
5. Refund account must match original document account
6. Original document must have `status = 'completed'`
7. `refundReason` is mandatory (audit trail)
8. Customer refunds require manager/admin approval
9. Vendor refunds require verification

---

## Database Schema

### New Tables

```sql
-- Customer Refunds
CREATE TABLE customer_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    linked_receipt_id UUID NOT NULL REFERENCES documents(id),
    linked_invoice_id UUID REFERENCES documents(id),
    refund_date DATE NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_method TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_contact TEXT,
    customer_bank_account TEXT,
    customer_bank_name TEXT,
    original_amount DECIMAL(15,2) NOT NULL,
    refund_amount DECIMAL(15,2) NOT NULL,
    processed_by TEXT NOT NULL,
    approved_by TEXT,
    approval_date DATE,
    refund_proof_filename TEXT,
    refund_proof_storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_refund_amount CHECK (refund_amount > 0 AND refund_amount <= original_amount)
);

-- Vendor Refunds
CREATE TABLE vendor_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    linked_statement_id UUID NOT NULL REFERENCES documents(id),
    linked_voucher_id UUID REFERENCES documents(id),
    refund_date DATE NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_method TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    vendor_contact TEXT,
    original_amount DECIMAL(15,2) NOT NULL,
    refund_amount DECIMAL(15,2) NOT NULL,
    received_by TEXT NOT NULL,
    verified_by TEXT,
    verification_date DATE,
    refund_proof_filename TEXT,
    refund_proof_storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_refund_amount CHECK (refund_amount > 0 AND refund_amount <= original_amount)
);

-- Indexes
CREATE INDEX idx_customer_refunds_receipt ON customer_refunds(linked_receipt_id);
CREATE INDEX idx_customer_refunds_invoice ON customer_refunds(linked_invoice_id);
CREATE INDEX idx_vendor_refunds_statement ON vendor_refunds(linked_statement_id);
CREATE INDEX idx_vendor_refunds_voucher ON vendor_refunds(linked_voucher_id);
```

### Update document_type constraint

```sql
ALTER TABLE documents DROP CONSTRAINT documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN ('invoice', 'receipt', 'payment_voucher',
                           'statement_of_payment', 'customer_refund', 'vendor_refund'));
```

### Update balance trigger

Extend `create_transaction_on_document_complete()` to handle:
- `customer_refund` → DECREASE balance (using `refund_amount`)
- `vendor_refund` → INCREASE balance (using `refund_amount`)

---

## Booking Integration

When a booking is cancelled:
1. Check if Invoice/Receipt exists for that booking
2. If Receipt is `completed`, optionally create Customer Refund
3. Apply refund policy based on cancellation terms:
   - Full refund
   - Partial refund (percentage)
   - No refund

---

## Implementation Scope

| Component | Files to Modify/Create |
|-----------|----------------------|
| Database | New migration file |
| Web Types | `/wif-fin/types/document.ts` |
| Mobile Types | `/wif-fin-mobile-app/wif-finance/src/types/document.ts` |
| Web Service | `/wif-fin/services/supabaseService.ts` |
| Mobile Service | `/wif-fin-mobile-app/wif-finance/src/services/documents/documentService.ts` |
| Web UI | New CustomerRefundForm, VendorRefundForm components |
| Mobile UI | New refund form screens |
| Permissions | `/wif-fin/utils/permissions.ts` |
| Activity Types | Add refund activity types |
| PDF Generation | Add refund document templates |

---

## Permissions

| Role | Customer Refund | Vendor Refund |
|------|-----------------|---------------|
| admin | Full access + approve | Full access + verify |
| manager | Create/read/update + approve | Create/read/update + verify |
| accountant | Create/read/update | Create/read/update |
| operations | No access | No access |
| viewer | Read only | Read only |

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Database schema | 1-2 days |
| Type system | 1 day |
| Backend services | 2-3 days |
| Web UI | 2-3 days |
| Mobile UI | 2-3 days |
| Testing | 2 days |
| Deployment | 1 day |
| **Total** | **11-15 days** |

---

## Future Enhancements (Optional)

1. **Credit Notes** - Instead of cash refund, issue credit for future use
2. **Refund Reversals** - Reverse an incorrectly issued refund
3. **Automated Refund Calculation** - Based on cancellation policy
4. **Refund Payment Tracking** - Track if refund has been paid to customer

---

## Next Steps

1. Review and approve this design
2. Create database migration
3. Implement TypeScript types
4. Build backend services
5. Create UI components
6. Test thoroughly
7. Deploy to production

---

## References

- Current document types: `/wif-fin/types/document.ts`
- Account system: `/wif-fin/types/account.ts`
- Transaction system: `/wif-fin/types/transaction.ts`
- Booking system: `/wif-fin/types/booking.ts`
- Database triggers: `/wif-fin/supabase/migrations/`
