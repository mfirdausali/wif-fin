import { useState, useEffect } from 'react';
import { DocumentTypeSelector } from './components/DocumentTypeSelector';
import { InvoiceForm } from './components/InvoiceForm';
import { ReceiptForm } from './components/ReceiptForm';
import { PaymentVoucherForm } from './components/PaymentVoucherForm';
import { StatementOfPaymentForm } from './components/StatementOfPaymentForm';
import { DocumentList } from './components/DocumentList';
import { AccountManagement } from './components/AccountManagement';
import { AccountBalanceSheet } from './components/AccountBalanceSheet';
import { Settings, CompanyInfo, saveCompanyInfo } from './components/Settings';
import { Onboarding } from './components/Onboarding';
import { LoginScreen } from './components/auth/LoginScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Document, DocumentType, Invoice, Receipt, PaymentVoucher, StatementOfPayment, Currency } from './types/document';
import { Account, AccountType } from './types/account';
import { LoginCredentials } from './types/auth';
import { TransactionService } from './services/transactionService';
import { logAuthEvent, logDocumentEvent } from './services/activityLogService';
import { canCreateDocuments, canEditDocument, canDeleteDocument } from './utils/permissions';
import { hasPermission } from './services/userService';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Download, Trash2, ArrowLeft, Info, Settings as SettingsIcon, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './components/ui/alert-dialog';

const DOCUMENTS_STORAGE_KEY = 'malaysia_japan_documents';
const ACCOUNTS_STORAGE_KEY = 'malaysia_japan_accounts';
const ONBOARDING_STORAGE_KEY = 'wif_onboarding_completed';

// Migration function to convert old documents to new format
function migrateDocuments(documents: Document[]): Document[] {
  console.log('Starting document migration...');
  let migrationCount = 0;

  // First pass: Migrate payment vouchers
  const migratedDocs = documents.map(doc => {
    // Migrate payment vouchers: add items array
    if (doc.documentType === 'payment_voucher') {
      const pv = doc as PaymentVoucher;

      // Check if this is an old format voucher (has purpose but no items)
      if (pv.purpose && (!pv.items || pv.items.length === 0)) {
        console.log('✓ Migrating payment voucher:', pv.documentNumber);
        migrationCount++;

        // Convert old purpose into a single line item
        return {
          ...pv,
          items: [{
            id: '1',
            description: pv.purpose,
            quantity: 1,
            unitPrice: pv.amount,
            amount: pv.amount
          }],
          subtotal: pv.amount,
          total: pv.amount,
          // Keep purpose for backward compatibility
          purpose: pv.purpose
        } as PaymentVoucher;
      }
    }

    return doc;
  });

  // Second pass: Migrate statements of payment (after vouchers are migrated)
  const finalDocs = migratedDocs.map(doc => {
    if (doc.documentType === 'statement_of_payment') {
      const sop = doc as StatementOfPayment;
      let needsMigration = false;
      let updatedSop = { ...sop };

      // Check if linkedVoucherNumber is missing or is an internal ID
      if (sop.linkedVoucherId && (!sop.linkedVoucherNumber || sop.linkedVoucherNumber.startsWith('DOC-'))) {
        console.log('✓ Migrating statement of payment linkedVoucherNumber:', sop.documentNumber, 'LinkedVoucherId:', sop.linkedVoucherId);

        // Find the linked voucher to get its document number
        const linkedVoucher = migratedDocs.find(d => d.id === sop.linkedVoucherId) as PaymentVoucher;

        if (linkedVoucher) {
          console.log('  → Found linked voucher:', linkedVoucher.documentNumber);
          updatedSop.linkedVoucherNumber = linkedVoucher.documentNumber;
          needsMigration = true;
        } else {
          console.warn('  ⚠ Could not find linked voucher with ID:', sop.linkedVoucherId);
        }
      }

      // Check if items are missing
      if (!sop.items || sop.items.length === 0) {
        console.log('✓ Migrating statement of payment items:', sop.documentNumber);

        // Find the linked voucher to get its items
        const linkedVoucher = migratedDocs.find(d => d.id === sop.linkedVoucherId) as PaymentVoucher;

        if (linkedVoucher && linkedVoucher.items && linkedVoucher.items.length > 0) {
          console.log('  → Adding items from linked voucher');
          updatedSop.items = linkedVoucher.items;
          updatedSop.subtotal = linkedVoucher.subtotal;
          updatedSop.taxRate = linkedVoucher.taxRate;
          updatedSop.taxAmount = linkedVoucher.taxAmount;
          updatedSop.total = linkedVoucher.total;
          needsMigration = true;
        }
      }

      if (needsMigration) {
        migrationCount++;
        return updatedSop as StatementOfPayment;
      }
    }

    return doc;
  });

  console.log(`Migration complete. ${migrationCount} document(s) migrated.`);
  return finalDocs;
}

