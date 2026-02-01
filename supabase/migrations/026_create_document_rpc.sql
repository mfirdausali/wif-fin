-- Migration 026: Create transactional document creation RPC
-- Creates an RPC function that atomically creates documents with all related data
-- This prevents partial inserts and ensures data consistency

-- Function to create a complete document (document + type-specific data + line items)
-- in a single atomic transaction
CREATE OR REPLACE FUNCTION create_full_document(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_doc_id uuid;
  v_invoice_id uuid;
  v_receipt_id uuid;
  v_voucher_id uuid;
  v_statement_id uuid;
  v_line_item jsonb;
  v_line_number integer := 0;
BEGIN
  -- Validate required fields
  IF payload->>'company_id' IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF payload->>'document_type' IS NULL THEN
    RAISE EXCEPTION 'document_type is required';
  END IF;

  IF payload->>'document_number' IS NULL THEN
    RAISE EXCEPTION 'document_number is required';
  END IF;

  -- Step 1: Insert into documents table
  INSERT INTO documents (
    company_id,
    account_id,
    booking_id,
    document_type,
    document_number,
    status,
    document_date,
    currency,
    country,
    amount,
    subtotal,
    document_discount_type,
    document_discount_value,
    document_discount_amount,
    tax_rate,
    tax_amount,
    total,
    notes
  ) VALUES (
    (payload->>'company_id')::uuid,
    (payload->>'account_id')::uuid,
    (payload->>'booking_id')::uuid,
    (payload->>'document_type')::document_type_enum,
    payload->>'document_number',
    COALESCE((payload->>'status')::text, 'draft'),
    COALESCE((payload->>'document_date')::date, CURRENT_DATE),
    COALESCE((payload->>'currency')::text, 'MYR'),
    COALESCE((payload->>'country')::text, 'MY'),
    COALESCE((payload->>'amount')::numeric, 0),
    (payload->>'subtotal')::numeric,
    (payload->>'document_discount_type')::discount_type_enum,
    (payload->>'document_discount_value')::numeric,
    (payload->>'document_discount_amount')::numeric,
    (payload->>'tax_rate')::numeric,
    (payload->>'tax_amount')::numeric,
    (payload->>'total')::numeric,
    payload->>'notes'
  )
  RETURNING id INTO v_doc_id;

  -- Step 2: Insert type-specific data
  CASE payload->>'document_type'
    -- INVOICE
    WHEN 'invoice' THEN
      INSERT INTO invoices (
        document_id,
        customer_name,
        customer_address,
        customer_email,
        invoice_date,
        due_date,
        payment_terms
      ) VALUES (
        v_doc_id,
        payload->'invoice_data'->>'customer_name',
        payload->'invoice_data'->>'customer_address',
        payload->'invoice_data'->>'customer_email',
        (payload->'invoice_data'->>'invoice_date')::date,
        (payload->'invoice_data'->>'due_date')::date,
        payload->'invoice_data'->>'payment_terms'
      );

    -- RECEIPT
    WHEN 'receipt' THEN
      INSERT INTO receipts (
        document_id,
        linked_invoice_id,
        payer_name,
        payer_contact,
        receipt_date,
        payment_method,
        received_by
      ) VALUES (
        v_doc_id,
        (payload->'receipt_data'->>'linked_invoice_id')::uuid,
        payload->'receipt_data'->>'payer_name',
        payload->'receipt_data'->>'payer_contact',
        (payload->'receipt_data'->>'receipt_date')::date,
        payload->'receipt_data'->>'payment_method',
        payload->'receipt_data'->>'received_by'
      );

    -- PAYMENT VOUCHER
    WHEN 'payment_voucher' THEN
      INSERT INTO payment_vouchers (
        document_id,
        payee_name,
        payee_address,
        payee_bank_account,
        payee_bank_name,
        voucher_date,
        payment_due_date,
        requested_by,
        approved_by,
        approval_date,
        supporting_doc_filename,
        supporting_doc_base64,
        supporting_doc_storage_path
      ) VALUES (
        v_doc_id,
        payload->'voucher_data'->>'payee_name',
        payload->'voucher_data'->>'payee_address',
        payload->'voucher_data'->>'payee_bank_account',
        payload->'voucher_data'->>'payee_bank_name',
        (payload->'voucher_data'->>'voucher_date')::date,
        (payload->'voucher_data'->>'payment_due_date')::date,
        payload->'voucher_data'->>'requested_by',
        payload->'voucher_data'->>'approved_by',
        (payload->'voucher_data'->>'approval_date')::timestamptz,
        payload->'voucher_data'->>'supporting_doc_filename',
        payload->'voucher_data'->>'supporting_doc_base64',
        payload->'voucher_data'->>'supporting_doc_storage_path'
      );

    -- STATEMENT OF PAYMENT
    WHEN 'statement_of_payment' THEN
      INSERT INTO statements_of_payment (
        document_id,
        linked_voucher_id,
        payment_date,
        payment_method,
        transaction_reference,
        transfer_proof_filename,
        transfer_proof_base64,
        confirmed_by,
        payee_name,
        transaction_fee,
        transaction_fee_type,
        total_deducted
      ) VALUES (
        v_doc_id,
        (payload->'statement_data'->>'linked_voucher_id')::uuid,
        (payload->'statement_data'->>'payment_date')::date,
        payload->'statement_data'->>'payment_method',
        payload->'statement_data'->>'transaction_reference',
        payload->'statement_data'->>'transfer_proof_filename',
        payload->'statement_data'->>'transfer_proof_base64',
        payload->'statement_data'->>'confirmed_by',
        payload->'statement_data'->>'payee_name',
        COALESCE((payload->'statement_data'->>'transaction_fee')::numeric, 0),
        payload->'statement_data'->>'transaction_fee_type',
        COALESCE((payload->'statement_data'->>'total_deducted')::numeric, 0)
      );

    ELSE
      RAISE EXCEPTION 'Unknown document type: %', payload->>'document_type';
  END CASE;

  -- Step 3: Insert line items if present
  IF payload->'line_items' IS NOT NULL THEN
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(payload->'line_items')
    LOOP
      v_line_number := v_line_number + 1;

      INSERT INTO line_items (
        document_id,
        line_number,
        description,
        quantity,
        unit_price,
        discount_type,
        discount_value,
        discount_amount,
        amount
      ) VALUES (
        v_doc_id,
        v_line_number,
        v_line_item->>'description',
        COALESCE((v_line_item->>'quantity')::numeric, 1),
        COALESCE((v_line_item->>'unit_price')::numeric, 0),
        (v_line_item->>'discount_type')::discount_type_enum,
        (v_line_item->>'discount_value')::numeric,
        (v_line_item->>'discount_amount')::numeric,
        COALESCE((v_line_item->>'amount')::numeric, 0)
      );
    END LOOP;
  END IF;

  -- Return the created document ID
  RETURN v_doc_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Any error will automatically rollback the entire transaction
    RAISE EXCEPTION 'Document creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_full_document(jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_full_document(jsonb) IS
'Atomically creates a complete document with type-specific data and line items.
All inserts are wrapped in a single transaction - if any step fails, everything rolls back.
This prevents orphaned records and ensures data consistency.

Payload structure:
{
  "company_id": "uuid",
  "account_id": "uuid" (optional),
  "booking_id": "uuid" (optional),
  "document_type": "invoice|receipt|payment_voucher|statement_of_payment",
  "document_number": "string",
  "status": "draft|completed|cancelled|paid" (default: draft),
  "document_date": "YYYY-MM-DD" (default: today),
  "currency": "MYR|JPY|USD" (default: MYR),
  "country": "MY|JP" (default: MY),
  "amount": number,
  "subtotal": number (optional),
  "document_discount_type": "fixed|percentage" (optional),
  "document_discount_value": number (optional),
  "document_discount_amount": number (optional),
  "tax_rate": number (optional),
  "tax_amount": number (optional),
  "total": number (optional),
  "notes": "string" (optional),
  "invoice_data": {...} (for invoices),
  "receipt_data": {...} (for receipts),
  "voucher_data": {...} (for payment vouchers),
  "statement_data": {...} (for statements),
  "line_items": [...] (optional array of line items)
}';
