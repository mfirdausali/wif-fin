import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { AlertCircle } from 'lucide-react';
import { Receipt, Currency, Invoice } from '../types/document';
import { Account } from '../types/account';
import { Alert, AlertDescription } from './ui/alert';
import { DocumentNumberService } from '../services/documentNumberService';
import { useAuth } from '../contexts/AuthContext';

interface ReceiptFormProps {
  invoices: Invoice[];
  accounts: Account[];
  onSubmit: (receipt: Receipt) => void;
  onCancel: () => void;
  initialData?: Receipt;
}

export function ReceiptForm({ invoices, accounts, onSubmit, onCancel, initialData }: ReceiptFormProps) {
  const { user } = useAuth();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [formData, setFormData] = useState({
    documentNumber: initialData?.documentNumber || DocumentNumberService.generateDocumentNumber('receipt'),
    payerName: initialData?.payerName || '',
    payerContact: initialData?.payerContact || '',
    receiptDate: initialData?.receiptDate || new Date().toISOString().split('T')[0],
    paymentMethod: initialData?.paymentMethod || '',
    linkedInvoiceId: initialData?.linkedInvoiceId || '',
    receivedBy: initialData?.receivedBy || '',
    amount: initialData?.amount?.toString() || '',
    currency: initialData?.currency || ('MYR' as Currency),
    country: initialData?.country || ('Malaysia' as 'Malaysia' | 'Japan'),
    accountId: initialData?.accountId || '',
    notes: initialData?.notes || '',
  });

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setFormData({
        ...formData,
        linkedInvoiceId: invoiceId,
        payerName: invoice.customerName,
        amount: invoice.total.toString(),
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

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');

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
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiptDate">Receipt Date *</Label>
              <Input
                id="receiptDate"
                type="date"
                value={formData.receiptDate}
                onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
              />
            </div>
          </div>

          {/* Link to Invoice */}
          {unpaidInvoices.length > 0 && (
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
                  {unpaidInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.documentNumber} - {invoice.customerName} - {invoice.currency} {invoice.total.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  setFormData({ ...formData, currency, country: country as 'Malaysia' | 'Japan', accountId: '' });
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
