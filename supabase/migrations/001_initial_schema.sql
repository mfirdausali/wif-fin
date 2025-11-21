-- ============================================================================
-- WIF Finance - Initial Database Schema
-- Migration: 001
-- Description: Create all tables, functions, triggers, and RLS policies
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Companies Table
-- Purpose: Multi-tenancy support, company information
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    tel TEXT,
    email TEXT,
    registration_no TEXT,
    registered_office TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies(name);

-- 2. Accounts Table
-- Purpose: Bank accounts and petty cash accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('main_bank', 'petty_cash')),
    currency TEXT NOT NULL CHECK (currency IN ('MYR', 'JPY')),
    country TEXT NOT NULL CHECK (country IN ('Malaysia', 'Japan')),
    bank_name TEXT,
    account_number TEXT,
    custodian TEXT,
    initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_active ON accounts(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_currency ON accounts(currency);

-- Constraint: bank accounts must have bank_name
ALTER TABLE accounts ADD CONSTRAINT check_bank_account_fields
    CHECK (type != 'main_bank' OR bank_name IS NOT NULL);

-- Constraint: petty cash must have custodian
ALTER TABLE accounts ADD CONSTRAINT check_petty_cash_fields
    CHECK (type != 'petty_cash' OR custodian IS NOT NULL);

-- 3. Documents Table
-- Purpose: Base table for all document types (polymorphic)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (
        document_type IN ('invoice', 'receipt', 'payment_voucher', 'statement_of_payment')
    ),
    document_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('draft', 'issued', 'paid', 'completed', 'cancelled')
    ),
    document_date DATE NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('MYR', 'JPY')),
    country TEXT NOT NULL CHECK (country IN ('Malaysia', 'Japan')),
    amount DECIMAL(15,2) NOT NULL,
    subtotal DECIMAL(15,2),
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(15,2),
    total DECIMAL(15,2),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(company_id, document_number)
);

CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_date ON documents(document_date);
CREATE INDEX idx_documents_account ON documents(account_id);
CREATE INDEX idx_documents_active ON documents(company_id, document_type, status)
    WHERE deleted_at IS NULL;

-- 4. Invoices Table
-- Purpose: Invoice-specific fields
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    customer_email TEXT,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(document_id)
);

CREATE INDEX idx_invoices_customer ON invoices(customer_name);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- 5. Receipts Table
-- Purpose: Receipt-specific fields
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    payer_name TEXT NOT NULL,
    payer_contact TEXT,
    receipt_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    received_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(document_id)
);

CREATE INDEX idx_receipts_invoice ON receipts(linked_invoice_id);
CREATE INDEX idx_receipts_payer ON receipts(payer_name);

-- 6. Payment Vouchers Table
-- Purpose: Payment voucher-specific fields
CREATE TABLE payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    payee_name TEXT NOT NULL,
    payee_address TEXT,
    payee_bank_account TEXT,
    payee_bank_name TEXT,
    voucher_date DATE NOT NULL,
    payment_due_date DATE,
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    approval_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(document_id)
);

CREATE INDEX idx_payment_vouchers_payee ON payment_vouchers(payee_name);
CREATE INDEX idx_payment_vouchers_approved ON payment_vouchers(approved_by);

-- 7. Statements of Payment Table
-- Purpose: Statement of payment-specific fields
CREATE TABLE statements_of_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    linked_voucher_id UUID NOT NULL REFERENCES payment_vouchers(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_reference TEXT NOT NULL,
    transfer_proof_filename TEXT,
    transfer_proof_base64 TEXT, -- Consider moving to storage bucket later
    confirmed_by TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    transaction_fee DECIMAL(15,2) DEFAULT 0,
    transaction_fee_type TEXT,
    total_deducted DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(document_id),
    UNIQUE(linked_voucher_id) -- One statement per voucher
);

CREATE INDEX idx_sop_voucher ON statements_of_payment(linked_voucher_id);
CREATE INDEX idx_sop_reference ON statements_of_payment(transaction_reference);

-- 8. Line Items Table
-- Purpose: Line items for documents (invoices, payment vouchers, etc.)
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(document_id, line_number)
);

CREATE INDEX idx_line_items_document ON line_items(document_id);

-- 9. Transactions Table
-- Purpose: Financial transaction audit trail
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('increase', 'decrease')),
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    metadata JSONB,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_account ON transactions(account_id, transaction_date DESC);
CREATE INDEX idx_transactions_document ON transactions(document_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);

-- 10. Document Counters Table
-- Purpose: Auto-increment document numbers per type per day
CREATE TABLE document_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    date_key TEXT NOT NULL, -- Format: YYYYMMDD
    counter INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, document_type, date_key)
);

CREATE INDEX idx_counters_lookup ON document_counters(company_id, document_type, date_key);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- 1. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_vouchers_updated_at BEFORE UPDATE ON payment_vouchers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_statements_of_payment_updated_at BEFORE UPDATE ON statements_of_payment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_counters_updated_at BEFORE UPDATE ON document_counters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Generate document number function
CREATE OR REPLACE FUNCTION generate_document_number(
    p_company_id UUID,
    p_document_type TEXT
) RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_date_key TEXT;
    v_counter INTEGER;
    v_document_number TEXT;
