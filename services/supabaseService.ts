// @ts-nocheck
/**
 * Supabase Service Layer
 *
 * Provides type-safe database operations for all entities:
 * - Companies
 * - Accounts
 * - Documents (invoices, receipts, payment vouchers, statements of payment)
 * - Line Items
 * - Transactions
 * - Document Counters
 *
 * Features:
 * - Type safety using Database types
 * - Error handling
 * - Query builders
 * - Transaction support
 */

import { supabase as supabaseClient, handleSupabaseError } from '../lib/supabase';

export const supabase = supabaseClient;
import type { Database } from '../types/database';
import { Document, DocumentType, Invoice, Receipt, PaymentVoucher, StatementOfPayment, LineItem, Currency, Country } from '../types/document';
import { Account } from '../types/account';
import { PublicUser } from '../types/auth';
import { logDocumentEvent } from './activityLogService';

// Type aliases for cleaner code
type DbCompany = Database['public']['Tables']['companies']['Row'];
type DbCompanyInsert = Database['public']['Tables']['companies']['Insert'];
type DbAccount = Database['public']['Tables']['accounts']['Row'];
type DbAccountInsert = Database['public']['Tables']['accounts']['Insert'];
type DbDocument = Database['public']['Tables']['documents']['Row'];
type DbDocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DbTransaction = Database['public']['Tables']['transactions']['Row'];
type DbLineItem = Database['public']['Tables']['line_items']['Row'];
type DbLineItemInsert = Database['public']['Tables']['line_items']['Insert'];

// ============================================================================
// COMPANY OPERATIONS
// ============================================================================

export interface CompanyInfo {
  name: string;
  address?: string;
  tel?: string;
  email?: string;
  registrationNo?: string;
  registeredOffice?: string;
  allowNegativeBalance?: boolean;
}

/**
 * Get or create default company
 * For single-tenant mode, we use a default company ID
 */
export async function getOrCreateDefaultCompany(companyInfo?: CompanyInfo): Promise<DbCompany> {
  const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';

  try {
    // Try to get existing company
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', DEFAULT_COMPANY_ID)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    if (data) {
      return data;
    }

    // Create company if it doesn't exist
    const insert: DbCompanyInsert = {
      id: DEFAULT_COMPANY_ID,
      name: companyInfo?.name || 'WIF JAPAN SDN BHD',
      address: companyInfo?.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
      tel: companyInfo?.tel || '+60-XXX-XXXXXXX',
      email: companyInfo?.email || 'info@wifjapan.com',
      registration_no: companyInfo?.registrationNo || '(1594364-K)',
      registered_office: companyInfo?.registeredOffice || 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia',
      allow_negative_balance: companyInfo?.allowNegativeBalance !== undefined ? companyInfo.allowNegativeBalance : false
    };

    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert(insert)
      .select()
      .single();

    if (createError) throw createError;
    return newCompany!;
  } catch (error) {
    console.error('Error getting/creating company:', error);
    throw new Error(`Failed to get company: ${handleSupabaseError(error)}`);
  }
}

/**
 * Update company information
 */
export async function updateCompanyInfo(companyId: string, updates: Partial<CompanyInfo>): Promise<DbCompany> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.address !== undefined && { address: updates.address }),
        ...(updates.tel !== undefined && { tel: updates.tel }),
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.registrationNo !== undefined && { registration_no: updates.registrationNo }),
        ...(updates.registeredOffice !== undefined && { registered_office: updates.registeredOffice }),
        ...(updates.allowNegativeBalance !== undefined && { allow_negative_balance: updates.allowNegativeBalance }),
      })
      .eq('id', companyId)
      .select()
      .single();

    if (error) throw error;
    return data!;
  } catch (error) {
    console.error('Error updating company:', error);
    throw new Error(`Failed to update company: ${handleSupabaseError(error)}`);
  }
}

// ============================================================================
// ACCOUNT OPERATIONS
// ============================================================================

/**
 * Create an account
 */
export async function createAccount(companyId: string, account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
  try {
    const insert: DbAccountInsert = {
      company_id: companyId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      country: account.country,
      bank_name: account.bankName || null,
      account_number: account.accountNumber || null,
      custodian: account.custodian || null,
      initial_balance: account.initialBalance,
      current_balance: account.currentBalance,
      is_active: account.isActive !== undefined ? account.isActive : true,
      notes: account.notes || null,
    };

    const { data, error } = await supabase
      .from('accounts')
      .insert(insert)
      .select()
      .single();

    if (error) throw error;
    return dbAccountToAccount(data!);
  } catch (error) {
    console.error('Error creating account:', error);
    throw new Error(`Failed to create account: ${handleSupabaseError(error)}`);
  }
}

/**
 * Get all accounts for a company
 */
export async function getAccounts(companyId: string): Promise<Account[]> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(dbAccountToAccount);
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw new Error(`Failed to get accounts: ${handleSupabaseError(error)}`);
  }
}

/**
 * Update account
 */
export async function updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.currentBalance !== undefined && { current_balance: updates.currentBalance }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
      })
      .eq('id', accountId)
      .select()
      .single();

    if (error) throw error;
    return dbAccountToAccount(data!);
  } catch (error) {
    console.error('Error updating account:', error);
    throw new Error(`Failed to update account: ${handleSupabaseError(error)}`);
  }
}

/**
 * Soft delete account
 */
export async function deleteAccount(accountId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', accountId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw new Error(`Failed to delete account: ${handleSupabaseError(error)}`);
  }
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

