import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { PaymentVoucher, Currency, Country, LineItem } from '../types/document';
import { Account } from '../types/account';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { canApproveVouchers } from '../utils/permissions';
import { DatePicker, getTodayISO } from './ui/date-picker';
import { logDocumentEvent } from '../services/activityLogService';

interface PaymentVoucherFormProps {
  accounts: Account[];
  onSubmit: (voucher: PaymentVoucher) => void;
  onCancel: () => void;
  initialData?: PaymentVoucher;
}

export function PaymentVoucherForm({ accounts, onSubmit, onCancel, initialData }: PaymentVoucherFormProps) {
  const { user } = useAuth();
  const canApprove = user && canApproveVouchers(user);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [items, setItems] = useState<LineItem[]>(
    initialData?.items || [
      { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }
    ]
  );

  const [formData, setFormData] = useState({
    documentNumber: initialData?.documentNumber || 'Auto',
    voucherDate: initialData?.voucherDate || getTodayISO(),
    payeeName: initialData?.payeeName || '',
    payeeAddress: initialData?.payeeAddress || '',
    payeeBankAccount: initialData?.payeeBankAccount || '',
    payeeBankName: initialData?.payeeBankName || '',
    requestedBy: initialData?.requestedBy || '',
    approvedBy: initialData?.approvedBy || '',
    approvalDate: initialData?.approvalDate || '',
    paymentDueDate: initialData?.paymentDueDate || '',
    currency: initialData?.currency || ('MYR' as Currency),
    country: initialData?.country || ('Malaysia' as Country),
    accountId: initialData?.accountId || '',
    taxRate: initialData?.taxRate?.toString() || '',
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

    if (!formData.payeeName.trim()) {
      setValidationError('Payee name is required');
      return;
    }
    if (!formData.requestedBy.trim()) {
      setValidationError('Requested by field is required');
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

    // Handle approval: if user can approve and they filled in the approvedBy field, use their info
    let approvalInfo: string | typeof userReference | undefined = undefined;
    let approvalDateValue: string | undefined = undefined;

    if (formData.approvedBy && canApprove) {
      // User is approving now
      approvalInfo = userReference;
      approvalDateValue = now;
    } else if (typeof initialData?.approvedBy === 'object' && initialData?.approvedBy) {
      // Keep existing approval (UserReference)
      approvalInfo = initialData.approvedBy;
      approvalDateValue = initialData.approvalDate;
    } else if (typeof initialData?.approvedBy === 'string' && initialData?.approvedBy) {
      // Legacy approval (string)
      approvalInfo = initialData.approvedBy;
      approvalDateValue = initialData.approvalDate;
    }

    const voucher: PaymentVoucher = {
      id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentType: 'payment_voucher',
      documentNumber: formData.documentNumber,
      date: formData.voucherDate,
      status: approvalInfo ? 'issued' : 'draft',
      currency: formData.currency,
      amount: total,
      country: formData.country,
      accountId: formData.accountId || undefined,
      accountName: selectedAccount?.name || undefined,
      payeeName: formData.payeeName,
      payeeAddress: formData.payeeAddress || undefined,
      payeeBankAccount: formData.payeeBankAccount || undefined,
      payeeBankName: formData.payeeBankName || undefined,
      voucherDate: formData.voucherDate,
      items: items,
      subtotal: subtotal,
      taxRate: parseFloat(formData.taxRate) || undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total: total,
      requestedBy: formData.requestedBy,
      approvedBy: approvalInfo,
      approvalDate: approvalDateValue,
      paymentDueDate: formData.paymentDueDate || undefined,
      notes: formData.notes || undefined,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      createdBy: initialData?.createdBy || userReference,
      updatedBy: userReference,
      lastModifiedAt: now,
    };

    // Log approval if this is a new approval (not editing an already-approved voucher)
    const isNewApproval = formData.approvedBy && canApprove && !initialData?.approvedBy;
    if (isNewApproval && user) {
      logDocumentEvent('document:approved', user, voucher, {
        approvedBy: user.fullName,
        approvalDate: now,
      });
    }

    onSubmit(voucher);
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{initialData ? 'Edit Payment Voucher' : 'Create Payment Voucher'}</CardTitle>
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
              <Label htmlFor="documentNumber">Voucher Number *</Label>
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
              label="Voucher Date"
              value={formData.voucherDate}
              onChange={(value) => setFormData({ ...formData, voucherDate: value || getTodayISO() })}
              required
            />
            <DatePicker
              label="Payment Due Date"
              value={formData.paymentDueDate}
              onChange={(value) => setFormData({ ...formData, paymentDueDate: value || '' })}
              minValue={formData.voucherDate}
            />
          </div>

          {/* Payee Details */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm">Payee Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payeeName">Payee Name *</Label>
                <Input
                  id="payeeName"
                  value={formData.payeeName}
                  onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payeeBankName">Bank Name</Label>
                <Input
                  id="payeeBankName"
                  value={formData.payeeBankName}
                  onChange={(e) => setFormData({ ...formData, payeeBankName: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="payeeBankAccount">Bank Account Number</Label>
                <Input
                  id="payeeBankAccount"
                  value={formData.payeeBankAccount}
                  onChange={(e) => setFormData({ ...formData, payeeBankAccount: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="payeeAddress">Payee Address</Label>
                <Textarea
                  id="payeeAddress"
                  rows={2}
                  value={formData.payeeAddress}
                  onChange={(e) => setFormData({ ...formData, payeeAddress: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Payment Items</h3>
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

          {/* Payment Details */}
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
              <Label htmlFor="accountId">Pay from Account *</Label>
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
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">{formData.currency} {calculateTotals().subtotal.toFixed(2)}</span>
            </div>
            {calculateTotals().taxAmount > 0 && (
              <div className="flex justify-between">
                <span>Tax ({formData.taxRate}%):</span>
                <span className="font-semibold">{formData.currency} {calculateTotals().taxAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-bold">Total:</span>
              <span className="font-bold">{formData.currency} {calculateTotals().total.toFixed(2)}</span>
            </div>
          </div>

          {/* Approval Details */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm">Approval Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requestedBy">Requested By *</Label>
                <Input
                  id="requestedBy"
                  placeholder="Name of person requesting"
                  value={formData.requestedBy}
                  onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                />
              </div>

              {/* Show approval checkbox if user can approve */}
              {canApprove && !initialData?.approvedBy && (
                <div className="space-y-2">
                  <Label htmlFor="approvedBy" className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="approvedBy"
                      checked={!!formData.approvedBy}
                      onChange={(e) => setFormData({ ...formData, approvedBy: e.target.checked ? 'approved' : '' })}
                      className="w-4 h-4"
                    />
                    <span>I approve this voucher</span>
                  </Label>
                  {formData.approvedBy && (
                    <p className="text-xs text-gray-600">
                      Will be approved by: <strong>{user?.fullName}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Show who approved if already approved */}
              {initialData?.approvedBy && (
                <div className="space-y-2">
                  <Label>Approved By</Label>
                  <div className="text-sm p-2 bg-green-50 border border-green-200 rounded">
                    {typeof initialData.approvedBy === 'object'
                      ? initialData.approvedBy.name
                      : initialData.approvedBy}
                    {initialData.approvalDate && (
                      <div className="text-xs text-gray-600 mt-1">
                        on {new Date(initialData.approvalDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
            <Button type="submit" className="flex-1">{initialData ? 'Update Payment Voucher' : 'Create Payment Voucher'}</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
