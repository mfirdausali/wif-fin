export type Currency = 'MYR' | 'JPY';

export type Country = 'Malaysia' | 'Japan';

export type DocumentType = 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment';

export type DocumentStatus = 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * User reference for document tracking
 * Lightweight user info embedded in documents
 */
export interface UserReference {
  id: string;
  name: string;
  username: string;
}

export interface BaseDocument {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  date: string;
  status: DocumentStatus;
  currency: Currency;
  amount: number;
  country: Country;
  accountId?: string; // Link to account
  accountName?: string; // For display
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // User tracking fields
  createdBy?: UserReference;
  updatedBy?: UserReference;
  lastModifiedAt?: string;
}

export interface Invoice extends BaseDocument {
  documentType: 'invoice';
  // Customer details
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  // Invoice specific
  invoiceDate: string;
  dueDate: string;
  items: LineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  paymentTerms?: string;
}

export interface Receipt extends BaseDocument {
  documentType: 'receipt';
  // Payer details
  payerName: string;
  payerContact?: string;
  // Receipt specific
  receiptDate: string;
  paymentMethod: string;
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  receivedBy: string;
}

export interface PaymentVoucher extends BaseDocument {
  documentType: 'payment_voucher';
  // Payee details
  payeeName: string;
  payeeAddress?: string;
  payeeBankAccount?: string;
  payeeBankName?: string;
  // Voucher specific
  voucherDate: string;
  items: LineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  requestedBy: string;
  approvedBy?: string | UserReference; // Can be string (legacy) or UserReference (new)
  approvalDate?: string;
  paymentDueDate?: string;
  // Keep purpose for backward compatibility
  purpose?: string;
}

export interface StatementOfPayment extends BaseDocument {
  documentType: 'statement_of_payment';
  // Links to payment voucher
  linkedVoucherId: string;
  linkedVoucherNumber: string;
  // Payment proof
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  transferProofFilename?: string; // File name
  transferProofBase64?: string; // Base64 encoded image for PDF embedding
  confirmedBy: string;
  payeeName: string;
  // Items from payment voucher
  items: LineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  // Transaction fees
  transactionFee?: number; // Bank/ATM/Wire transfer fees
  transactionFeeType?: string; // Type of fee (ATM Fee, Wire Transfer Fee, etc.)
  totalDeducted: number; // Total amount deducted from account (total + transactionFee)
}

export type Document = Invoice | Receipt | PaymentVoucher | StatementOfPayment;