BEGIN
    -- Determine prefix
    v_prefix := CASE p_document_type
        WHEN 'invoice' THEN 'INV'
        WHEN 'receipt' THEN 'RCP'
        WHEN 'payment_voucher' THEN 'PV'
        WHEN 'statement_of_payment' THEN 'SOP'
        ELSE 'DOC'
    END;

    -- Get current date key (YYYYMMDD)
    v_date_key := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Get and increment counter (atomic operation)
    INSERT INTO document_counters (company_id, document_type, date_key, counter)
    VALUES (p_company_id, p_document_type, v_date_key, 1)
    ON CONFLICT (company_id, document_type, date_key)
    DO UPDATE SET counter = document_counters.counter + 1
    RETURNING counter INTO v_counter;

    -- Format: WIF-PREFIX-YYYYMMDD-XXX
    v_document_number := 'WIF-' || v_prefix || '-' || v_date_key || '-' || LPAD(v_counter::TEXT, 3, '0');

    RETURN v_document_number;
END;
$$ LANGUAGE plpgsql;

-- 3. Validate account balance before payment
CREATE OR REPLACE FUNCTION validate_payment_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_account_balance DECIMAL(15,2);
    v_payment_amount DECIMAL(15,2);
BEGIN
    IF NEW.document_type = 'statement_of_payment' AND NEW.status = 'completed' THEN
        -- Get account balance
        SELECT current_balance INTO v_account_balance
        FROM accounts
        WHERE id = NEW.account_id;

        -- Get total deducted amount
        SELECT total_deducted INTO v_payment_amount
        FROM statements_of_payment
        WHERE document_id = NEW.id;

        -- Validate sufficient balance
        IF v_account_balance < v_payment_amount THEN
            RAISE EXCEPTION 'Insufficient balance: Account has % but payment requires %',
                v_account_balance, v_payment_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_trigger
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION validate_payment_balance();

-- 4. Auto-create transaction on document completion
CREATE OR REPLACE FUNCTION create_transaction_on_document_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_account accounts%ROWTYPE;
    v_amount DECIMAL(15,2);
    v_txn_type TEXT;
    v_description TEXT;
BEGIN
    -- Only process receipts and statements of payment with 'completed' status
    IF NEW.status = 'completed' AND NEW.account_id IS NOT NULL THEN
        IF NEW.document_type = 'receipt' THEN
            -- Receipt increases balance
            v_amount := NEW.amount;
            v_txn_type := 'increase';
            v_description := 'Payment received - ' || NEW.document_number;

        ELSIF NEW.document_type = 'statement_of_payment' THEN
            -- Statement of payment decreases balance
            SELECT total_deducted INTO v_amount
            FROM statements_of_payment
            WHERE document_id = NEW.id;

            v_txn_type := 'decrease';
            v_description := 'Payment made - ' || NEW.document_number;

        ELSE
            RETURN NEW;
        END IF;

        -- Get account and update balance (with row lock)
        SELECT * INTO v_account FROM accounts WHERE id = NEW.account_id FOR UPDATE;

        -- Create transaction record
        INSERT INTO transactions (
            account_id,
            document_id,
            transaction_type,
            description,
            amount,
            balance_before,
            balance_after,
            transaction_date
        ) VALUES (
            NEW.account_id,
            NEW.id,
            v_txn_type,
            v_description,
            v_amount,
            v_account.current_balance,
            v_account.current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END,
            NOW()
        );

        -- Update account balance
        UPDATE accounts
        SET current_balance = current_balance + CASE WHEN v_txn_type = 'increase' THEN v_amount ELSE -v_amount END,
            updated_at = NOW()
        WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_transaction_trigger
AFTER INSERT OR UPDATE OF status ON documents
FOR EACH ROW
EXECUTE FUNCTION create_transaction_on_document_complete();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements_of_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies configured for public read access on companies table
-- This allows anonymous users to check if setup is required
-- All other tables require authentication (future implementation)

-- Companies: Allow public read access (needed for initial setup check)
-- But restrict write operations (future: implement proper auth checks)
CREATE POLICY "Allow public read access to companies" ON companies
    FOR SELECT
    TO public, anon, authenticated
    USING (true);

CREATE POLICY "Allow public insert to companies" ON companies
    FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow public update to companies" ON companies
    FOR UPDATE
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete from companies" ON companies
    FOR DELETE
    TO public, anon, authenticated
    USING (true);

-- Apply similar policies to other tables (allow all access for now)
-- TODO: Implement proper authentication-based policies
CREATE POLICY "Allow all access to accounts" ON accounts
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to documents" ON documents
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to invoices" ON invoices
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to receipts" ON receipts
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to payment_vouchers" ON payment_vouchers
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to statements_of_payment" ON statements_of_payment
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to line_items" ON line_items
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to transactions" ON transactions
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all access to document_counters" ON document_counters
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Create default company
INSERT INTO companies (id, name, address, tel, email, registration_no, registered_office)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'WIF JAPAN SDN BHD',
    E'Malaysia Office\nKuala Lumpur, Malaysia',
    '+60-XXX-XXXXXXX',
    'info@wifjapan.com',
    '(1594364-K)',
    'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of created objects:
-- Tables: 10 (companies, accounts, documents, invoices, receipts, payment_vouchers,
--             statements_of_payment, line_items, transactions, document_counters)
-- Functions: 4 (update_updated_at_column, generate_document_number,
--               validate_payment_balance, create_transaction_on_document_complete)
-- Triggers: 10 (updated_at triggers for each table + validation + transaction triggers)
-- Indexes: 20+ (optimized for common queries)
-- RLS Policies: Basic policies enabled (to be customized)