/**
 * Generate document number
 *
 * For INVOICES: Uses format WIF + YY + NNNN (e.g., WIF250187)
 *   - Continues from last invoice number in database
 *   - Resets to 0001 when year changes (e.g., WIF260001 for 2026)
 *
 * For OTHER documents: Uses database RPC function (WIF-PREFIX-YYYYMMDD-XXX)
 */
export async function generateDocumentNumber(companyId: string, documentType: DocumentType): Promise<string> {
  try {
    // Special handling for invoices - use WIF + YY + NNNN format
    if (documentType === 'invoice') {
      return await generateInvoiceNumber();
    }

    // For other document types, use the database RPC function
    const { data, error } = await supabase
      .rpc('generate_document_number', {
        p_company_id: companyId,
        p_document_type: documentType
      });

    if (error) throw error;
    return data as string;
  } catch (error) {
    console.error('Error generating document number:', error);
    throw new Error(`Failed to generate document number: ${handleSupabaseError(error)}`);
  }
}

/**
 * Generate invoice number in format: WIF + YY + NNNN
 * Example: WIF250187, WIF250188, ... WIF260001 (for 2026)
 *
 * Queries the database for the last invoice number and increments it.
 * Handles year rollover automatically.
 */
async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearPrefix = String(currentYear).slice(-2); // "25" for 2025, "26" for 2026

  try {
    // Query for the highest invoice number with the current year prefix
    const { data: currentYearData, error: currentYearError } = await supabase
      .from('documents')
      .select('document_number')
      .eq('document_type', 'invoice')
      .like('document_number', `WIF${yearPrefix}%`)
      .is('deleted_at', null)
      .order('document_number', { ascending: false })
      .limit(1);

    if (currentYearError) throw currentYearError;

    let nextSequence = 1;

    if (currentYearData && currentYearData.length > 0) {
      // Extract sequence number from last invoice (e.g., "WIF250186" -> 186)
      const lastNumber = currentYearData[0].document_number;
      const match = lastNumber.match(/^WIF\d{2}(\d+)$/);
      if (match) {
        nextSequence = parseInt(match[1], 10) + 1;
      }
    } else {
      // No invoices for current year - check if we should continue from previous year's last number
      // or start fresh at 0001
      // For year rollover: start at 0001
      nextSequence = 1;
    }

    // Format: WIF + YY + NNNN (4 digits, padded with zeros)
    const formattedNumber = `WIF${yearPrefix}${String(nextSequence).padStart(4, '0')}`;

    return formattedNumber;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback: generate with timestamp to avoid duplicates
    const fallbackSeq = Date.now().toString().slice(-4);
    return `WIF${yearPrefix}${fallbackSeq}`;
  }
}

/**
 * Create a complete document (with type-specific data and line items)
 *
 * RACE CONDITION FIX: Document numbers are generated atomically at insert time,
 * not when the form loads. This prevents duplicate numbers when multiple users
 * create documents simultaneously.
 */
export async function createDocument(
  companyId: string,
  document: Document,
  bookingId?: string
): Promise<Document> {
  try {
    // ALWAYS generate a fresh document number for NEW documents
    // Only use provided number if editing an existing document (has a real UUID id)
    let documentNumber: string;

    const isNewDocument = !document.id || document.id.startsWith('DOC-');

    if (isNewDocument) {
      // New document - ALWAYS generate fresh number
      documentNumber = await generateDocumentNumber(companyId, document.documentType);
      console.log(`[createDocument] Generated fresh number for NEW document: ${documentNumber}`);
    } else {
      // Editing existing document - keep original number
      documentNumber = document.documentNumber;
      console.log(`[createDocument] Using existing number for document ${document.id}: ${documentNumber}`);
    }

    // 1. Create base document
    const docInsert: DbDocumentInsert = {
      company_id: companyId,
      account_id: document.accountId || null,
      booking_id: bookingId || null,
      document_type: document.documentType,
      document_number: documentNumber, // Use the freshly generated number
      status: document.status,
      document_date: document.date,
      currency: document.currency,
      country: document.country,
      amount: document.amount,
      subtotal: document.subtotal || null,
      tax_rate: document.taxRate || null,
      tax_amount: document.taxAmount || null,
      total: document.total || null,
      notes: document.notes || null,
    };

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert(docInsert)
      .select()
      .single();

    if (docError) throw docError;
    const documentId = docData!.id;

    // 2. Create type-specific data
    switch (document.documentType) {
      case 'invoice':
        await createInvoice(documentId, document as Invoice);
        break;
      case 'receipt':
        await createReceipt(documentId, document as Receipt);
        break;
      case 'payment_voucher':
        await createPaymentVoucher(documentId, document as PaymentVoucher);
        break;
      case 'statement_of_payment':
        await createStatementOfPayment(documentId, document as StatementOfPayment);
        break;
    }

    // 3. Create line items if present
    if (document.items && document.items.length > 0) {
      await createLineItems(documentId, document.items);
    }

    // 4. Fetch and return complete document
    return await getDocument(documentId, document.documentType);
  } catch (error) {
    console.error('Error creating document:', error);
    throw new Error(`Failed to create document: ${handleSupabaseError(error)}`);
  }
}

/**
 * Get all documents for a company - OPTIMIZED version using joins
 * @param companyId - Company ID
 * @param userRole - Optional user role to filter documents (operations users only see payment_voucher)
 */
