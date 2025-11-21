/**
 * Data Migration Service
 *
 * Handles one-time migration of data from localStorage to Supabase
 * and provides utilities for data synchronization
 */

import { Document } from '../types/document';
import { Account } from '../types/account';
import {
  getOrCreateDefaultCompany,
  createAccount,
  createDocument,
  getAccounts,
  getDocuments,
  CompanyInfo
} from './supabaseService';

const DOCUMENTS_STORAGE_KEY = 'malaysia_japan_documents';
const ACCOUNTS_STORAGE_KEY = 'malaysia_japan_accounts';
const MIGRATION_STATUS_KEY = 'wif_migration_status';

export interface MigrationStatus {
  hasLocalData: boolean;
  migrationCompleted: boolean;
  migratedAt?: string;
  accountsCount: number;
  documentsCount: number;
  errors: string[];
}

export interface MigrationResult {
  success: boolean;
  accountsMigrated: number;
  documentsMigrated: number;
  errors: string[];
  companyId: string;
}

/**
 * Check if user has local data that needs migration
 */
export function checkLocalData(): MigrationStatus {
  const status: MigrationStatus = {
    hasLocalData: false,
    migrationCompleted: false,
    accountsCount: 0,
    documentsCount: 0,
    errors: []
  };

  try {
    // Check for migration status
    const migrationStatus = localStorage.getItem(MIGRATION_STATUS_KEY);
    if (migrationStatus) {
      const parsed = JSON.parse(migrationStatus);
      status.migrationCompleted = parsed.completed || false;
      status.migratedAt = parsed.migratedAt;
    }

    // Check for local documents
    const documentsStr = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (documentsStr) {
      const documents = JSON.parse(documentsStr);
      if (Array.isArray(documents) && documents.length > 0) {
        status.hasLocalData = true;
        status.documentsCount = documents.length;
      }
    }

    // Check for local accounts
    const accountsStr = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (accountsStr) {
      const accounts = JSON.parse(accountsStr);
      if (Array.isArray(accounts) && accounts.length > 0) {
        status.hasLocalData = true;
        status.accountsCount = accounts.length;
      }
    }
  } catch (error) {
    status.errors.push(`Error checking local data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return status;
}

/**
 * Migrate data from localStorage to Supabase
 */
export async function migrateLocalDataToSupabase(
  companyInfo?: CompanyInfo
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    accountsMigrated: 0,
    documentsMigrated: 0,
    errors: [],
    companyId: ''
  };

  try {
    console.log('=== Starting Migration to Supabase ===');

    // 1. Get or create company
    console.log('Step 1: Getting/creating company...');
    const company = await getOrCreateDefaultCompany(companyInfo);
    result.companyId = company.id;
    console.log('✓ Company ID:', company.id);

    // 2. Load local data
    console.log('Step 2: Loading local data...');
    const documentsStr = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    const accountsStr = localStorage.getItem(ACCOUNTS_STORAGE_KEY);

    let localDocuments: Document[] = [];
    let localAccounts: Account[] = [];

    if (documentsStr) {
      localDocuments = JSON.parse(documentsStr);
      console.log(`  Found ${localDocuments.length} local documents`);
    }

    if (accountsStr) {
      localAccounts = JSON.parse(accountsStr);
      console.log(`  Found ${localAccounts.length} local accounts`);
    }

    // 3. Migrate accounts first (documents depend on them)
    console.log('Step 3: Migrating accounts...');
    const accountIdMap = new Map<string, string>(); // old ID -> new ID

    for (const account of localAccounts) {
      try {
        const { id: oldId, createdAt, updatedAt, ...accountData } = account;
        const newAccount = await createAccount(company.id, accountData);
        accountIdMap.set(oldId, newAccount.id);
        result.accountsMigrated++;
        console.log(`  ✓ Migrated account: ${account.name} (${oldId} -> ${newAccount.id})`);
      } catch (error) {
        const errorMsg = `Failed to migrate account ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`  ✗ ${errorMsg}`);
      }
    }

    // 4. Migrate documents
    console.log('Step 4: Migrating documents...');

    // Sort documents by creation date to maintain order
    const sortedDocuments = [...localDocuments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const document of sortedDocuments) {
      try {
        // Update account ID if it was migrated
        const migratedDoc = { ...document };
        if (migratedDoc.accountId && accountIdMap.has(migratedDoc.accountId)) {
          migratedDoc.accountId = accountIdMap.get(migratedDoc.accountId);
        }

        // Remove fields that will be auto-generated
        const { id, createdAt, updatedAt, ...docData } = migratedDoc;

        await createDocument(company.id, docData as Document);
        result.documentsMigrated++;
        console.log(`  ✓ Migrated ${document.documentType}: ${document.documentNumber}`);
      } catch (error) {
        const errorMsg = `Failed to migrate ${document.documentType} ${document.documentNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`  ✗ ${errorMsg}`);
      }
    }

    // 5. Mark migration as complete
    result.success = result.errors.length === 0;

    const migrationStatus = {
      completed: true,
      migratedAt: new Date().toISOString(),
      accountsMigrated: result.accountsMigrated,
      documentsMigrated: result.documentsMigrated,
      errors: result.errors
    };

    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(migrationStatus));

    console.log('=== Migration Summary ===');
    console.log(`Accounts migrated: ${result.accountsMigrated}/${localAccounts.length}`);
    console.log(`Documents migrated: ${result.documentsMigrated}/${localDocuments.length}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Status: ${result.success ? '✓ Success' : '⚠ Completed with errors'}`);

  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('=== Migration Failed ===', error);
  }

  return result;
}

/**
 * Clear migration status (for re-migration or testing)
 */
export function clearMigrationStatus(): void {
  localStorage.removeItem(MIGRATION_STATUS_KEY);
  console.log('Migration status cleared');
}

/**
 * Backup local data before migration
 */
export function backupLocalData(): { documents: Document[]; accounts: Account[] } {
  const backup = {
    documents: [] as Document[],
    accounts: [] as Account[]
  };

  try {
    const documentsStr = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (documentsStr) {
      backup.documents = JSON.parse(documentsStr);
    }

    const accountsStr = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (accountsStr) {
      backup.accounts = JSON.parse(accountsStr);
    }

    // Create downloadable backup
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wif-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('Local data backed up successfully');
  } catch (error) {
    console.error('Failed to backup local data:', error);
  }

  return backup;
}

/**
 * Verify migration by comparing counts
 */
export async function verifyMigration(companyId: string): Promise<{
  isValid: boolean;
  message: string;
  details: {
    localAccounts: number;
    supabaseAccounts: number;
    localDocuments: number;
    supabaseDocuments: number;
  };
}> {
  try {
    // Get local data counts
    const documentsStr = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    const accountsStr = localStorage.getItem(ACCOUNTS_STORAGE_KEY);

    const localDocuments = documentsStr ? JSON.parse(documentsStr).length : 0;
    const localAccounts = accountsStr ? JSON.parse(accountsStr).length : 0;

    // Get Supabase data counts
    const supabaseAccounts = await getAccounts(companyId);
    const supabaseDocuments = await getDocuments(companyId);

    const details = {
      localAccounts,
      supabaseAccounts: supabaseAccounts.length,
      localDocuments,
      supabaseDocuments: supabaseDocuments.length
    };

    const accountsMatch = localAccounts === supabaseAccounts.length;
    const documentsMatch = localDocuments === supabaseDocuments.length;

    if (accountsMatch && documentsMatch) {
      return {
        isValid: true,
        message: 'Migration verified successfully! All data migrated.',
        details
      };
    } else {
      return {
        isValid: false,
        message: `Migration incomplete. Accounts: ${details.supabaseAccounts}/${details.localAccounts}, Documents: ${details.supabaseDocuments}/${details.localDocuments}`,
        details
      };
    }
  } catch (error) {
    return {
      isValid: false,
      message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        localAccounts: 0,
        supabaseAccounts: 0,
        localDocuments: 0,
        supabaseDocuments: 0
      }
    };
  }
}
