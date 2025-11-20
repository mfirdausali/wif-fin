import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { AlertCircle, Upload, Info } from 'lucide-react';
import { StatementOfPayment, PaymentVoucher } from '../types/document';
import { Account } from '../types/account';
import { Alert, AlertDescription } from './ui/alert';
import { DocumentNumberService } from '../services/documentNumberService';
import { useAuth } from '../contexts/AuthContext';

interface StatementOfPaymentFormProps {
  paymentVouchers: PaymentVoucher[];
  accounts: Account[];
  onSubmit: (statement: StatementOfPayment) => void;
  onCancel: () => void;
  initialData?: StatementOfPayment;
}

export function StatementOfPaymentForm({ paymentVouchers, accounts, onSubmit, onCancel, initialData }: StatementOfPaymentFormProps) {
  const { user } = useAuth();
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize selectedVoucher from initialData if editing
  const initialVoucher = initialData?.linkedVoucherId
    ? paymentVouchers.find(v => v.id === initialData.linkedVoucherId) || null
    : null;

  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(initialVoucher);
  const [attachmentName, setAttachmentName] = useState<string>(initialData?.transferProofAttachment || '');
  const [transferProofBase64, setTransferProofBase64] = useState<string>(initialData?.transferProofBase64 || '');

  const [formData, setFormData] = useState({
    documentNumber: initialData?.documentNumber || DocumentNumberService.generateDocumentNumber('statement_of_payment'),
    linkedVoucherId: initialData?.linkedVoucherId || '',
    paymentDate: initialData?.paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod: initialData?.paymentMethod || '',
    transactionReference: initialData?.transactionReference || '',
    confirmedBy: initialData?.confirmedBy || '',
    accountId: initialData?.accountId || '',
    transactionFee: initialData?.transactionFee?.toString() || '0',
    transactionFeeType: initialData?.transactionFeeType || '',
    notes: initialData?.notes || '',
  });

  const handleVoucherSelect = (voucherId: string) => {
    const voucher = paymentVouchers.find(v => v.id === voucherId);
    if (voucher) {
      setSelectedVoucher(voucher);
      setFormData({
        ...formData,
        linkedVoucherId: voucherId,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);

      // Check if file is a PDF
      if (file.type === 'application/pdf') {
        try {
          // Import pdfjs-dist dynamically
          const pdfjsLib = await import('pdfjs-dist');

          // Set worker path
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

          // Read PDF file as array buffer
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

          // Get first page
          const page = await pdf.getPage(1);

          // Set up canvas for rendering
          const scale = 2.0; // Higher scale for better quality
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render PDF page to canvas
          await page.render({
            canvasContext: context!,
            viewport: viewport,
          }).promise;

          // Convert canvas to base64 image
          const base64String = canvas.toDataURL('image/jpeg', 0.95);
          setTransferProofBase64(base64String);
        } catch (error) {
          console.error('Error converting PDF to image:', error);
          setValidationError('Failed to process PDF file. Please try uploading a JPG or PNG instead.');
        }
      } else {
        // For image files, convert to base64 directly
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setTransferProofBase64(base64String);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.linkedVoucherId) {
      setValidationError('Payment voucher link is required');
      return;
    }
    if (!selectedVoucher) {
      setValidationError('Invalid payment voucher selected');
      return;
    }
    if (!formData.paymentMethod.trim()) {
      setValidationError('Payment method is required');
      return;
    }
    if (!formData.transactionReference.trim()) {
      setValidationError('Transaction reference is required');
      return;
    }
    if (!formData.confirmedBy.trim()) {
      setValidationError('Confirmed by field is required');
      return;
    }
    if (!formData.accountId) {
      setValidationError('Payment account is required');
      return;
    }

    const selectedAccount = accounts.find(acc => acc.id === formData.accountId);

    // Calculate transaction fee and total deducted
    const transactionFee = parseFloat(formData.transactionFee) || 0;
    const totalDeducted = selectedVoucher.total + transactionFee;

    const now = new Date().toISOString();
    const userReference = user ? {
      id: user.id,
      name: user.fullName,
      username: user.username
    } : undefined;

    // Debug logging
    console.log('=== Creating Statement of Payment ===');
    console.log('Selected Voucher:', selectedVoucher);
    console.log('Voucher Document Number:', selectedVoucher.documentNumber);
    console.log('Linked Voucher ID:', formData.linkedVoucherId);
    console.log('Selected Account:', selectedAccount);
    console.log('Transaction Fee:', transactionFee);
    console.log('Total Deducted:', totalDeducted);

    const statement: StatementOfPayment = {
      id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentType: 'statement_of_payment',
      documentNumber: formData.documentNumber,
      date: formData.paymentDate,
      status: 'completed',
      currency: selectedVoucher.currency,
      amount: selectedVoucher.amount,
      country: selectedVoucher.country,
      accountId: formData.accountId,
      accountName: selectedAccount?.name || undefined,
      linkedVoucherId: formData.linkedVoucherId,
      linkedVoucherNumber: selectedVoucher.documentNumber,
      paymentDate: formData.paymentDate,
      paymentMethod: formData.paymentMethod,
      transactionReference: formData.transactionReference,
      transferProofAttachment: attachmentName || undefined,
      transferProofBase64: transferProofBase64 || undefined,
      confirmedBy: formData.confirmedBy,
      payeeName: selectedVoucher.payeeName,
      notes: formData.notes || undefined,
      // Include items from payment voucher
      items: selectedVoucher.items,
      subtotal: selectedVoucher.subtotal,
      taxRate: selectedVoucher.taxRate,
      taxAmount: selectedVoucher.taxAmount,
      total: selectedVoucher.total,
      // Transaction fees
      transactionFee: transactionFee > 0 ? transactionFee : undefined,
      transactionFeeType: formData.transactionFeeType || undefined,
      totalDeducted: totalDeducted,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      createdBy: initialData?.createdBy || userReference,
      updatedBy: userReference,
      lastModifiedAt: now,
    };

    console.log('Created Statement:', statement);
    console.log('linkedVoucherNumber in statement:', statement.linkedVoucherNumber);

    onSubmit(statement);
  };

  // When editing, include the linked voucher even if it's completed
  // When creating, only show issued vouchers
  const issuedVouchers = initialData
    ? paymentVouchers.filter(v => v.status === 'issued' || v.id === initialData.linkedVoucherId)
    : paymentVouchers.filter(v => v.status === 'issued');

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{initialData ? 'Edit Statement of Payment' : 'Create Statement of Payment'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {!initialData && issuedVouchers.length === 0 && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                No issued payment vouchers available. You need to create and approve a payment voucher first.
              </AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentNumber">Statement Number *</Label>
              <Input
                id="documentNumber"
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>
          </div>

          {/* Link to Payment Voucher */}
          <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
            <Label htmlFor="linkedVoucher">Link to Payment Voucher *</Label>
            <Select
              value={formData.linkedVoucherId}
              onValueChange={handleVoucherSelect}
              disabled={issuedVouchers.length === 0}
            >
              <SelectTrigger id="linkedVoucher">
                <SelectValue placeholder="Select a payment voucher" />
              </SelectTrigger>
              <SelectContent>
                {issuedVouchers.map((voucher) => (
                  <SelectItem key={voucher.id} value={voucher.id}>
                    {voucher.documentNumber} - {voucher.payeeName} - {voucher.currency} {voucher.amount.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVoucher && (
              <div className="mt-3 p-3 bg-white rounded border text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500">Payee:</span>
                    <div>{selectedVoucher.payeeName}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <div>{selectedVoucher.currency} {selectedVoucher.amount.toFixed(2)}</div>
                  </div>
                  {selectedVoucher.items && selectedVoucher.items.length > 0 ? (
                    <div className="col-span-2">
                      <span className="text-gray-500">Items:</span>
                      <div className="mt-1 space-y-1">
                        {selectedVoucher.items.map((item, index) => (
                          <div key={item.id} className="text-xs">
                            {index + 1}. {item.description} - {selectedVoucher.currency} {item.amount.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : selectedVoucher.purpose ? (
                    <div className="col-span-2">
                      <span className="text-gray-500">Purpose:</span>
                      <div>{selectedVoucher.purpose}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {accounts.filter(acc => acc.isActive).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Online Payment">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionReference">Transaction Reference *</Label>
              <Input
                id="transactionReference"
                placeholder="e.g., TXN123456789"
                value={formData.transactionReference}
                onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
              />
            </div>
          </div>

          {/* Transaction Fees */}
          <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="text-sm font-semibold">Transaction Fees (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transactionFee">Transaction Fee Amount</Label>
                <Input
                  id="transactionFee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.transactionFee}
                  onChange={(e) => setFormData({ ...formData, transactionFee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionFeeType">Fee Type</Label>
                <Select
                  value={formData.transactionFeeType}
                  onValueChange={(value) => setFormData({ ...formData, transactionFeeType: value })}
                >
                  <SelectTrigger id="transactionFeeType">
                    <SelectValue placeholder="Select fee type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATM Withdrawal Fee">ATM Withdrawal Fee</SelectItem>
                    <SelectItem value="Wire Transfer Fee">Wire Transfer Fee</SelectItem>
                    <SelectItem value="International Transfer Fee">International Transfer Fee</SelectItem>
                    <SelectItem value="Currency Conversion Fee">Currency Conversion Fee</SelectItem>
                    <SelectItem value="Bank Service Charge">Bank Service Charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedVoucher && (
              <div className="p-3 bg-white rounded border text-sm">
                <div className="font-semibold mb-2">Payment Breakdown</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Voucher Amount:</span>
                    <span>{selectedVoucher.currency} {selectedVoucher.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transaction Fee:</span>
                    <span>{selectedVoucher.currency} {(parseFloat(formData.transactionFee) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total Deducted:</span>
                    <span>{selectedVoucher.currency} {(selectedVoucher.total + (parseFloat(formData.transactionFee) || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transfer Proof */}
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <Label htmlFor="transferProof">Transfer Proof Attachment</Label>
            <div className="flex items-center gap-2">
              <Input
                id="transferProof"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                className="cursor-pointer"
              />
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            {attachmentName && (
              <p className="text-sm text-green-600">✓ File selected: {attachmentName}</p>
            )}
            <p className="text-xs text-gray-500">
              Upload bank transfer receipt or payment proof (PDF, JPG, PNG)
            </p>
          </div>

          {/* Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirmedBy">Confirmed By *</Label>
            <Input
              id="confirmedBy"
              placeholder="Name of person confirming payment"
              value={formData.confirmedBy}
              onChange={(e) => setFormData({ ...formData, confirmedBy: e.target.value })}
            />
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
            <Button
              type="submit"
              className="flex-1"
              disabled={issuedVouchers.length === 0}
            >
              {initialData ? 'Update Statement of Payment' : 'Create Statement of Payment'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