// Main app content (requires authentication)
function AppContent() {
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Track if data has been loaded from storage to prevent overwriting on mount
  const [dataLoaded, setDataLoaded] = useState(false);

  // Handle logout
  const handleLogout = () => {
    if (user) {
      logAuthEvent('auth:logout', user);
    }
    logout();
    toast.info('Logged out successfully');
  };

  // Load documents from localStorage on mount
  useEffect(() => {
    console.log('=== Loading Data from LocalStorage ===');
    const stored = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (stored) {
      try {
        const loadedDocs = JSON.parse(stored);
        console.log('Loaded documents from storage:', loadedDocs.length);

        // Migrate old documents (payment vouchers and statements of payment)
        const migratedDocs = migrateDocuments(loadedDocs);
        setDocuments(migratedDocs);

        // Always save after migration to ensure changes persist
        localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(migratedDocs));
        console.log('✓ Documents saved to localStorage');
      } catch (error) {
        console.error('Failed to load documents:', error);
      }
    }
  }, []);

  // Load accounts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    let loadedAccounts: Account[] = [];

    if (stored) {
      try {
        loadedAccounts = JSON.parse(stored);
        console.log('Loaded accounts from storage:', loadedAccounts.length);
      } catch (error) {
        console.error('Failed to load accounts:', error);
      }
    }

    // Auto-recover accounts if missing but documents reference them
    if (loadedAccounts.length === 0 && documents.some(doc => doc.accountId)) {
      console.log('=== Auto-recovering Accounts from Documents ===');

      // Find all unique account IDs and names from documents
      const accountMap = new Map<string, { id: string; name: string; currency: Currency; country: 'Malaysia' | 'Japan' }>();

      documents.forEach(doc => {
        if (doc.accountId && doc.accountName) {
          if (!accountMap.has(doc.accountId)) {
            accountMap.set(doc.accountId, {
              id: doc.accountId,
              name: doc.accountName,
              currency: doc.currency,
              country: doc.country,
            });
          }
        }
      });

      if (accountMap.size > 0) {
        // Create recovered accounts with inferred initial balances
        const recoveredAccounts: Account[] = Array.from(accountMap.values()).map(info => ({
          id: info.id,
          name: info.name,
          type: 'main_bank' as AccountType,
          currency: info.currency,
          country: info.country,
          initialBalance: 0,
          currentBalance: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        // Calculate net change from all transactions for each account
        const accountNetChanges = new Map<string, number>();

        documents.forEach(doc => {
          if (doc.accountId && TransactionService.shouldAffectAccount(doc)) {
            const netChange = accountNetChanges.get(doc.accountId) || 0;
            const balanceChange = TransactionService.calculateBalanceChange(doc);
            accountNetChanges.set(doc.accountId, netChange + balanceChange);
            console.log(`Transaction: ${doc.documentType} ${doc.documentNumber}: ${balanceChange > 0 ? '+' : ''}${balanceChange}`);
          }
        });

        // For each recovered account, infer initial balance
        recoveredAccounts.forEach(acc => {
          const netChange = accountNetChanges.get(acc.id) || 0;

          // Try to find the first document to infer when account was created
          const firstDoc = documents
            .filter(d => d.accountId === acc.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

          if (firstDoc) {
            // If first document is a receipt, assume it was added to an existing balance
            // If first document is a payment, the initial balance must have been higher
            // For simplicity, we'll just set initial balance to make current balance match the last transaction

            // Find the last completed transaction balance
            const completedDocs = documents
              .filter(doc => doc.accountId === acc.id && TransactionService.shouldAffectAccount(doc))
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            if (completedDocs.length > 0) {
              // Infer that the initial balance should make the math work out
              // currentBalance = initialBalance + netChange
              // Therefore: initialBalance = currentBalance - netChange
              // But we need to get currentBalance from somewhere...

              // Actually, let's just set initialBalance = 0 and currentBalance = netChange
              // This is safer than guessing
              acc.initialBalance = 0;
              acc.currentBalance = netChange;
              console.log(`Account ${acc.name}: initial=0, net=${netChange}, current=${acc.currentBalance}`);
            }
          }
        });

        loadedAccounts = recoveredAccounts;
        console.log('✓ Auto-recovered accounts:', recoveredAccounts.length);
        toast.warning('Accounts recovered with estimated balances', {
          description: 'Please verify balances are correct. Initial balances set to 0.',
        });
      }
    }

    // Validate and fix account balances
    if (loadedAccounts.length > 0) {
      console.log('=== Validating Account Balances ===');
      let balancesFixed = false;

      loadedAccounts.forEach(acc => {
        // Calculate what the balance should be based on transactions
        let calculatedBalance = acc.initialBalance;

        documents.forEach(doc => {
          if (doc.accountId === acc.id && TransactionService.shouldAffectAccount(doc)) {
            const balanceChange = TransactionService.calculateBalanceChange(doc);
            calculatedBalance += balanceChange;
          }
        });

        // Check if current balance matches calculated balance
        if (Math.abs(acc.currentBalance - calculatedBalance) > 0.01) {
          console.log(`⚠ Balance mismatch for ${acc.name}:`);
          console.log(`  Stored: ${acc.currentBalance}`);
          console.log(`  Calculated: ${calculatedBalance}`);
          console.log(`  Fixing...`);

          acc.currentBalance = calculatedBalance;
          acc.updatedAt = new Date().toISOString();
          balancesFixed = true;
        } else {
          console.log(`✓ ${acc.name} balance correct: ${acc.currentBalance}`);
        }
      });

      if (balancesFixed) {
        toast.success('Account balances corrected', {
          description: 'Balances have been recalculated to match transactions',
        });
      }
    }

    setAccounts(loadedAccounts);

    // Mark data as loaded after attempting to load both documents and accounts
    setDataLoaded(true);
    console.log('✓ Data loading complete');
  }, [documents]);

  // Check if onboarding should be shown
  useEffect(() => {
    if (!dataLoaded) return;

    const onboardingCompleted = localStorage.getItem(ONBOARDING_STORAGE_KEY);

    // Show onboarding if:
    // 1. Never completed before AND
    // 2. No documents exist AND
    // 3. No accounts exist
    if (!onboardingCompleted && documents.length === 0 && accounts.length === 0) {
      console.log('=== Showing Onboarding ===');
      setShowOnboarding(true);
    }
  }, [dataLoaded, documents.length, accounts.length]);

  // Save documents to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (dataLoaded) {
      localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
      console.log('Documents saved to localStorage:', documents.length, 'documents');
    }
  }, [documents, dataLoaded]);

  // Save accounts to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (dataLoaded) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      console.log('Accounts saved to localStorage:', accounts.length, 'accounts');
    }
  }, [accounts, dataLoaded]);

  const handleDocumentCreated = (document: Document) => {
    // If editing, update the existing document
    if (editingDocument) {
      handleDocumentUpdated(document);
      return;
    }

    // Validate transaction if document affects accounts
    if (document.accountId && TransactionService.shouldAffectAccount(document)) {
      const account = accounts.find(acc => acc.id === document.accountId);
      const validation = TransactionService.validateTransaction(document, account);

      if (!validation.isValid) {
        toast.error('Transaction validation failed', {
          description: validation.error,
        });
        return;
      }
    }

    // Add document to list
    setDocuments(prev => [...prev, document]);

    // Update account balances using Transaction Service
    if (document.accountId && TransactionService.shouldAffectAccount(document)) {
      console.log('=== Applying Transaction ===');
      console.log('Document:', document.documentType, document.documentNumber);
      console.log('Account ID:', document.accountId);
      console.log('Amount:', document.amount);
      if (document.documentType === 'statement_of_payment') {
        console.log('Total Deducted:', document.totalDeducted);
      }
      console.log('Should affect account:', TransactionService.shouldAffectAccount(document));

      setAccounts(prev => {
        const updated = prev.map(acc => {
          if (acc.id === document.accountId) {
            console.log('Before balance:', acc.currentBalance);
            const newAcc = TransactionService.applyTransaction(acc, document);
            console.log('After balance:', newAcc.currentBalance);
            console.log('Balance change:', newAcc.currentBalance - acc.currentBalance);
            return newAcc;
          }
          return acc;
        });
        console.log('Updated accounts:', updated);
        return updated;
      });
    } else {
      console.log('=== Transaction NOT Applied ===');
      console.log('Document:', document.documentType, document.documentNumber);
      console.log('Has account ID:', !!document.accountId);
      console.log('Should affect account:', TransactionService.shouldAffectAccount(document));
    }

    // Update related documents
    if (document.documentType === 'receipt' && document.linkedInvoiceId) {
      // Mark invoice as paid
      setDocuments(prev => prev.map(doc =>
        doc.id === document.linkedInvoiceId && doc.documentType === 'invoice'
          ? { ...doc, status: 'paid' as const }
          : doc
      ));
    }

    if (document.documentType === 'statement_of_payment') {
      // Mark payment voucher as completed
      setDocuments(prev => prev.map(doc =>
        doc.id === document.linkedVoucherId && doc.documentType === 'payment_voucher'
          ? { ...doc, status: 'completed' as const }
          : doc
      ));
    }

    const typeLabels = {
      invoice: 'Invoice',
      receipt: 'Receipt',
      payment_voucher: 'Payment Voucher',
      statement_of_payment: 'Statement of Payment',
    };

    toast.success(`${typeLabels[document.documentType]} created successfully`, {
      description: `${document.documentNumber} - ${document.currency} ${document.amount.toFixed(2)}`,
    });

    // Log activity
    if (user) {
      logDocumentEvent('document:created', user, document);
    }

    setSelectedType(null);
    setEditingDocument(null);
  };

  const handleDocumentUpdated = (updatedDocument: Document) => {
    if (!editingDocument) return;

    // Validate transaction if updated document affects accounts
    if (updatedDocument.accountId && TransactionService.shouldAffectAccount(updatedDocument)) {
      const account = accounts.find(acc => acc.id === updatedDocument.accountId);
      const validation = TransactionService.validateTransaction(updatedDocument, account);

      if (!validation.isValid) {
        toast.error('Transaction validation failed', {
          description: validation.error,
        });
        return;
      }
    }

    // Update account balances - reverse old and apply new using Transaction Service
    if (editingDocument.accountId || updatedDocument.accountId) {
      setAccounts(prev => prev.map(acc => {
        let updatedAcc = acc;

        // Reverse old document's effect
        if (acc.id === editingDocument.accountId && TransactionService.shouldAffectAccount(editingDocument)) {
          updatedAcc = TransactionService.reverseTransaction(updatedAcc, editingDocument);
        }

        // Apply new document's effect
        if (updatedAcc.id === updatedDocument.accountId && TransactionService.shouldAffectAccount(updatedDocument)) {
          updatedAcc = TransactionService.applyTransaction(updatedAcc, updatedDocument);
        }

        return updatedAcc;
      }));
    }

    // Update the document in the list
    setDocuments(prev => prev.map(doc =>
      doc.id === editingDocument.id ? { ...updatedDocument, id: editingDocument.id, updatedAt: new Date().toISOString() } : doc
    ));

    const typeLabels = {
      invoice: 'Invoice',
      receipt: 'Receipt',
      payment_voucher: 'Payment Voucher',
      statement_of_payment: 'Statement of Payment',
    };

    toast.success(`${typeLabels[updatedDocument.documentType]} updated successfully`, {
      description: `${updatedDocument.documentNumber}`,
    });

    // Log activity
    if (user) {
      logDocumentEvent('document:updated', user, updatedDocument);
    }

    setSelectedType(null);
    setEditingDocument(null);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(documents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `documents_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Documents exported successfully');
  };

  const handleAddAccount = (account: Account) => {
    setAccounts(prev => [...prev, account]);
    toast.success('Account added successfully', {
      description: `${account.name} - ${account.currency}`,
    });
  };

  const handleClearAll = () => {
    setDocuments([]);
    localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    toast.info('All documents cleared');
  };

  const handleEditDocument = (document: Document) => {
    // Check permission
    if (!user || !canEditDocument(user, document)) {
      toast.error('Access denied', {
        description: 'You do not have permission to edit this document'
      });
      return;
    }
    setEditingDocument(document);
    setSelectedType(document.documentType);
  };

  const handleDeleteDocument = (documentId: string) => {
    const docToDelete = documents.find(doc => doc.id === documentId);
    if (!docToDelete) return;

    // Check permission
    if (!user || !canDeleteDocument(user, docToDelete)) {
      toast.error('Access denied', {
        description: 'You do not have permission to delete this document'
      });
      return;
    }

    // Update account balance if document affected accounts (using Transaction Service)
    if (docToDelete.accountId && TransactionService.shouldAffectAccount(docToDelete)) {
      setAccounts(prev => prev.map(acc => {
        if (acc.id === docToDelete.accountId) {
          return TransactionService.reverseTransaction(acc, docToDelete);
        }
        return acc;
      }));
    }

    // Update related documents
    if (docToDelete.documentType === 'receipt' && docToDelete.linkedInvoiceId) {
      // Mark invoice back to issued status
      setDocuments(prev => prev.map(doc =>
        doc.id === docToDelete.linkedInvoiceId && doc.documentType === 'invoice'
          ? { ...doc, status: 'issued' as const }
          : doc
      ));
    }

    if (docToDelete.documentType === 'statement_of_payment' && docToDelete.linkedVoucherId) {
      // Mark payment voucher back to issued status
      setDocuments(prev => prev.map(doc =>
        doc.id === docToDelete.linkedVoucherId && doc.documentType === 'payment_voucher'
          ? { ...doc, status: 'issued' as const }
          : doc
      ));
    }

    // Delete the document
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));

    const typeLabels = {
      invoice: 'Invoice',
      receipt: 'Receipt',
      payment_voucher: 'Payment Voucher',
      statement_of_payment: 'Statement of Payment',
    };

    toast.success(`${typeLabels[docToDelete.documentType]} deleted`, {
      description: docToDelete.documentNumber,
    });

    // Log activity
    if (user) {
      logDocumentEvent('document:deleted', user, docToDelete);
    }
  };

  const getInvoices = (): Invoice[] => {
    return documents.filter(doc => doc.documentType === 'invoice') as Invoice[];
  };

  const getPaymentVouchers = (): PaymentVoucher[] => {
    return documents.filter(doc => doc.documentType === 'payment_voucher') as PaymentVoucher[];
  };

  const getDocumentStats = () => {
    const invoices = documents.filter(d => d.documentType === 'invoice');
    const receipts = documents.filter(d => d.documentType === 'receipt');
    const vouchers = documents.filter(d => d.documentType === 'payment_voucher');
    const statements = documents.filter(d => d.documentType === 'statement_of_payment');

    return {
      invoices: { count: invoices.length, paid: invoices.filter(d => d.status === 'paid').length },
      receipts: { count: receipts.length },
      vouchers: { count: vouchers.length, completed: vouchers.filter(d => d.status === 'completed').length },
      statements: { count: statements.length },
    };
  };

  const stats = getDocumentStats();

  const handleOnboardingComplete = (companyInfo: CompanyInfo, firstAccount: Account | null) => {
    // Save company info
    saveCompanyInfo(companyInfo);

    // Add first account if created
    if (firstAccount) {
      setAccounts([firstAccount]);
      toast.success('Account created successfully', {
        description: `${firstAccount.name} - ${firstAccount.currency}`,
      });
    }

    // Mark onboarding as completed
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setShowOnboarding(false);

    toast.success('Welcome to WIF Finance System!', {
      description: 'Setup completed successfully',
    });
  };

  const handleOnboardingSkip = () => {
    // Mark onboarding as completed (skipped)
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setShowOnboarding(false);

    toast.info('Onboarding skipped', {
      description: 'You can access settings anytime from the top menu',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />

      {/* Onboarding Flow */}
      {showOnboarding && (
        <Onboarding
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl">WIF JAPAN Finance Department</h1>
              <p className="text-gray-600 mt-1">
                Invoice • Receipt • Payment Voucher • Statement of Payment
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* User Info */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border mr-2">
                <User className="w-4 h-4 text-gray-600" />
                <div className="text-sm">
                  <div className="font-medium">{user?.fullName}</div>
                  <div className="text-xs text-gray-500">{user?.role}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={documents.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={documents.length === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Documents?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All {documents.length} document{documents.length !== 1 ? 's' : ''} will be permanently deleted from local storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showSettings ? (
          <Settings onBack={() => setShowSettings(false)} />
        ) : (
          <>
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Invoices</div>
              <div className="text-2xl">{stats.invoices.count}</div>
              <div className="text-xs text-green-600 mt-1">
                {stats.invoices.paid} paid
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Receipts</div>
              <div className="text-2xl">{stats.receipts.count}</div>
              <div className="text-xs text-gray-500 mt-1">Payments received</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Payment Vouchers</div>
              <div className="text-2xl">{stats.vouchers.count}</div>
              <div className="text-xs text-orange-600 mt-1">
                {stats.vouchers.completed} completed
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Statements</div>
              <div className="text-2xl">{stats.statements.count}</div>
              <div className="text-xs text-purple-600 mt-1">Payment proofs</div>
            </CardContent>
          </Card>
        </div>

        {selectedType === null ? (
          <Tabs defaultValue="documents" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
            </TabsList>
            
            <TabsContent value="documents" className="space-y-6">
              {/* Document Type Selection - Only for users with create permission */}
              {user && canCreateDocuments(user) && (
                <div>
                  <h2 className="mb-4">Create New Document</h2>
                  <DocumentTypeSelector
                    selectedType={selectedType}
                    onSelectType={setSelectedType}
                  />
                </div>
              )}

              {/* Read-only notice for Viewers */}
              {user && !canCreateDocuments(user) && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Read-Only Access</AlertTitle>
                  <AlertDescription>
                    You have view and print access to documents. Contact an administrator if you need to create or edit documents.
                  </AlertDescription>
                </Alert>
              )}

              {/* Document List */}
              <DocumentList
                documents={documents}
                onEdit={user && hasPermission(user, 'documents:edit') ? handleEditDocument : undefined}
                onDelete={user && hasPermission(user, 'documents:delete') ? handleDeleteDocument : undefined}
              />
            </TabsContent>
            
            <TabsContent value="accounts" className="space-y-6">
              {selectedAccount ? (
                <AccountBalanceSheet
                  account={selectedAccount}
                  documents={documents}
                  onBack={() => setSelectedAccount(null)}
                />
              ) : (
                <>
                  {/* Read-only notice for Viewers */}
                  {user && !hasPermission(user, 'accounts:create') && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Read-Only Access</AlertTitle>
                      <AlertDescription>
                        You have view access to accounts. Contact an administrator if you need to create or edit accounts.
                      </AlertDescription>
                    </Alert>
                  )}
                  <AccountManagement
                    accounts={accounts}
                    onAddAccount={user && hasPermission(user, 'accounts:create') ? handleAddAccount : undefined}
                    onAccountClick={(account) => setSelectedAccount(account)}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedType(null);
                setEditingDocument(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Document Selection
            </Button>

            {selectedType === 'invoice' && (
              <InvoiceForm
                accounts={accounts}
                onSubmit={handleDocumentCreated}
                onCancel={() => {
                  setSelectedType(null);
                  setEditingDocument(null);
                }}
                initialData={editingDocument && editingDocument.documentType === 'invoice' ? editingDocument as Invoice : undefined}
              />
            )}
            {selectedType === 'receipt' && (
              <ReceiptForm
                invoices={getInvoices()}
                accounts={accounts}
                onSubmit={handleDocumentCreated}
                onCancel={() => {
                  setSelectedType(null);
                  setEditingDocument(null);
                }}
                initialData={editingDocument && editingDocument.documentType === 'receipt' ? editingDocument as Receipt : undefined}
              />
            )}
            {selectedType === 'payment_voucher' && (
              <PaymentVoucherForm
                accounts={accounts}
                onSubmit={handleDocumentCreated}
                onCancel={() => {
                  setSelectedType(null);
                  setEditingDocument(null);
                }}
                initialData={editingDocument && editingDocument.documentType === 'payment_voucher' ? editingDocument as PaymentVoucher : undefined}
              />
            )}
            {selectedType === 'statement_of_payment' && (
              <StatementOfPaymentForm
                paymentVouchers={getPaymentVouchers()}
                accounts={accounts}
                onSubmit={handleDocumentCreated}
                onCancel={() => {
                  setSelectedType(null);
                  setEditingDocument(null);
                }}
                initialData={editingDocument && editingDocument.documentType === 'statement_of_payment' ? editingDocument as StatementOfPayment : undefined}
              />
            )}
          </div>
        )}

        {/* Information Panel */}
        {selectedType === null && (
          <Alert className="mt-8">
            <Info className="h-4 w-4" />
            <AlertTitle>Cash-Basis Accounting System</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                <div>
                  <strong>Document Workflow:</strong>
                  <ul className="ml-4 mt-1 space-y-1 text-sm">
                    <li>• <strong>Invoice → Receipt:</strong> Invoice = documentation only. Receipt (completed) = cash received (+balance)</li>
                    <li>• <strong>Payment Voucher → Statement of Payment:</strong> PV = authorization only. SOP (completed) = cash paid (-balance)</li>
                  </ul>
                </div>
                <div>
                  <strong>Account Impact Rules:</strong>
                  <ul className="ml-4 mt-1 space-y-1 text-sm">
                    <li>• Only documents with status "completed" affect account balances</li>
                    <li>• Currency validation ensures document matches account currency</li>
                    <li>• Sufficient balance checked before payments</li>
                  </ul>
                </div>
                <div>
                  <strong>Future-Ready Architecture:</strong> Built with Transaction Service layer to easily migrate to full double-entry bookkeeping when needed
                </div>
                <div className="pt-2 mt-2 border-t">
                  ✅ Cash-basis tracking • Balance validation • Currency matching • Document linking • Audit trail ready
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
          </>
        )}
      </div>
    </div>
  );
}

// Main App with authentication
export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

// Authentication wrapper
function AppWithAuth() {
  const { isAuthenticated, isLoading, isFirstTime, login, setupAdmin } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle login
  const handleLogin = async (credentials: LoginCredentials) => {
    setLoginError(null);
    setIsSubmitting(true);

    try {
      await login(credentials);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle initial admin setup
  const handleSetupAdmin = async (username: string, email: string, fullName: string, password: string) => {
    setLoginError(null);
    setIsSubmitting(true);

    try {
      await setupAdmin(username, email, fullName, password);
      toast.success('Administrator account created successfully!');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSetupAdmin={handleSetupAdmin}
        isFirstTime={isFirstTime}
        error={loginError}
        isLoading={isSubmitting}
      />
    );
  }

  // Show main app if authenticated
  return <AppContent />;
}
