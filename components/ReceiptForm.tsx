import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { AlertCircle } from 'lucide-react';
import { Receipt, Currency, Country, Invoice } from '../types/document';
import { Account } from '../types/account';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../contexts/AuthContext';
import { DatePicker, getTodayISO } from './ui/date-picker';

// Payment status info for an invoice
interface InvoicePaymentInfo {
  invoiceTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentCount: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid';
}

interface ReceiptFormProps {
  invoices: Invoice[];
  receipts: Receipt[]; // All receipts for calculating payment status
  accounts: Account[];
  onSubmit: (receipt: Receipt) => void;
  onCancel: () => void;
  initialData?: Receipt;
}

export function ReceiptForm({ invoices, receipts, accounts, onSubmit, onCancel, initialData }: ReceiptFormProps) {
  const { user } = useAuth();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Calculate payment status for each invoice from receipts
  const invoicePaymentMap = useMemo(() => {
    const map = new Map<string, InvoicePaymentInfo>();

    for (const invoice of invoices) {
      // Find all receipts linked to this invoice (excluding cancelled/deleted)
      const linkedReceipts = receipts.filter(
        r => r.linkedInvoiceId === invoice.id &&
             r.status !== 'cancelled' &&
             (r.status === 'completed' || r.status === 'paid')
      );

      const amountPaid = linkedReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
      const balanceDue = invoice.total - amountPaid;

      let paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid';
      if (amountPaid === 0) {
        paymentStatus = 'unpaid';
      } else if (amountPaid >= invoice.total) {
        paymentStatus = 'fully_paid';
      } else {
        paymentStatus = 'partially_paid';
      }

      map.set(invoice.id, {
        invoiceTotal: invoice.total,
        amountPaid,
        balanceDue,
        paymentCount: linkedReceipts.length,
        paymentStatus,
      });
    }

    return map;
  }, [invoices, receipts]);

  const [formData, setFormData] = useState({
    documentNumber: initialData?.documentNumber || 'Auto',
    payerName: initialData?.payerName || '',
    payerContact: initialData?.payerContact || '',
    receiptDate: initialData?.receiptDate || getTodayISO(),
    paymentMethod: initialData?.paymentMethod || '',
    linkedInvoiceId: initialData?.linkedInvoiceId || '',
    receivedBy: initialData?.receivedBy || '',
    amount: initialData?.amount?.toString() || '',
    currency: initialData?.currency || ('MYR' as Currency),
    country: initialData?.country || ('Malaysia' as Country),
    accountId: initialData?.accountId || '',
    notes: initialData?.notes || '',
  });

  // REMOVED: Document number generation moved to service layer at submission time
  // This prevents race conditions where multiple users get the same number

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      // Pre-fill with balance due (remaining amount) instead of full invoice total
      // This supports partial payments - user can still edit the amount
      const paymentInfo = invoicePaymentMap.get(invoice.id);
      const balanceDue = paymentInfo?.balanceDue ?? invoice.total;
      setFormData({
        ...formData,
        linkedInvoiceId: invoiceId,
        payerName: invoice.customerName,
        amount: balanceDue > 0 ? balanceDue.toString() : invoice.total.toString(),
        currency: invoice.currency,
        country: invoice.country,
        accountId: invoice.accountId || '',
      });
    } else {
      setSelectedInvoice(null);
      setFormData({
        ...formData,
        linkedInvoiceId: '',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.payerName.trim()) {
      setValidationError('Payer name is required');
      return;
    }
    if (!formData.paymentMethod.trim()) {
      setValidationError('Payment method is required');
      return;
    }
    if (!formData.receivedBy.trim()) {
      setValidationError('Received by field is required');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setValidationError('Valid amount is required');
      return;
    }

    const selectedAccount = accounts.find(acc => acc.id === formData.accountId);

    const now = new Date().toISOString();
    const userReference = user ? {
      id: user.id,
      name: user.fullName,
      username: user.username
    } : undefined;

    const receipt: Receipt = {
      id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentType: 'receipt',
      documentNumber: formData.documentNumber,
      date: formData.receiptDate,
      status: 'completed',
      currency: formData.currency,
      amount: parseFloat(formData.amount),
      country: formData.country,
      accountId: formData.accountId || undefined,
      accountName: selectedAccount?.name || undefined,
      payerName: formData.payerName,
      payerContact: formData.payerContact || undefined,
      receiptDate: formData.receiptDate,
      paymentMethod: formData.paymentMethod,
      linkedInvoiceId: formData.linkedInvoiceId || undefined,
      linkedInvoiceNumber: selectedInvoice?.documentNumber || undefined,
      receivedBy: formData.receivedBy,
      notes: formData.notes || undefined,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      createdBy: initialData?.createdBy || userReference,
      updatedBy: userReference,
      lastModifiedAt: now,
    };

    onSubmit(receipt);
  };

  // Show all invoices that can receive payments:
  // - Not cancelled (cancelled invoices can't receive payments)
  // - Includes 'issued', 'paid', 'completed' - all can receive additional receipts
  // Payment status (unpaid/partially_paid/fully_paid) is calculated dynamically
  const linkableInvoices = invoices.filter(inv => inv.status !== 'cancelled');

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{initialData ? 'Edit Receipt' : 'Create Receipt'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentNumber">Receipt Number *</Label>
              <Input
                id="documentNumber"
                value={formData.documentNumber}
                disabled={!initialData}
                placeholder="Auto-generated on save"
                className={!initialData ? 'bg-gray-100 text-gray-600' : ''}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
              />
              {!initialData && (
                <p className="text-xs text-gray-500">Document number will be generated automatically when you save</p>
              )}
            </div>
            <DatePicker
              label="Receipt Date"
              value={formData.receiptDate}
              onChange={(value) => setFormData({ ...formData, receiptDate: value || getTodayISO() })}
              required
            />
          </div>

          {/* Link to Invoice */}
          {linkableInvoices.length > 0 && (
            <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
              <Label htmlFor="linkedInvoice">Link to Invoice (Optional)</Label>
              <Select
                value={formData.linkedInvoiceId}
                onValueChange={(value) => handleInvoiceSelect(value === 'none' ? '' : value)}
              >
                <SelectTrigger id="linkedInvoice">
                  <SelectValue placeholder="Select an invoice (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No invoice link</SelectItem>
                  {linkableInvoices.map((invoice) => {
                    const paymentInfo = invoicePaymentMap.get(invoice.id);
                    const statusLabel = paymentInfo?.paymentStatus === 'fully_paid' ? ' [PAID]' :
                                       paymentInfo?.paymentStatus === 'partially_paid' ? ' [PARTIAL]' : '';
                    const balanceText = paymentInfo && paymentInfo.amountPaid > 0
                      ? ` (Due: ${invoice.currency} ${paymentInfo.balanceDue.toFixed(2)})`
                      : '';
                    return (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.documentNumber} - {invoice.customerName} - {invoice.currency} {invoice.total.toFixed(2)}{statusLabel}{balanceText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Payment Summary - shown when invoice is linked */}
          {selectedInvoice && invoicePaymentMap.get(selectedInvoice.id) && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-indigo-700">Invoice Payment Summary</span>
                <span className="text-xs text-gray-500">
                  {invoicePaymentMap.get(selectedInvoice.id)?.paymentCount || 0} payment(s)
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Total:</span>
                  <span className="font-medium">{selectedInvoice.currency} {selectedInvoice.total.toFixed(2)}</span>
                </div>
                {(invoicePaymentMap.get(selectedInvoice.id)?.amountPaid || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Already Paid:</span>
                    <span className="font-medium text-green-600">
                      {selectedInvoice.currency} {invoicePaymentMap.get(selectedInvoice.id)?.amountPaid.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Balance Due:</span>
                  <span className="font-semibold text-indigo-600">
                    {selectedInvoice.currency} {invoicePaymentMap.get(selectedInvoice.id)?.balanceDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payer Details */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm">Payer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payerName">Payer Name *</Label>
                <Input
                  id="payerName"
                  value={formData.payerName}
                  onChange={(e) => setFormData({ ...formData, payerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payerContact">Payer Contact</Label>
                <Input
                  id="payerContact"
                  value={formData.payerContact}
                  onChange={(e) => setFormData({ ...formData, payerContact: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Online Payment">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receivedBy">Received By *</Label>
              <Input
                id="receivedBy"
                placeholder="Name of person who received payment"
                value={formData.receivedBy}
                onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
              />
            </div>
          </div>

          {/* Amount, Currency and Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => {
                  const currency = value as Currency;
                  const country = currency === 'JPY' ? 'Japan' : 'Malaysia';
                  setFormData({ ...formData, currency, country: country as Country, accountId: '' });
                }}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MYR">MYR (Malaysian Ringgit)</SelectItem>
                  <SelectItem value="JPY">JPY (Japanese Yen)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Deposit to Account *</Label>
              <Select
                value={formData.accountId}
                onValueChange={(value) => setFormData({ ...formData, accountId: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="accountId">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account link</SelectItem>
                  {accounts.filter(acc => acc.isActive && acc.currency === formData.currency).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{initialData ? 'Update Receipt' : 'Create Receipt'}</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
