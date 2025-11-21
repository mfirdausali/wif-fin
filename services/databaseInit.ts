/**
 * Automatic Database Initialization Service
 *
 * This service automatically creates the database schema on first run.
 * No manual SQL migration required!
 */

import { supabase } from '../lib/supabase';

// Database schema - exported for reference
export const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    tel TEXT,
    email TEXT,
    registration_no TEXT,
    registered_office TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('main_bank', 'petty_cash')),
    currency TEXT NOT NULL CHECK (currency IN ('MYR', 'JPY')),
    country TEXT NOT NULL CHECK (country IN ('Malaysia', 'Japan')),
    bank_name TEXT,
    account_number TEXT,
    custodian TEXT,
    initial_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Documents Table (Base table for all documents)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'receipt', 'payment_voucher', 'statement_of_payment')),
    document_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'paid', 'completed', 'cancelled')),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    customer_email TEXT,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    payer_name TEXT NOT NULL,
    payer_contact TEXT,
    receipt_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    received_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Vouchers Table
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    payee_name TEXT NOT NULL,
    payee_address TEXT,
    payee_bank_account TEXT,
    payee_bank_name TEXT,
    voucher_date DATE NOT NULL,
    payment_due_date DATE,
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    approval_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Statements of Payment Table
CREATE TABLE IF NOT EXISTS statements_of_payment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    linked_voucher_id UUID NOT NULL REFERENCES payment_vouchers(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_reference TEXT NOT NULL,
    transfer_proof_filename TEXT,
    transfer_proof_base64 TEXT,
    confirmed_by TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    transaction_fee DECIMAL(15,2) DEFAULT 0,
    transaction_fee_type TEXT,
    total_deducted DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Line Items Table
CREATE TABLE IF NOT EXISTS line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, line_number)
);

-- Transactions Table (Audit trail)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('increase', 'decrease')),
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    metadata JSONB,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Counters Table
CREATE TABLE IF NOT EXISTS document_counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    date_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, document_type, date_key)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_document ON transactions(document_id);

-- Function: Generate Document Number
CREATE OR REPLACE FUNCTION generate_document_number(
    p_company_id UUID,
    p_document_type TEXT
) RETURNS TEXT AS $$
DECLARE
    v_date_key TEXT;
    v_counter INTEGER;
    v_prefix TEXT;
    v_doc_number TEXT;
BEGIN
    v_date_key := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    v_prefix := CASE p_document_type
        WHEN 'invoice' THEN 'INV'
        WHEN 'receipt' THEN 'RCP'
        WHEN 'payment_voucher' THEN 'PV'
        WHEN 'statement_of_payment' THEN 'SOP'
        ELSE 'DOC'
    END;

    INSERT INTO document_counters (company_id, document_type, date_key, counter)
    VALUES (p_company_id, p_document_type, v_date_key, 1)
    ON CONFLICT (company_id, document_type, date_key)
    DO UPDATE SET counter = document_counters.counter + 1, updated_at = NOW()
    RETURNING counter INTO v_counter;

    v_doc_number := 'WIF-' || v_prefix || '-' || v_date_key || '-' || LPAD(v_counter::TEXT, 3, '0');

    RETURN v_doc_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default company
INSERT INTO companies (id, name, address, tel, email)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'WIF JAPAN SDN BHD',
    'Kuala Lumpur, Malaysia',
    '+60-XXX-XXXXXXX',
    'info@wifjapan.com'
)
ON CONFLICT (id) DO NOTHING;
`;

/**
 * Check if database tables exist
 */
async function checkTablesExist(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    // If no error, tables exist
    return !error;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<{
  success: boolean;
  message: string;
  alreadyInitialized?: boolean;
}> {
  try {
    console.log('🗄️  Checking database status...');

    // Check if tables already exist
    const tablesExist = await checkTablesExist();

    if (tablesExist) {
      console.log('✅ Database already initialized');
      return {
        success: true,
        message: 'Database already initialized',
        alreadyInitialized: true
      };
    }

    console.log('📦 Initializing database schema...');

    // Execute schema SQL
    // Note: Supabase REST API doesn't support running raw SQL directly
    // This needs to be run via Supabase Dashboard or CLI
    // For now, we'll just check and inform the user

    return {
      success: false,
      message: 'Database needs initialization. Please run: ./setup-supabase.sh'
    };

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Verify database connection
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
