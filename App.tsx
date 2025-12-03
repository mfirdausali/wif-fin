import { useState, useEffect } from 'react';
import { DocumentTypeSelector } from './components/DocumentTypeSelector';
import { InvoiceForm } from './components/InvoiceForm';
import { ReceiptForm } from './components/ReceiptForm';
import { PaymentVoucherForm } from './components/PaymentVoucherForm';
import { StatementOfPaymentForm } from './components/StatementOfPaymentForm';
import { DocumentList } from './components/DocumentList';
import { AccountManagement } from './components/AccountManagement';
import { AccountBalanceSheet } from './components/AccountBalanceSheet';
import { BookingManagement } from './components/BookingManagement';
import { Settings, CompanyInfo, saveCompanyInfo } from './components/Settings';
import { Onboarding } from './components/Onboarding';
import { LoginScreen } from './components/auth/LoginScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Document, DocumentType, Invoice, Receipt, PaymentVoucher, StatementOfPayment } from './types/document';
import { Account } from './types/account';
import { LoginCredentials } from './types/auth';
import { TransactionService } from './services/transactionService';
import { logAuthEvent, logDocumentEvent, logAccountEvent, logTransactionEvent } from './services/activityLogService';
import { canCreateDocuments, canEditDocument, canDeleteDocument } from './utils/permissions';
import { hasPermission } from './services/userService';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Download, ArrowLeft, Info, Settings as SettingsIcon, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import * as SupabaseService from './services/supabaseService';

const ONBOARDING_STORAGE_KEY = 'wif_onboarding_completed';

