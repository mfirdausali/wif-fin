import { Currency, Country } from './document';

export type AccountType = 'main_bank' | 'petty_cash';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  country: Country;
  // For main bank accounts
  bankName?: string;
  accountNumber?: string;
  // For petty cash
  custodian?: string; // Person holding the petty cash
  // Balance tracking
  initialBalance: number;
  currentBalance: number;
  // Metadata
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface AccountTransaction {
  accountId: string;
  documentId: string;
  documentNumber: string;
  documentType: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  currency: Currency;
}
