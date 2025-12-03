import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Invoice, Currency, Country, LineItem } from '../types/document';
import { Account } from '../types/account';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { DatePicker, getTodayISO } from './ui/date-picker';

interface InvoiceFormProps {
  accounts: Account[];
  onSubmit: (invoice: Invoice) => void;
  onCancel: () => void;
  initialData?: Invoice;
}

export function InvoiceForm({ accounts, onSubmit, onCancel, initialData }: InvoiceFormProps) {
  const { user } = useAuth();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [items, setItems] = useState<LineItem[]>(
    initialData?.items || [
      { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }
    ]
  );

  const [formData, setFormData] = useState({
    documentNumber: initialData?.documentNumber || 'Auto',
    customerName: initialData?.customerName || '',
    customerAddress: initialData?.customerAddress || '',
    customerEmail: initialData?.customerEmail || '',
    invoiceDate: initialData?.date || getTodayISO(),
    dueDate: initialData?.dueDate || '',
    currency: initialData?.currency || ('MYR' as Currency),
    country: initialData?.country || ('Malaysia' as Country),
    accountId: initialData?.accountId || '',
    taxRate: initialData?.taxRate?.toString() || '',
    paymentTerms: initialData?.paymentTerms || '',
    notes: initialData?.notes || '',
  });

  // REMOVED: Document number generation moved to service layer at submission time
  // This prevents race conditions where multiple users get the same number

  const addItem = () => {
    setItems([...items, { 
      id: Date.now().toString(), 
      description: '', 
      quantity: 1, 
      unitPrice: 0, 
      amount: 0 
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = parseFloat(formData.taxRate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.customerName.trim()) {
      setValidationError('Customer name is required');
      return;
    }
    if (!formData.dueDate) {
      setValidationError('Due date is required');
      return;
    }
    if (items.some(item => !item.description.trim())) {
      setValidationError('All line items must have a description');
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    const selectedAccount = accounts.find(acc => acc.id === formData.accountId);

    const now = new Date().toISOString();
    const userReference = user ? {
      id: user.id,
      name: user.fullName,
      username: user.username
    } : undefined;

    const invoice: Invoice = {
      id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentType: 'invoice',
      documentNumber: formData.documentNumber,
      date: formData.invoiceDate,
      status: 'issued',
      currency: formData.currency,
      amount: total,
      country: formData.country,
      accountId: formData.accountId || undefined,
      accountName: selectedAccount?.name || undefined,
      customerName: formData.customerName,
      customerAddress: formData.customerAddress || undefined,
      customerEmail: formData.customerEmail || undefined,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      items: items,
      subtotal: subtotal,
      taxRate: parseFloat(formData.taxRate) || undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total: total,
      paymentTerms: formData.paymentTerms || undefined,
      notes: formData.notes || undefined,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      createdBy: initialData?.createdBy || userReference,
      updatedBy: userReference,
      lastModifiedAt: now,
    };

    onSubmit(invoice);
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{initialData ? 'Edit Invoice' : 'Create Invoice'}</CardTitle>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentNumber">Invoice Number *</Label>
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
              label="Invoice Date"
              value={formData.invoiceDate}
              onChange={(value) => setFormData({ ...formData, invoiceDate: value || getTodayISO() })}
              required
            />
            <DatePicker
              label="Due Date"
              value={formData.dueDate}
              onChange={(value) => setFormData({ ...formData, dueDate: value || '' })}
              minValue={formData.invoiceDate}
              required
            />
          </div>

          <Separator />

          {/* Customer Details */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm">Customer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Customer Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerAddress">Customer Address</Label>
                <Textarea
                  id="customerAddress"
                  rows={2}
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm">Line Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
            {items.map((item, _index) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                <div className="col-span-5 space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Amount</Label>
                  <Input value={item.amount.toFixed(2)} disabled />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Currency and Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="accountId">Account (Optional)</Label>
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

          <Separator />

          {/* Totals */}
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formData.currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <div className="text-sm">
                  Tax Amount: {formData.currency} {taxAmount.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span>Total:</span>
              <span>{formData.currency} {total.toFixed(2)}</span>
            </div>
          </div>

          <Separator />

          {/* Additional Info */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Input
                id="paymentTerms"
                placeholder="e.g., Net 30 days"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{initialData ? 'Update Invoice' : 'Create Invoice'}</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
