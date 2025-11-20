import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Account, AccountTransaction } from '../types/account';
import { Document, Currency } from '../types/document';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, FileText, Building2, Wallet } from 'lucide-react';
import { Separator } from './ui/separator';

interface AccountBalanceSheetProps {
  account: Account;
  documents: Document[];
  onBack: () => void;
}

export function AccountBalanceSheet({ account, documents, onBack }: AccountBalanceSheetProps) {
  // Generate transaction history from documents
  const transactions = useMemo(() => {
    const txns: AccountTransaction[] = [];
    let runningBalance = account.initialBalance;

    // Filter documents linked to this account and that affect balance
    const relevantDocs = documents
      .filter(doc => doc.accountId === account.id)
      .filter(doc => {
        // Only receipts with 'completed' status and statements of payment with 'completed' status
        if (doc.documentType === 'receipt' && doc.status === 'completed') return true;
        if (doc.documentType === 'statement_of_payment' && doc.status === 'completed') return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Create transactions
    relevantDocs.forEach(doc => {
      const isReceipt = doc.documentType === 'receipt';
      const debit = isReceipt ? doc.amount : 0;
      const credit = isReceipt ? 0 : doc.amount;

      runningBalance += (isReceipt ? doc.amount : -doc.amount);

      let description = '';
      if (doc.documentType === 'receipt') {
        const receipt = doc as any;
        description = `Payment received from ${receipt.payerName || 'Customer'}`;
      } else if (doc.documentType === 'statement_of_payment') {
        const sop = doc as any;
        description = `Payment made to ${sop.payeeName || 'Vendor'}`;
      }

      txns.push({
        accountId: account.id,
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        documentType: doc.documentType,
        date: doc.date,
        description,
        debit,
        credit,
        balance: runningBalance,
        currency: doc.currency,
      });
    });

    return txns;
  }, [account, documents]);

  const formatCurrency = (amount: number, currency: Currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate summary statistics
  const totalDebits = transactions.reduce((sum, txn) => sum + txn.debit, 0);
  const totalCredits = transactions.reduce((sum, txn) => sum + txn.credit, 0);
  const netChange = totalDebits - totalCredits;

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Accounts
        </Button>
      </div>

      {/* Account Summary Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {account.type === 'main_bank' ? (
                <Building2 className="w-8 h-8 text-blue-600" />
              ) : (
                <Wallet className="w-8 h-8 text-green-600" />
              )}
              <div>
                <CardTitle className="text-2xl">{account.name}</CardTitle>
                <CardDescription className="mt-1">
                  {account.type === 'main_bank' ? (
                    <>
                      {account.bankName} {account.accountNumber && `• ${account.accountNumber}`}
                    </>
                  ) : (
                    <>Held by: {account.custodian}</>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-2">
                {account.country === 'Malaysia' ? '🇲🇾 Malaysia' : '🇯🇵 Japan'}
              </Badge>
              <div className="text-xs text-gray-500">{account.currency}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Initial Balance */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Initial Balance</div>
              <div className="text-xl font-semibold">
                {formatCurrency(account.initialBalance, account.currency)}
              </div>
            </div>

            {/* Total Debits (Money In) */}
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div className="text-xs text-green-700">Total Receipts</div>
              </div>
              <div className="text-xl font-semibold text-green-700">
                {formatCurrency(totalDebits, account.currency)}
              </div>
            </div>

            {/* Total Credits (Money Out) */}
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <div className="text-xs text-red-700">Total Payments</div>
              </div>
              <div className="text-xl font-semibold text-red-700">
                {formatCurrency(totalCredits, account.currency)}
              </div>
            </div>

            {/* Current Balance */}
            <div className={`p-4 rounded-lg ${account.currentBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <div className="text-xs text-gray-600 mb-1">Current Balance</div>
              <div className={`text-xl font-bold ${account.currentBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {formatCurrency(account.currentBalance, account.currency)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Net: {formatCurrency(netChange, account.currency)}
              </div>
            </div>
          </div>

          {account.notes && (
            <>
              <Separator className="my-4" />
              <div className="text-sm">
                <span className="font-semibold">Notes: </span>
                <span className="text-gray-600">{account.notes}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500">No transactions recorded yet</p>
              <p className="text-xs text-gray-400 mt-2">
                Completed receipts and statements of payment will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs font-semibold text-gray-600">
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Document</div>
                <div className="col-span-2">Description</div>
                <div className="col-span-2 text-right">Debit</div>
                <div className="col-span-2 text-right">Credit</div>
                <div className="col-span-2 text-right">Balance</div>
              </div>

              {/* Opening Balance Row */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg bg-blue-50">
                <div className="col-span-2 text-sm text-gray-600">
                  {formatDate(account.createdAt)}
                </div>
                <div className="col-span-2 text-sm">
                  <Badge variant="outline" className="text-xs">Opening</Badge>
                </div>
                <div className="col-span-2 text-sm text-gray-600">
                  Opening Balance
                </div>
                <div className="col-span-2 text-right text-sm">-</div>
                <div className="col-span-2 text-right text-sm">-</div>
                <div className="col-span-2 text-right text-sm font-semibold whitespace-nowrap">
                  {formatCurrency(account.initialBalance, account.currency)}
                </div>
              </div>

              {/* Transaction Rows */}
              {transactions.map((txn, index) => (
                <div
                  key={`${txn.documentId}-${index}`}
                  className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="col-span-2 text-sm text-gray-600">
                    {formatDate(txn.date)}
                  </div>
                  <div className="col-span-2 text-sm">
                    <div className="flex items-center gap-1">
                      {txn.documentType === 'receipt' ? (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                          Receipt
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs bg-red-100 text-red-700 border-red-300">
                          Payment
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{txn.documentNumber}</div>
                  </div>
                  <div className="col-span-2 text-sm text-gray-700">
                    {txn.description}
                  </div>
                  <div className="col-span-2 text-right text-sm whitespace-nowrap">
                    {txn.debit > 0 ? (
                      <span className="text-green-600 font-semibold">
                        +{formatCurrency(txn.debit, txn.currency)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-sm whitespace-nowrap">
                    {txn.credit > 0 ? (
                      <span className="text-red-600 font-semibold">
                        -{formatCurrency(txn.credit, txn.currency)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-sm font-semibold whitespace-nowrap">
                    {formatCurrency(txn.balance, txn.currency)}
                  </div>
                </div>
              ))}

              {/* Closing Balance Row */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-2 rounded-lg bg-blue-100 font-semibold">
                <div className="col-span-6 text-sm">
                  Closing Balance
                </div>
                <div className="col-span-2 text-right text-sm text-green-700 whitespace-nowrap">
                  {formatCurrency(totalDebits, account.currency)}
                </div>
                <div className="col-span-2 text-right text-sm text-red-700 whitespace-nowrap">
                  {formatCurrency(totalCredits, account.currency)}
                </div>
                <div className="col-span-2 text-right text-sm text-blue-700 whitespace-nowrap">
                  {formatCurrency(account.currentBalance, account.currency)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
