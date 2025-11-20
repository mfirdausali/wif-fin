/**
 * Transaction Service - Abstraction layer for recording financial impacts
 *
 * This service separates business documents from their financial effects.
 * Benefits:
 * 1. Single responsibility - documents handle workflow, this handles accounting
 * 2. Audit trail - all financial changes tracked as transactions
 * 3. Future-ready - easy to swap simple balance updates with double-entry system
 * 4. Testability - financial logic isolated and testable
 */

import { Transaction, TransactionType } from '../types/transaction';
import { Document } from '../types/document';
import { Account } from '../types/account';

export interface TransactionResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Transaction Service for managing financial impacts
 */
export class TransactionService {
  /**
   * Validates if a transaction can be executed
   */
  static validateTransaction(
    document: Document,
    account: Account | undefined
  ): ValidationResult {
    // Check if account exists
    if (!account) {
      return {
        isValid: false,
        error: 'Account not found'
      };
    }

    // Check currency matching
    if (document.currency !== account.currency) {
      return {
        isValid: false,
        error: `Currency mismatch: Document is ${document.currency} but account is ${account.currency}`
      };
    }

    // Check sufficient balance for payments
    if (document.documentType === 'statement_of_payment') {
      const sop = document as any;
      const amountToDeduct = sop.totalDeducted || document.amount;
      if (account.currentBalance < amountToDeduct) {
        return {
          isValid: false,
          error: `Insufficient balance: Account has ${account.currency} ${account.currentBalance.toFixed(2)} but payment requires ${document.currency} ${amountToDeduct.toFixed(2)}`
        };
      }
    }

    // Check if document status allows transaction
    if (!this.shouldAffectAccount(document)) {
      return {
        isValid: false,
        error: 'Document status does not allow account impact'
      };
    }

    return { isValid: true };
  }

  /**
   * Determines if a document should affect accounts based on its type and status
   *
   * Rules (Cash Basis):
   * - Invoice: Never affects accounts (documentation only)
   * - Receipt: Affects accounts when status = 'completed'
   * - Payment Voucher: Never affects accounts (authorization only)
   * - Statement of Payment: Affects accounts when status = 'completed'
   */
  static shouldAffectAccount(document: Document): boolean {
    switch (document.documentType) {
      case 'invoice':
        return false; // Invoices don't affect cash accounts

      case 'receipt':
        return document.status === 'completed';

      case 'payment_voucher':
        return false; // PV is just authorization, SOP does the actual payment

      case 'statement_of_payment':
        return document.status === 'completed';

      default:
        return false;
    }
  }

  /**
   * Calculates the balance change for an account from a document
   */
  static calculateBalanceChange(document: Document): number {
    if (!this.shouldAffectAccount(document)) {
      return 0;
    }

    switch (document.documentType) {
      case 'receipt':
        return document.amount; // Increase balance

      case 'statement_of_payment':
        const sop = document as any;
        // Use totalDeducted to include transaction fees
        const amountToDeduct = sop.totalDeducted || document.amount;
        return -amountToDeduct; // Decrease balance

      default:
        return 0;
    }
  }

  /**
   * Gets the transaction type for a document
   */
  static getTransactionType(document: Document): TransactionType | null {
    if (!this.shouldAffectAccount(document)) {
      return null;
    }

    switch (document.documentType) {
      case 'receipt':
        return 'increase';

      case 'statement_of_payment':
        return 'decrease';

      default:
        return null;
    }
  }

  /**
   * Creates a transaction record for audit trail
   */
  static createTransaction(
    document: Document,
    accountId: string
  ): Transaction | null {
    const transactionType = this.getTransactionType(document);

    if (!transactionType) {
      return null;
    }

    // Only receipt and statement_of_payment create transactions
    if (document.documentType !== 'receipt' && document.documentType !== 'statement_of_payment') {
      return null;
    }

    // For Statement of Payment, use totalDeducted to include transaction fees
    let transactionAmount = document.amount;
    if (document.documentType === 'statement_of_payment') {
      const sop = document as any;
      transactionAmount = sop.totalDeducted || document.amount;
    }

    return {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId: document.id,
      documentType: document.documentType,
      accountId: accountId,
      amount: transactionAmount,
      type: transactionType,
      timestamp: new Date().toISOString(),
      status: 'posted',
      metadata: {
        description: this.getTransactionDescription(document),
        reference: document.documentNumber,
        linkedDocumentId: this.getLinkedDocumentId(document),
      }
    };
  }

  /**
   * Helper: Generate transaction description
   */
  private static getTransactionDescription(document: Document): string {
    switch (document.documentType) {
      case 'receipt':
        const receipt = document as any;
        return `Payment received from ${receipt.payer}`;

      case 'statement_of_payment':
        const sop = document as any;
        return `Payment made to ${sop.payee || 'vendor'}`;

      default:
        return 'Transaction';
    }
  }

  /**
   * Helper: Get linked document ID if any
   */
  private static getLinkedDocumentId(document: Document): string | undefined {
    if (document.documentType === 'receipt') {
      return (document as any).linkedInvoiceId;
    }
    if (document.documentType === 'statement_of_payment') {
      return (document as any).linkedVoucherId;
    }
    return undefined;
  }

  /**
   * Apply transaction to account balance
   * This is where the actual balance update happens
   */
  static applyTransaction(
    account: Account,
    document: Document
  ): Account {
    const balanceChange = this.calculateBalanceChange(document);

    if (balanceChange === 0) {
      return account;
    }

    return {
      ...account,
      currentBalance: account.currentBalance + balanceChange,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Reverse transaction (for edits and deletions)
   */
  static reverseTransaction(
    account: Account,
    document: Document
  ): Account {
    const balanceChange = this.calculateBalanceChange(document);

    if (balanceChange === 0) {
      return account;
    }

    // Reverse the effect: negate the balance change
    return {
      ...account,
      currentBalance: account.currentBalance - balanceChange,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Future: Double-Entry Transaction Service
 * Uncomment and implement when migrating to full accounting
 */

// export class DoubleEntryTransactionService extends TransactionService {
//   static createJournalEntries(document: Document): JournalEntry[] {
//     // Receipt with invoice: Dr. Cash, Cr. Accounts Receivable
//     // Receipt without invoice: Dr. Cash, Cr. Revenue
//     // Statement of Payment: Dr. Expense, Cr. Cash
//     // etc.
//   }
//
//   static postJournalEntries(entries: JournalEntry[], accounts: Account[]): Account[] {
//     // Post to general ledger
//     // Validate debits = credits
//     // Update multiple account balances
//   }
// }