// Main app content (requires authentication)
function AppContent() {
  const { user, logout } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [allowNegativeBalance, setAllowNegativeBalance] = useState<boolean>(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Track if data has been loaded from Supabase to prevent overwriting on mount
  const [dataLoaded, setDataLoaded] = useState(false);

  // Handle logout
  const handleLogout = () => {
    if (user) {
      logAuthEvent('auth:logout', user);
    }
    logout();
    toast.info('Logged out successfully');
  };

  // Initialize company and load data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Get or create default company
        const company = await SupabaseService.getOrCreateDefaultCompany();
        setCompanyId(company.id);
        setAllowNegativeBalance(company.allow_negative_balance || false);

        // Load documents and accounts in parallel
        const [loadedDocs, loadedAccounts] = await Promise.all([
          SupabaseService.getDocuments(company.id),
          SupabaseService.getAccounts(company.id)
        ]);

        setDocuments(loadedDocs);
        setAccounts(loadedAccounts);
        setDataLoaded(true);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load data', {
          description: error instanceof Error ? error.message : 'Unknown error'
        });
        setDataLoaded(true); // Still mark as loaded to prevent blocking UI
      }
    }

    loadData();
  }, []);


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

  const handleDocumentCreated = async (document: Document) => {
    // If editing, update the existing document
    if (editingDocument) {
      await handleDocumentUpdated(document);
      return;
    }

    if (!companyId) {
      toast.error('Company not initialized');
      return;
    }

    // Validate transaction if document affects accounts
    if (document.accountId && TransactionService.shouldAffectAccount(document)) {
      const account = accounts.find(acc => acc.id === document.accountId);
      const validation = TransactionService.validateTransaction(document, account, allowNegativeBalance);

      if (!validation.isValid) {
        toast.error('Transaction validation failed', {
          description: validation.error,
        });
        return;
      }
    }

    try {
      // Save document to Supabase
      const createdDoc = await SupabaseService.createDocument(companyId, document);
      console.log('✓ Document created in Supabase:', createdDoc.id);

      // Add document to local state
      setDocuments(prev => [...prev, createdDoc]);

      // Update account balances using Transaction Service
      if (createdDoc.accountId && TransactionService.shouldAffectAccount(createdDoc)) {
        console.log('=== Applying Transaction ===');
        console.log('Document:', createdDoc.documentType, createdDoc.documentNumber);
        console.log('Account ID:', createdDoc.accountId);
        console.log('Amount:', createdDoc.amount);

        const accountToUpdate = accounts.find(acc => acc.id === createdDoc.accountId);
        if (accountToUpdate) {
          const previousBalance = accountToUpdate.currentBalance;
          const updatedAccount = TransactionService.applyTransaction(accountToUpdate, createdDoc);
          await SupabaseService.updateAccount(updatedAccount.id, { currentBalance: updatedAccount.currentBalance });
          console.log('✓ Account balance updated in Supabase');

          setAccounts(prev => prev.map(acc =>
            acc.id === updatedAccount.id ? updatedAccount : acc
          ));

          // Log transaction and balance change
          if (user) {
            const changeAmount = updatedAccount.currentBalance - previousBalance;
            const transactionType = changeAmount >= 0 ? 'increase' : 'decrease';

            // Log transaction applied
            logTransactionEvent('transaction:applied', user, {
              accountId: accountToUpdate.id,
              accountName: accountToUpdate.name,
              previousBalance,
              newBalance: updatedAccount.currentBalance,
              changeAmount,
              documentId: createdDoc.id,
              documentNumber: createdDoc.documentNumber,
              documentType: createdDoc.documentType,
              transactionType,
              currency: accountToUpdate.currency,
            });

            // Log account balance changed
            logAccountEvent('account:balance_changed', user, updatedAccount, {
              previousBalance,
              changeAmount,
              documentId: createdDoc.id,
              documentNumber: createdDoc.documentNumber,
              documentType: createdDoc.documentType,
              transactionType,
            });
          }
        }
      }

      // Update related documents
      if (createdDoc.documentType === 'receipt' && createdDoc.linkedInvoiceId) {
        // Mark invoice as paid
        await SupabaseService.updateDocument(createdDoc.linkedInvoiceId, { status: 'paid' });
        const linkedInvoice = documents.find(doc => doc.id === createdDoc.linkedInvoiceId);
        setDocuments(prev => prev.map(doc =>
          doc.id === createdDoc.linkedInvoiceId ? { ...doc, status: 'paid' as const } : doc
        ));

        // Log status change for invoice
        if (user && linkedInvoice) {
          logDocumentEvent('document:status_changed', user, { ...linkedInvoice, status: 'paid' }, {
            previousStatus: 'issued',
            newStatus: 'paid',
            triggeredBy: createdDoc.documentNumber,
          });
        }
      }

      if (createdDoc.documentType === 'statement_of_payment') {
        // Mark payment voucher as completed
        await SupabaseService.updateDocument(createdDoc.linkedVoucherId, { status: 'completed' });
        const linkedVoucher = documents.find(doc => doc.id === createdDoc.linkedVoucherId);
        setDocuments(prev => prev.map(doc =>
          doc.id === createdDoc.linkedVoucherId ? { ...doc, status: 'completed' as const } : doc
        ));

        // Log status change for payment voucher
        if (user && linkedVoucher) {
          logDocumentEvent('document:status_changed', user, { ...linkedVoucher, status: 'completed' }, {
            previousStatus: 'issued',
            newStatus: 'completed',
            triggeredBy: createdDoc.documentNumber,
          });
        }
      }

      const typeLabels = {
        invoice: 'Invoice',
        receipt: 'Receipt',
        payment_voucher: 'Payment Voucher',
        statement_of_payment: 'Statement of Payment',
      };

      toast.success(`${typeLabels[createdDoc.documentType]} created successfully`, {
        description: `${createdDoc.documentNumber} - ${createdDoc.currency} ${createdDoc.amount.toFixed(2)}`,
      });

      // Log activity
      if (user) {
        logDocumentEvent('document:created', user, createdDoc);
      }

      setSelectedType(null);
      setEditingDocument(null);
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create document', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDocumentUpdated = async (updatedDocument: Document) => {
    if (!editingDocument) return;

    // Validate transaction if updated document affects accounts
    if (updatedDocument.accountId && TransactionService.shouldAffectAccount(updatedDocument)) {
      const account = accounts.find(acc => acc.id === updatedDocument.accountId);
      const validation = TransactionService.validateTransaction(updatedDocument, account, allowNegativeBalance);

      if (!validation.isValid) {
        toast.error('Transaction validation failed', {
          description: validation.error,
        });
        return;
      }
    }

    try {
      // Update account balances - reverse old and apply new using Transaction Service
      if (editingDocument.accountId || updatedDocument.accountId) {
        const accountsToUpdate: Account[] = [];
        const transactionLogs: Array<{
          type: 'applied' | 'reversed';
          account: Account;
          previousBalance: number;
          document: Document;
        }> = [];

        accounts.forEach(acc => {
          let updatedAcc = acc;
          const originalBalance = acc.currentBalance;

          // Reverse old document's effect
          if (acc.id === editingDocument.accountId && TransactionService.shouldAffectAccount(editingDocument)) {
            const balanceBeforeReverse = updatedAcc.currentBalance;
            updatedAcc = TransactionService.reverseTransaction(updatedAcc, editingDocument);
            transactionLogs.push({
              type: 'reversed',
              account: { ...acc, currentBalance: updatedAcc.currentBalance },
              previousBalance: balanceBeforeReverse,
              document: editingDocument,
            });
          }

          // Apply new document's effect
          if (updatedAcc.id === updatedDocument.accountId && TransactionService.shouldAffectAccount(updatedDocument)) {
            const balanceBeforeApply = updatedAcc.currentBalance;
            updatedAcc = TransactionService.applyTransaction(updatedAcc, updatedDocument);
            transactionLogs.push({
              type: 'applied',
              account: { ...acc, currentBalance: updatedAcc.currentBalance },
              previousBalance: balanceBeforeApply,
              document: updatedDocument,
            });
          }

          if (updatedAcc !== acc || updatedAcc.currentBalance !== originalBalance) {
            accountsToUpdate.push(updatedAcc);
          }
        });

        // Update accounts in Supabase
        await Promise.all(
          accountsToUpdate.map(acc =>
            SupabaseService.updateAccount(acc.id, { currentBalance: acc.currentBalance })
          )
        );

        setAccounts(prev => prev.map(acc => {
          const updated = accountsToUpdate.find(u => u.id === acc.id);
          return updated || acc;
        }));

        // Log all transaction changes
        if (user) {
          for (const txLog of transactionLogs) {
            const changeAmount = txLog.account.currentBalance - txLog.previousBalance;
            const transactionType = changeAmount >= 0 ? 'increase' : 'decrease';
            const originalAccount = accounts.find(a => a.id === txLog.account.id);

            if (originalAccount) {
              logTransactionEvent(txLog.type === 'applied' ? 'transaction:applied' : 'transaction:reversed', user, {
                accountId: originalAccount.id,
                accountName: originalAccount.name,
                previousBalance: txLog.previousBalance,
                newBalance: txLog.account.currentBalance,
                changeAmount,
                documentId: txLog.document.id,
                documentNumber: txLog.document.documentNumber,
                documentType: txLog.document.documentType,
                transactionType,
                currency: originalAccount.currency,
              });

              logAccountEvent('account:balance_changed', user, { ...originalAccount, currentBalance: txLog.account.currentBalance }, {
                previousBalance: txLog.previousBalance,
                changeAmount,
                documentId: txLog.document.id,
                documentNumber: txLog.document.documentNumber,
                documentType: txLog.document.documentType,
                transactionType,
                reason: txLog.type === 'reversed' ? 'document_update_reversal' : 'document_update_application',
              });
            }
          }
        }
      }

      // Update the document in Supabase
      const updatedInSupabase = await SupabaseService.updateDocument(editingDocument.id, updatedDocument);

      if (updatedInSupabase) {
        console.log('✓ Document updated in Supabase');
      } else {
        // Document doesn't exist in Supabase (legacy localStorage data)
        // Create it instead
        console.log('Document not found in Supabase, creating new...');
        if (companyId) {
          await SupabaseService.createDocument(companyId, { ...updatedDocument, id: editingDocument.id });
          console.log('✓ Document created in Supabase');
        }
      }

      // Update the document in local state
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
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

  const handleAddAccount = async (account: Account) => {
    if (!companyId) {
      toast.error('Company not initialized');
      return;
    }

    try {
      const createdAccount = await SupabaseService.createAccount(companyId, account);
      console.log('✓ Account created in Supabase:', createdAccount.id);

      setAccounts(prev => [...prev, createdAccount]);
      toast.success('Account added successfully', {
        description: `${account.name} - ${account.currency}`,
      });

      // Log account creation activity
      if (user) {
        logAccountEvent('account:created', user, createdAccount, {
          accountType: createdAccount.type,
          initialBalance: createdAccount.initialBalance,
          bankName: createdAccount.bankName,
          custodian: createdAccount.custodian,
        });
      }
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Failed to create account', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

  const handleDeleteDocument = async (documentId: string) => {
    const docToDelete = documents.find(doc => doc.id === documentId);
    if (!docToDelete) return;

    // Check permission
    if (!user || !canDeleteDocument(user, docToDelete)) {
      toast.error('Access denied', {
        description: 'You do not have permission to delete this document'
      });
      return;
    }

    try {
      // Update account balance if document affected accounts (using Transaction Service)
      if (docToDelete.accountId && TransactionService.shouldAffectAccount(docToDelete)) {
        const accountToUpdate = accounts.find(acc => acc.id === docToDelete.accountId);
        if (accountToUpdate) {
          const previousBalance = accountToUpdate.currentBalance;
          const updatedAccount = TransactionService.reverseTransaction(accountToUpdate, docToDelete);
          await SupabaseService.updateAccount(updatedAccount.id, { currentBalance: updatedAccount.currentBalance });

          setAccounts(prev => prev.map(acc =>
            acc.id === updatedAccount.id ? updatedAccount : acc
          ));

          // Log transaction reversal and balance change
          if (user) {
            const changeAmount = updatedAccount.currentBalance - previousBalance;
            const transactionType = changeAmount >= 0 ? 'increase' : 'decrease';

            // Log transaction reversed
            logTransactionEvent('transaction:reversed', user, {
              accountId: accountToUpdate.id,
              accountName: accountToUpdate.name,
              previousBalance,
              newBalance: updatedAccount.currentBalance,
              changeAmount,
              documentId: docToDelete.id,
              documentNumber: docToDelete.documentNumber,
              documentType: docToDelete.documentType,
              transactionType,
              currency: accountToUpdate.currency,
            });

            // Log account balance changed
            logAccountEvent('account:balance_changed', user, updatedAccount, {
              previousBalance,
              changeAmount,
              documentId: docToDelete.id,
              documentNumber: docToDelete.documentNumber,
              documentType: docToDelete.documentType,
              transactionType,
              reason: 'document_deletion',
            });
          }
        }
      }

      // Update related documents
      if (docToDelete.documentType === 'receipt' && docToDelete.linkedInvoiceId) {
        // Mark invoice back to issued status
        await SupabaseService.updateDocument(docToDelete.linkedInvoiceId, { status: 'issued' });
        const linkedInvoice = documents.find(doc => doc.id === docToDelete.linkedInvoiceId);
        setDocuments(prev => prev.map(doc =>
          doc.id === docToDelete.linkedInvoiceId ? { ...doc, status: 'issued' as const } : doc
        ));

        // Log status change for invoice (reverted from paid to issued)
        if (user && linkedInvoice) {
          logDocumentEvent('document:status_changed', user, { ...linkedInvoice, status: 'issued' }, {
            previousStatus: 'paid',
            newStatus: 'issued',
            triggeredBy: `${docToDelete.documentNumber} deleted`,
          });
        }
      }

      if (docToDelete.documentType === 'statement_of_payment' && docToDelete.linkedVoucherId) {
        // Mark payment voucher back to issued status
        await SupabaseService.updateDocument(docToDelete.linkedVoucherId, { status: 'issued' });
        const linkedVoucher = documents.find(doc => doc.id === docToDelete.linkedVoucherId);
        setDocuments(prev => prev.map(doc =>
          doc.id === docToDelete.linkedVoucherId ? { ...doc, status: 'issued' as const } : doc
        ));

        // Log status change for payment voucher (reverted from completed to issued)
        if (user && linkedVoucher) {
          logDocumentEvent('document:status_changed', user, { ...linkedVoucher, status: 'issued' }, {
            previousStatus: 'completed',
            newStatus: 'issued',
            triggeredBy: `${docToDelete.documentNumber} deleted`,
          });
        }
      }

      // Delete the document from Supabase
      await SupabaseService.deleteDocument(documentId);
      console.log('✓ Document deleted from Supabase');

      // Delete from local state
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
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
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
          <Settings
            onBack={async () => {
              setShowSettings(false);
              // Reload company settings after closing Settings
              try {
                const company = await SupabaseService.getOrCreateDefaultCompany();
                setAllowNegativeBalance(company.allow_negative_balance || false);
              } catch (error) {
                console.error('Failed to reload company settings:', error);
              }
            }}
          />
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
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

            <TabsContent value="bookings" className="space-y-6">
              {companyId && (
                <BookingManagement companyId={companyId} />
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