export async function getDocuments(companyId: string, userRole?: string): Promise<Document[]> {
  try {
    // Use Supabase joins to fetch everything in ONE query
    let query = supabase
      .from('documents')
      .select(`
        *,
        line_items (*),
        invoices (*),
        receipts (*),
        payment_vouchers (*),
        statements_of_payment (*)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null);

    // Filter by document type for operations users
    if (userRole === 'operations') {
      query = query.eq('document_type', 'payment_voucher');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the joined data into Document objects
    const documents: Document[] = (data || []).map(doc => {
      const items = doc.line_items || [];
      const documentType = doc.document_type as DocumentType;

      switch (documentType) {
        case 'invoice': {
          // Supabase returns one-to-one relationships as objects, not arrays
          const invoiceData = doc.invoices || {
            customer_name: 'Unknown',
            invoice_date: doc.document_date,
            due_date: doc.document_date,
          };
          return dbDocumentToInvoice(doc, invoiceData, items);
        }
        case 'receipt': {
          const receiptData = doc.receipts || {
            payer_name: 'Unknown',
            receipt_date: doc.document_date,
            payment_method: 'Unknown',
            received_by: 'Unknown',
          };
          return dbDocumentToReceipt(doc, receiptData, undefined);
        }
        case 'payment_voucher': {
          const voucherData = doc.payment_vouchers || {
            payee_name: 'Unknown',
            voucher_date: doc.document_date,
            requested_by: 'Unknown',
          };
          return dbDocumentToPaymentVoucher(doc, voucherData, items);
        }
        case 'statement_of_payment': {
          const statementData = doc.statements_of_payment || {
            linked_voucher_id: '',
            payment_date: doc.document_date,
            payment_method: 'Unknown',
            transaction_reference: 'Unknown',
            confirmed_by: 'Unknown',
            payee_name: 'Unknown',
            total_deducted: doc.amount,
          };
          return dbDocumentToStatementOfPayment(doc, statementData, items);
        }
        default:
          throw new Error(`Unknown document type: ${documentType}`);
      }
    });

    return documents;
  } catch (error) {
    console.error('Error getting documents:', error);
    throw new Error(`Failed to get documents: ${handleSupabaseError(error)}`);
  }
}

/**
 * Get a single document with all related data
 */
export async function getDocument(documentId: string, documentType: DocumentType): Promise<Document> {
  try {
    // Get base document
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // Get line items
    const { data: items, error: itemsError } = await supabase
      .from('line_items')
      .select('*')
      .eq('document_id', documentId)
      .order('line_number');

    if (itemsError) throw itemsError;

    // Get type-specific data and construct document
    let document: Document;

    switch (documentType) {
      case 'invoice':
        document = await getInvoiceData(docData!, items || []);
        break;
      case 'receipt':
        document = await getReceiptData(docData!);
        break;
      case 'payment_voucher':
        document = await getPaymentVoucherData(docData!, items || []);
        break;
      case 'statement_of_payment':
        document = await getStatementOfPaymentData(docData!, items || []);
        break;
      default:
        throw new Error(`Unknown document type: ${documentType}`);
    }

    return document;
  } catch (error) {
    console.error('Error getting document:', error);
    throw new Error(`Failed to get document: ${handleSupabaseError(error)}`);
  }
}

/**
 * Update a document
 * Returns null if document doesn't exist (graceful handling for legacy data)
 */
export async function updateDocument(documentId: string, updates: Partial<Document>): Promise<Document | null> {
  try {
    // First check if document exists
    const { data: existingDoc, error: checkError } = await supabase
      .from('documents')
      .select('id, document_type')
      .eq('id', documentId)
      .maybeSingle();

    if (checkError) throw checkError;

    // If document doesn't exist in Supabase, return null (legacy data from localStorage)
    if (!existingDoc) {
      console.log(`Document ${documentId} not found in Supabase (may be legacy localStorage data)`);
      return null;
    }

    // Update base document
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .update({
        ...(updates.documentNumber && { document_number: updates.documentNumber }),
        ...(updates.status && { status: updates.status }),
        ...(updates.amount !== undefined && { amount: updates.amount }),
        ...(updates.subtotal !== undefined && { subtotal: updates.subtotal }),
        ...(updates.taxRate !== undefined && { tax_rate: updates.taxRate }),
        ...(updates.taxAmount !== undefined && { tax_amount: updates.taxAmount }),
        ...(updates.total !== undefined && { total: updates.total }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.date && { document_date: updates.date }),
        ...(updates.accountId !== undefined && { account_id: updates.accountId || null }),
      })
      .eq('id', documentId)
      .select()
      .single();

    if (docError) throw docError;

    const documentType = docData!.document_type as DocumentType;

    // Update line items if provided
    if (updates.items && updates.items.length > 0) {
      // Delete existing line items
      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) throw deleteError;

      // Insert new line items
      await createLineItems(documentId, updates.items);
    }

    // Update type-specific data
    if (documentType === 'invoice' && (updates as Partial<Invoice>).customerName !== undefined) {
      const invoiceUpdates = updates as Partial<Invoice>;
      await supabase
        .from('invoices')
        .update({
          ...(invoiceUpdates.customerName && { customer_name: invoiceUpdates.customerName }),
          ...(invoiceUpdates.customerAddress !== undefined && { customer_address: invoiceUpdates.customerAddress }),
          ...(invoiceUpdates.customerEmail !== undefined && { customer_email: invoiceUpdates.customerEmail }),
          ...(invoiceUpdates.invoiceDate && { invoice_date: invoiceUpdates.invoiceDate }),
          ...(invoiceUpdates.dueDate && { due_date: invoiceUpdates.dueDate }),
          ...(invoiceUpdates.paymentTerms !== undefined && { payment_terms: invoiceUpdates.paymentTerms }),
        })
        .eq('document_id', documentId);
    }

    if (documentType === 'receipt' && (updates as Partial<Receipt>).payerName !== undefined) {
      const receiptUpdates = updates as Partial<Receipt>;
      await supabase
        .from('receipts')
        .update({
          ...(receiptUpdates.payerName && { payer_name: receiptUpdates.payerName }),
          ...(receiptUpdates.payerContact !== undefined && { payer_contact: receiptUpdates.payerContact }),
          ...(receiptUpdates.receiptDate && { receipt_date: receiptUpdates.receiptDate }),
          ...(receiptUpdates.paymentMethod && { payment_method: receiptUpdates.paymentMethod }),
          ...(receiptUpdates.receivedBy && { received_by: receiptUpdates.receivedBy }),
        })
        .eq('document_id', documentId);
    }

    if (documentType === 'payment_voucher' && (updates as Partial<PaymentVoucher>).payeeName !== undefined) {
      const voucherUpdates = updates as Partial<PaymentVoucher>;
      await supabase
        .from('payment_vouchers')
        .update({
          ...(voucherUpdates.payeeName && { payee_name: voucherUpdates.payeeName }),
          ...(voucherUpdates.payeeAddress !== undefined && { payee_address: voucherUpdates.payeeAddress }),
          ...(voucherUpdates.payeeBankAccount !== undefined && { payee_bank_account: voucherUpdates.payeeBankAccount }),
          ...(voucherUpdates.payeeBankName !== undefined && { payee_bank_name: voucherUpdates.payeeBankName }),
          ...(voucherUpdates.voucherDate && { voucher_date: voucherUpdates.voucherDate }),
          ...(voucherUpdates.paymentDueDate !== undefined && { payment_due_date: voucherUpdates.paymentDueDate }),
          ...(voucherUpdates.requestedBy && { requested_by: voucherUpdates.requestedBy }),
          // Serialize UserReference object to JSON string for TEXT column storage
          ...(voucherUpdates.approvedBy !== undefined && {
            approved_by: voucherUpdates.approvedBy
              ? (typeof voucherUpdates.approvedBy === 'object'
                  ? JSON.stringify(voucherUpdates.approvedBy)
                  : voucherUpdates.approvedBy)
              : null
          }),
          ...(voucherUpdates.approvalDate !== undefined && { approval_date: voucherUpdates.approvalDate }),
          ...(voucherUpdates.supportingDocFilename !== undefined && { supporting_doc_filename: voucherUpdates.supportingDocFilename }),
          ...(voucherUpdates.supportingDocBase64 !== undefined && { supporting_doc_base64: voucherUpdates.supportingDocBase64 }),
          ...(voucherUpdates.supportingDocStoragePath !== undefined && { supporting_doc_storage_path: voucherUpdates.supportingDocStoragePath }),
        })
        .eq('document_id', documentId);
    }

    if (documentType === 'statement_of_payment' && (updates as Partial<StatementOfPayment>).payeeName !== undefined) {
      const statementUpdates = updates as Partial<StatementOfPayment>;
      await supabase
        .from('statements_of_payment')
        .update({
          ...(statementUpdates.paymentDate && { payment_date: statementUpdates.paymentDate }),
          ...(statementUpdates.paymentMethod && { payment_method: statementUpdates.paymentMethod }),
          ...(statementUpdates.transactionReference !== undefined && { transaction_reference: statementUpdates.transactionReference }),
          ...(statementUpdates.confirmedBy && { confirmed_by: statementUpdates.confirmedBy }),
          ...(statementUpdates.payeeName && { payee_name: statementUpdates.payeeName }),
          ...(statementUpdates.transactionFee !== undefined && { transaction_fee: statementUpdates.transactionFee }),
          ...(statementUpdates.transactionFeeType !== undefined && { transaction_fee_type: statementUpdates.transactionFeeType }),
          ...(statementUpdates.totalDeducted !== undefined && { total_deducted: statementUpdates.totalDeducted }),
        })
        .eq('document_id', documentId);
    }

    // Fetch and return complete updated document
    return await getDocument(documentId, documentType);
  } catch (error) {
    console.error('Error updating document:', error);
    throw new Error(`Failed to update document: ${handleSupabaseError(error)}`);
  }
}

/**
 * Link document to a booking
 * @param documentId - ID of the document to link
 * @param bookingId - ID of the booking to link to
 * @param user - Optional user for activity logging
 * @param document - Optional document object for activity logging (if not provided, will be fetched)
 */
export async function linkDocumentToBooking(
  documentId: string,
  bookingId: string,
  user?: PublicUser,
  document?: Document
): Promise<void> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({ booking_id: bookingId })
      .eq('id', documentId);

    if (error) throw error;

    // Log activity if user is provided
    if (user && document) {
      logDocumentEvent('document:linked_to_booking', user, document, {
        documentId,
        bookingId,
      });
    }
  } catch (error) {
    console.error('Error linking document to booking:', error);
    throw new Error(`Failed to link document: ${handleSupabaseError(error)}`);
  }
}

/**
 * Unlink document from booking
 * @param documentId - ID of the document to unlink
 * @param user - Optional user for activity logging
 * @param document - Optional document object for activity logging
 * @param previousBookingId - Optional previous booking ID for logging
 */
export async function unlinkDocumentFromBooking(
  documentId: string,
  user?: PublicUser,
  document?: Document,
  previousBookingId?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({ booking_id: null })
      .eq('id', documentId);

    if (error) throw error;

    // Log activity if user is provided
    if (user && document) {
      logDocumentEvent('document:unlinked_from_booking', user, document, {
        documentId,
        previousBookingId,
      });
    }
  } catch (error) {
    console.error('Error unlinking document from booking:', error);
    throw new Error(`Failed to unlink document: ${handleSupabaseError(error)}`);
  }
}

/**
 * Check if a document can be deleted
 * Validates business rules:
 * - Payment Vouchers cannot be deleted if referenced by any Statement of Payment
 * @param documentId - Document ID to check
 * @returns Object with canDelete flag and optional reason message
 */
export async function checkCanDeleteDocument(
  documentId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  try {
    // Get the document to check its type
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('document_type')
      .eq('id', documentId)
      .is('deleted_at', null)
      .maybeSingle();

    if (docError) throw docError;
    if (!docData) {
      return { canDelete: false, reason: 'Document not found' };
    }

    // If it's a payment voucher, check for linked statements
    if (docData.document_type === 'payment_voucher') {
      // First, get the payment_vouchers.id from the document_id
      const { data: voucherData, error: voucherError } = await supabase
        .from('payment_vouchers')
        .select('id')
        .eq('document_id', documentId)
        .maybeSingle();

      if (voucherError) throw voucherError;

      if (voucherData) {
        // Check if any ACTIVE (non-deleted) statements reference this voucher
        const { data: statements, error: statementsError } = await supabase
          .from('statements_of_payment')
          .select('id, documents!inner(document_number, deleted_at)')
          .eq('linked_voucher_id', voucherData.id);

        if (statementsError) throw statementsError;

        // Filter for non-deleted statements only
        const activeStatements = statements?.filter((sop: any) => {
          const doc = Array.isArray(sop.documents) ? sop.documents[0] : sop.documents;
          return doc && !doc.deleted_at;
        });

        if (activeStatements && activeStatements.length > 0) {
          const statementDoc = activeStatements[0].documents as any;
          const statementNumber = Array.isArray(statementDoc)
            ? statementDoc[0]?.document_number
            : statementDoc?.document_number;

          return {
            canDelete: false,
            reason: `This Payment Voucher is referenced by Statement of Payment ${statementNumber || ''}. Please delete the statement first.`,
          };
        }
      }
    }

    return { canDelete: true };
  } catch (error) {
    console.error('Error checking if document can be deleted:', error);
    return {
      canDelete: false,
      reason: `Failed to validate deletion: ${handleSupabaseError(error)}`,
    };
  }
}

/**
 * Soft delete a document
 * Returns false if document doesn't exist (graceful handling for legacy data)
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  try {
    // First check if document exists
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .maybeSingle();

    // If document doesn't exist in Supabase, return false (legacy data)
    if (!existingDoc) {
      console.log(`Document ${documentId} not found in Supabase (may be legacy localStorage data)`);
      return false;
    }

    // Check if document can be deleted (validates business rules)
    const validation = await checkCanDeleteDocument(documentId);
    if (!validation.canDelete) {
      console.warn('Cannot delete document:', validation.reason);
      throw new Error(validation.reason || 'Cannot delete document');
    }

    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error(`Failed to delete document: ${handleSupabaseError(error)}`);
  }
}

// ============================================================================
// TYPE-SPECIFIC DOCUMENT OPERATIONS
// ============================================================================

async function createInvoice(documentId: string, invoice: Invoice): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .insert({
      document_id: documentId,
      customer_name: invoice.customerName,
      customer_address: invoice.customerAddress || null,
      customer_email: invoice.customerEmail || null,
      invoice_date: invoice.invoiceDate,
      due_date: invoice.dueDate,
      payment_terms: invoice.paymentTerms || null,
    });

  if (error) throw error;
}

async function createReceipt(documentId: string, receipt: Receipt): Promise<void> {
  // Look up the actual invoices.id from documents.id if linkedInvoiceId is provided
  let invoiceId: string | null = null;
  if (receipt.linkedInvoiceId) {
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id')
      .eq('document_id', receipt.linkedInvoiceId)
      .maybeSingle();

    invoiceId = invoiceData?.id || null;
  }

  const { error } = await supabase
    .from('receipts')
    .insert({
      document_id: documentId,
      linked_invoice_id: invoiceId,
      payer_name: receipt.payerName,
      payer_contact: receipt.payerContact || null,
      receipt_date: receipt.receiptDate,
      payment_method: receipt.paymentMethod,
      received_by: receipt.receivedBy,
    });

  if (error) throw error;
}

async function createPaymentVoucher(documentId: string, voucher: PaymentVoucher): Promise<void> {
  const { error } = await supabase
    .from('payment_vouchers')
    .insert({
      document_id: documentId,
      payee_name: voucher.payeeName,
      payee_address: voucher.payeeAddress || null,
      payee_bank_account: voucher.payeeBankAccount || null,
      payee_bank_name: voucher.payeeBankName || null,
      voucher_date: voucher.voucherDate,
      payment_due_date: voucher.paymentDueDate || null,
      requested_by: voucher.requestedBy,
      // Serialize UserReference object to JSON string for TEXT column storage
      approved_by: voucher.approvedBy
        ? (typeof voucher.approvedBy === 'object'
            ? JSON.stringify(voucher.approvedBy)
            : voucher.approvedBy)
        : null,
      approval_date: voucher.approvalDate || null,
      supporting_doc_filename: voucher.supportingDocFilename || null,
      supporting_doc_base64: voucher.supportingDocBase64 || null,
      supporting_doc_storage_path: voucher.supportingDocStoragePath || null,
    });

  if (error) throw error;
}

async function createStatementOfPayment(documentId: string, statement: StatementOfPayment): Promise<void> {
  // Look up the actual payment_vouchers.id from documents.id
  let voucherId: string | null = null;
  if (statement.linkedVoucherId) {
    const { data: voucherData } = await supabase
      .from('payment_vouchers')
      .select('id')
      .eq('document_id', statement.linkedVoucherId)
      .maybeSingle();

    voucherId = voucherData?.id || null;
  }

  // Note: linked_voucher_id is NOT NULL in schema, so this will fail if voucher doesn't exist
  // This is expected - you can only create a statement of payment for an existing voucher
  const { error } = await supabase
    .from('statements_of_payment')
    .insert({
      document_id: documentId,
      linked_voucher_id: voucherId,
      payment_date: statement.paymentDate,
      payment_method: statement.paymentMethod,
      transaction_reference: statement.transactionReference,
      transfer_proof_filename: statement.transferProofFilename || null,
      transfer_proof_base64: statement.transferProofBase64 || null,
      confirmed_by: statement.confirmedBy,
      payee_name: statement.payeeName,
      transaction_fee: statement.transactionFee || 0,
      transaction_fee_type: statement.transactionFeeType || null,
      total_deducted: statement.totalDeducted,
    });

  if (error) throw error;
}

// Fetch complete document data
async function getInvoiceData(doc: DbDocument, items: DbLineItem[]): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle();

  if (error) throw error;

  // Handle case where type-specific data doesn't exist (legacy data)
  const invoiceData = data || {
    customer_name: 'Unknown',
    invoice_date: doc.document_date,
    due_date: doc.document_date,
  };

  return dbDocumentToInvoice(doc, invoiceData, items);
}

async function getReceiptData(doc: DbDocument): Promise<Receipt> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle();

  if (error) throw error;

  // Handle case where type-specific data doesn't exist (legacy data)
  const receiptData = data || {
    payer_name: 'Unknown',
    receipt_date: doc.document_date,
    payment_method: 'Unknown',
    received_by: 'Unknown',
  };

  // Fetch linked invoice's document number and document_id if linkedInvoiceId exists
  // Using two-step query for reliability
  let linkedInvoiceNumber: string | undefined;
  let linkedInvoiceDocumentId: string | undefined;
  if (receiptData.linked_invoice_id) {
    // Step 1: Get document_id from invoices table
    // The linked_invoice_id in receipts table references invoices.id (NOT documents.id)
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('document_id')
      .eq('id', receiptData.linked_invoice_id)
      .maybeSingle();

    if (invoiceError) {
      console.error('[getReceiptData] Failed to lookup linked invoice:', invoiceError);
    } else if (invoiceData?.document_id) {
      // Store the document_id for navigation
      linkedInvoiceDocumentId = invoiceData.document_id;

      // Step 2: Get document_number from documents table
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .select('document_number')
        .eq('id', invoiceData.document_id)
        .maybeSingle();

      if (documentError) {
        console.error('[getReceiptData] Failed to lookup invoice document number:', documentError);
      } else if (documentData?.document_number) {
        linkedInvoiceNumber = documentData.document_number;
        console.log('[getReceiptData] Successfully resolved invoice number:', linkedInvoiceNumber, 'for receipt:', doc.document_number);
      } else {
        console.warn('[getReceiptData] Invoice document found but no document_number for document_id:', invoiceData.document_id);
      }
    } else {
      console.warn('[getReceiptData] Invoice not found for linked_invoice_id:', receiptData.linked_invoice_id);
    }
  }

  const receipt = dbDocumentToReceipt(doc, receiptData, linkedInvoiceDocumentId);
  receipt.linkedInvoiceNumber = linkedInvoiceNumber;
  return receipt;
}

async function getPaymentVoucherData(doc: DbDocument, items: DbLineItem[]): Promise<PaymentVoucher> {
  const { data, error } = await supabase
    .from('payment_vouchers')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle();

  if (error) throw error;

  // Handle case where type-specific data doesn't exist (legacy data)
  const voucherData = data || {
    payee_name: 'Unknown',
    voucher_date: doc.document_date,
    requested_by: 'Unknown',
  };

  return dbDocumentToPaymentVoucher(doc, voucherData, items);
}

async function getStatementOfPaymentData(doc: DbDocument, items: DbLineItem[]): Promise<StatementOfPayment> {
  const { data, error } = await supabase
    .from('statements_of_payment')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle();

  if (error) throw error;

  // Handle case where type-specific data doesn't exist (legacy data)
  const statementData = data || {
    linked_voucher_id: '',
    payment_date: doc.document_date,
    payment_method: 'Unknown',
    transaction_reference: 'Unknown',
    confirmed_by: 'Unknown',
    payee_name: 'Unknown',
    total_deducted: doc.amount,
  };

  // Fetch linked voucher's document number if linkedVoucherId exists
  // Using JOIN query for reliability and efficiency
  let linkedVoucherNumber: string | undefined;
  if (statementData.linked_voucher_id) {
    // The linked_voucher_id in statements_of_payment table references payment_vouchers.id (NOT documents.id)
    // We need to: payment_vouchers.id -> payment_vouchers.document_id -> documents.document_number
    const { data: voucherWithDoc, error: lookupError } = await supabase
      .from('payment_vouchers')
      .select('document_id, documents(document_number)')
      .eq('id', statementData.linked_voucher_id)
      .maybeSingle();

    if (lookupError) {
      console.warn('[getStatementOfPaymentData] Failed to lookup linked voucher:', lookupError);
    } else if (voucherWithDoc) {
      // Handle both nested object and array response formats from Supabase
      const docs = voucherWithDoc.documents as any;
      if (docs) {
        linkedVoucherNumber = Array.isArray(docs) ? docs[0]?.document_number : docs.document_number;
      }
    }
  }

  const statement = dbDocumentToStatementOfPayment(doc, statementData, items);
  statement.linkedVoucherNumber = linkedVoucherNumber;
  return statement;
}

// ============================================================================
// LINE ITEMS OPERATIONS
// ============================================================================

async function createLineItems(documentId: string, items: LineItem[]): Promise<void> {
  const inserts: DbLineItemInsert[] = items.map((item, index) => ({
    document_id: documentId,
    line_number: index + 1,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    amount: item.amount,
  }));

  const { error } = await supabase
    .from('line_items')
    .insert(inserts);

  if (error) throw error;
}

// ============================================================================
// TRANSACTION OPERATIONS
// ============================================================================

/**
 * Get transactions for an account
 */
export async function getTransactions(accountId: string): Promise<DbTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw new Error(`Failed to get transactions: ${handleSupabaseError(error)}`);
  }
}

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

function dbAccountToAccount(dbAccount: DbAccount): Account {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    type: dbAccount.type as 'main_bank' | 'petty_cash',
    currency: dbAccount.currency as Currency,
    country: dbAccount.country as Country,
    bankName: dbAccount.bank_name || undefined,
    accountNumber: dbAccount.account_number || undefined,
    custodian: dbAccount.custodian || undefined,
    initialBalance: dbAccount.initial_balance,
    currentBalance: dbAccount.current_balance,
    isActive: dbAccount.is_active,
    notes: dbAccount.notes || undefined,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
  };
}

function dbLineItemToLineItem(dbItem: DbLineItem): LineItem {
  return {
    id: dbItem.line_number.toString(),
    description: dbItem.description,
    quantity: dbItem.quantity,
    unitPrice: dbItem.unit_price,
    amount: dbItem.amount,
  };
}

function dbDocumentToInvoice(doc: DbDocument, invoiceData: any, items: DbLineItem[]): Invoice {
  return {
    id: doc.id,
    documentType: 'invoice',
    documentNumber: doc.document_number,
    status: doc.status as any,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    notes: doc.notes || undefined,
    items: items.map(dbLineItemToLineItem),
    customerName: invoiceData.customer_name,
    customerAddress: invoiceData.customer_address || undefined,
    customerEmail: invoiceData.customer_email || undefined,
    invoiceDate: invoiceData.invoice_date,
    dueDate: invoiceData.due_date,
    paymentTerms: invoiceData.payment_terms || undefined,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function dbDocumentToReceipt(doc: DbDocument, receiptData: any, linkedInvoiceDocumentId?: string): Receipt {
  return {
    id: doc.id,
    documentType: 'receipt',
    documentNumber: doc.document_number,
    status: doc.status as any,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: undefined, // Will be filled in by caller if needed
    notes: doc.notes || undefined,
    linkedInvoiceId: linkedInvoiceDocumentId || undefined, // DO NOT fallback to receiptData.linked_invoice_id - it's invoices.id, not documents.id
    linkedInvoiceNumber: undefined, // Will be filled in by caller if needed
    payerName: receiptData.payer_name,
    payerContact: receiptData.payer_contact || undefined,
    receiptDate: receiptData.receipt_date,
    paymentMethod: receiptData.payment_method,
    receivedBy: receiptData.received_by,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function dbDocumentToPaymentVoucher(doc: DbDocument, voucherData: any, items: DbLineItem[]): PaymentVoucher {
  return {
    id: doc.id,
    documentType: 'payment_voucher',
    documentNumber: doc.document_number,
    status: doc.status as any,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: undefined, // Will be filled in by caller if needed
    notes: doc.notes || undefined,
    items: items.map(dbLineItemToLineItem),
    payeeName: voucherData.payee_name,
    payeeAddress: voucherData.payee_address || undefined,
    payeeBankAccount: voucherData.payee_bank_account || undefined,
    payeeBankName: voucherData.payee_bank_name || undefined,
    voucherDate: voucherData.voucher_date,
    paymentDueDate: voucherData.payment_due_date || undefined,
    requestedBy: voucherData.requested_by,
    // Parse JSON string back to UserReference object, or return as string (legacy format)
    approvedBy: voucherData.approved_by
      ? (() => {
          try {
            const parsed = JSON.parse(voucherData.approved_by);
            // If it's a valid UserReference object, return it
            if (typeof parsed === 'object' && parsed.name) {
              return parsed;
            }
            // Otherwise return the original string
            return voucherData.approved_by;
          } catch {
            // Not valid JSON, return as string (legacy format)
            return voucherData.approved_by;
          }
        })()
      : undefined,
    approvalDate: voucherData.approval_date || undefined,
    supportingDocFilename: voucherData.supporting_doc_filename || undefined,
    supportingDocBase64: voucherData.supporting_doc_base64 || undefined,
    supportingDocStoragePath: voucherData.supporting_doc_storage_path || undefined,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function dbDocumentToStatementOfPayment(doc: DbDocument, statementData: any, items: DbLineItem[]): StatementOfPayment {
  return {
    id: doc.id,
    documentType: 'statement_of_payment',
    documentNumber: doc.document_number,
    status: doc.status as any,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: undefined, // Will be filled in by caller if needed
    notes: doc.notes || undefined,
    items: items.map(dbLineItemToLineItem),
    linkedVoucherId: statementData.linked_voucher_id,
    linkedVoucherNumber: undefined, // Will be filled in by caller if needed
    paymentDate: statementData.payment_date,
    paymentMethod: statementData.payment_method,
    transactionReference: statementData.transaction_reference,
    transferProofFilename: statementData.transfer_proof_filename || undefined,
    transferProofBase64: statementData.transfer_proof_base64 || undefined,
    confirmedBy: statementData.confirmed_by,
    payeeName: statementData.payee_name,
    transactionFee: statementData.transaction_fee || 0,
    transactionFeeType: statementData.transaction_fee_type || undefined,
    totalDeducted: statementData.total_deducted,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

// ============================================================================
// INVOICE PAYMENT STATUS
// ============================================================================

/**
 * Invoice payment status information
 */
export interface InvoicePaymentStatus {
  invoiceTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentCount: number;
  lastPaymentDate?: string;
  paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid';
  percentPaid: number;
}

/**
 * Invoice with payment status for receipt form
 */
export interface InvoiceWithPaymentStatus extends Invoice {
  paymentStatus: InvoicePaymentStatus;
}

/**
 * Get payment status for an invoice
 * Calculates total paid, balance due, and payment progress from linked receipts
 * @param invoiceDocumentId - The document ID of the invoice
 */
export async function getInvoicePaymentStatus(
  invoiceDocumentId: string
): Promise<InvoicePaymentStatus | null> {
  try {
    // First, get the invoice total from documents table
    const { data: invoiceDoc, error: invoiceError } = await supabase
      .from('documents')
      .select('amount, currency')
      .eq('id', invoiceDocumentId)
      .eq('document_type', 'invoice')
      .is('deleted_at', null)
      .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoiceDoc) return null;

    const invoiceTotal = invoiceDoc.amount || 0;

    // Get the invoice record to find linked receipts
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id')
      .eq('document_id', invoiceDocumentId)
      .maybeSingle();

    if (invError) throw invError;
    if (!invoice) return null;

    // Query linked receipts (non-deleted, completed)
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select(`
        id,
        documents!inner (
          id,
          amount,
          document_date,
          status,
          deleted_at
        )
      `)
      .eq('linked_invoice_id', invoice.id);

    if (receiptsError) throw receiptsError;

    // Filter and sum payments from active receipts
    let amountPaid = 0;
    let paymentCount = 0;
    let lastPaymentDate: string | undefined;

    if (receipts) {
      for (const receipt of receipts) {
        const doc = receipt.documents as any;
        // Only count non-deleted, completed receipts
        if (doc && !doc.deleted_at && (doc.status === 'completed' || doc.status === 'paid')) {
          amountPaid += doc.amount || 0;
          paymentCount++;
          if (!lastPaymentDate || doc.document_date > lastPaymentDate) {
            lastPaymentDate = doc.document_date;
          }
        }
      }
    }

    const balanceDue = invoiceTotal - amountPaid;
    const percentPaid = invoiceTotal > 0 ? Math.round((amountPaid / invoiceTotal) * 1000) / 10 : 100;

    // Determine payment status
    let paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid';
    if (amountPaid === 0) {
      paymentStatus = 'unpaid';
    } else if (amountPaid >= invoiceTotal) {
      paymentStatus = 'fully_paid';
    } else {
      paymentStatus = 'partially_paid';
    }

    return {
      invoiceTotal,
      amountPaid,
      balanceDue,
      paymentCount,
      lastPaymentDate,
      paymentStatus,
      percentPaid,
    };
  } catch (error) {
    console.error('Error getting invoice payment status:', error);
    return null;
  }
}

/**
 * Get all invoices with their payment status
 * Used by Receipt form to show remaining balance when linking to invoices
 */
export async function getInvoicesWithPaymentStatus(
  companyId?: string
): Promise<InvoiceWithPaymentStatus[]> {
  try {
    // First get all non-cancelled invoices
    const allDocs = await getDocuments(companyId);
    const activeInvoices = allDocs.filter(
      (doc): doc is Invoice =>
        doc.documentType === 'invoice' && doc.status !== 'cancelled'
    );

    // Get payment status for each invoice
    const invoicesWithStatus: InvoiceWithPaymentStatus[] = await Promise.all(
      activeInvoices.map(async (invoice) => {
        const paymentStatus = await getInvoicePaymentStatus(invoice.id);
        return {
          ...invoice,
          paymentStatus: paymentStatus || {
            invoiceTotal: invoice.total,
            amountPaid: 0,
            balanceDue: invoice.total,
            paymentCount: 0,
            paymentStatus: 'unpaid' as const,
            percentPaid: 0,
          },
        };
      })
    );

    return invoicesWithStatus;
  } catch (error) {
    console.error('Error getting invoices with payment status:', error);
    return [];
  }
}
