/**
 * Transaction types for financial recording
 * This abstraction layer prepares the system for future double-entry bookkeeping migration
 */

export type TransactionType = 'increase' | 'decrease';
export type TransactionStatus = 'posted' | 'reversed';

/**
 * Current implementation: Simple cash-basis transaction
 * Future: Can be extended to journal entries with debit/credit
 */
export interface Transaction {
  id: string;
  documentId: string;
  documentType: 'receipt' | 'statement_of_payment';
  accountId: string;
  amount: number;
  type: TransactionType;
  timestamp: string;
  status: TransactionStatus;
  metadata?: {
    description?: string;
    reference?: string;
    linkedDocumentId?: string;
  };
}

/**
 * Future double-entry structure (for reference)
 * Uncomment and use when migrating to full accounting system
 */
// export interface JournalEntry {
//   accountId: string;
//   accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
//   debit: number;
//   credit: number;
//   description: string;
// }

// export interface DoubleEntryTransaction extends Omit<Transaction, 'type' | 'accountId'> {
//   journalEntries: JournalEntry[];
//   isBalanced: boolean; // sum(debits) === sum(credits)
// }
