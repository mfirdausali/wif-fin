// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { AlertCircle, Plus, Trash2, Upload, Loader2 } from 'lucide-react';
import { PaymentVoucher, Currency, Country, LineItem } from '../types/document';
import { Account } from '../types/account';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { canApproveVouchers } from '../utils/permissions';
import { DatePicker, getTodayISO } from './ui/date-picker';
import { logDocumentEvent } from '../services/activityLogService';
import { uploadFile, getSignedUrl, deleteFile } from '../services/storageService';

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

  // Supporting document state
  const [supportingDocName, setSupportingDocName] = useState<string>(initialData?.supportingDocFilename || '');
  const [supportingDocBase64, setSupportingDocBase64] = useState<string>(initialData?.supportingDocBase64 || '');
  const [supportingDocStoragePath, setSupportingDocStoragePath] = useState<string>(initialData?.supportingDocStoragePath || '');
  const [supportingDocPreviewUrl, setSupportingDocPreviewUrl] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // File size limit: 5MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  // Load preview URL from storage path on mount (for existing vouchers)
  useEffect(() => {
    async function loadPreviewUrl() {
      // Prefer storage path over base64 (storage is the new format)
      if (supportingDocStoragePath) {
        try {
          const signedUrl = await getSignedUrl(supportingDocStoragePath);
          if (signedUrl) {
            setSupportingDocPreviewUrl(signedUrl);
          }
        } catch (error) {
          console.error('Failed to load preview from storage:', error);
          // Fall back to base64 if storage fails
          if (supportingDocBase64) {
            setSupportingDocPreviewUrl(supportingDocBase64);
          }
        }
      } else if (supportingDocBase64) {
        // Legacy: use base64 if no storage path
        setSupportingDocPreviewUrl(supportingDocBase64);
      }
    }

    loadPreviewUrl();
  }, [supportingDocStoragePath, supportingDocBase64]);

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

  // Handle supporting document file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setValidationError('File size exceeds 5MB limit. Please choose a smaller file.');
        e.target.value = ''; // Reset the input
        return;
      }

      setValidationError(null);
      setIsProcessingFile(true);
      setUploadProgress(0);
      setSupportingDocName(file.name);

      try {
        // For preview purposes, still convert to base64
        // This will be used for immediate preview before upload
        let previewBase64 = '';

        // Check if file is a PDF
        if (file.type === 'application/pdf') {
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

          // Convert canvas to base64 image for preview
          previewBase64 = canvas.toDataURL('image/jpeg', 0.95);
        } else {
          // For image files, convert to base64 for preview
          await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              previewBase64 = reader.result as string;
              resolve();
            };
            reader.onerror = () => {
              reject(new Error('Failed to read file'));
            };
            reader.readAsDataURL(file);
          });
        }

        // Set preview URL immediately
        setSupportingDocPreviewUrl(previewBase64);

        // Store base64 for preview and backward compatibility
        // But we'll upload to storage on submit
        setSupportingDocBase64(previewBase64);

        // Store the file object for upload on submit
        // We'll use a temporary state for this
        (window as any).__pendingFileUpload = file;

        setUploadProgress(100);
      } catch (error) {
        console.error('Error processing file:', error);
        setValidationError('Failed to process file. Please try uploading a JPG or PNG instead.');
        setSupportingDocName('');
        setSupportingDocBase64('');
        setSupportingDocPreviewUrl('');
      } finally {
        setIsProcessingFile(false);
      }
    }
  };

  // Handle removing the supporting document
  const handleRemoveFile = async () => {
    // If there's a storage path and we're editing an existing document, delete from storage
    if (supportingDocStoragePath && initialData?.id) {
      try {
        await deleteFile(supportingDocStoragePath);
      } catch (error) {
        console.error('Failed to delete file from storage:', error);
        // Continue anyway - we'll clear the reference
      }
    }

    // Clear all file-related state
    setSupportingDocName('');
    setSupportingDocBase64('');
    setSupportingDocStoragePath('');
    setSupportingDocPreviewUrl('');
    setUploadProgress(0);
    delete (window as any).__pendingFileUpload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    // Handle file upload to Supabase Storage if there's a pending file
    let finalStoragePath = supportingDocStoragePath;
    let finalBase64 = supportingDocBase64;

    const pendingFile = (window as any).__pendingFileUpload;
    if (pendingFile) {
      try {
        setIsProcessingFile(true);
        setUploadProgress(0);

        // Generate temporary document ID for upload path (will use real ID after creation)
        const tempDocId = initialData?.id || `temp-${Date.now()}`;

        // Upload file to Supabase Storage
        const uploadResult = await uploadFile(
          pendingFile,
          supportingDocName,
          'payment_voucher',
          tempDocId
        );

        setUploadProgress(50);

        if (uploadResult.success && uploadResult.path) {
          finalStoragePath = uploadResult.path;
          // Keep base64 for backward compatibility and PDF generation
          finalBase64 = supportingDocBase64;

          setUploadProgress(100);
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }

        // Clear pending file
        delete (window as any).__pendingFileUpload;
      } catch (error) {
        console.error('Error uploading file:', error);
        setValidationError(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsProcessingFile(false);
        return;
      } finally {
        setIsProcessingFile(false);
      }
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
      supportingDocFilename: supportingDocName || undefined,
      supportingDocBase64: finalBase64 || undefined,
      supportingDocStoragePath: finalStoragePath || undefined,
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
              <div key={item.id} className="p-3 bg-gray-50 rounded-lg space-y-3">
                {/* Mobile: Stack vertically, Desktop: Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-2 md:items-end">
                  <div className="md:col-span-5 space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:contents">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Amount</Label>
                      <Input value={item.amount.toFixed(2)} disabled />
                    </div>
                  </div>
                  <div className="md:col-span-1 flex justify-end md:justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="h-9 w-9"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
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

          {/* Supporting Document - Moved up for better visibility on mobile */}
          <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Label htmlFor="supportingDoc" className="text-base font-medium">Supporting Document</Label>
            <p className="text-xs text-gray-600 mb-2">
              Attach supporting documents such as quotations, invoices, or receipts
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="supportingDoc"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,image/*"
                capture="environment"
                className="cursor-pointer"
                disabled={isProcessingFile}
              />
              {isProcessingFile ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-blue-500" />
              )}
            </div>
            {isProcessingFile && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 p-2 bg-white rounded border">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <p className="text-sm text-blue-600">
                    {uploadProgress > 0 && uploadProgress < 100
                      ? `Uploading... ${uploadProgress}%`
                      : 'Processing file...'}
                  </p>
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {supportingDocName && !isProcessingFile && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <p className="text-sm text-green-600 truncate">✓ {supportingDocName}</p>
                    {supportingDocStoragePath && (
                      <span className="text-xs text-gray-500 flex-shrink-0">(Stored)</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-red-500 hover:text-red-700 h-6 px-2 ml-2"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
                {supportingDocPreviewUrl && (
                  <div className="p-2 bg-white rounded border">
                    <img
                      src={supportingDocPreviewUrl}
                      alt="Preview"
                      className="max-w-full h-auto max-h-48 object-contain mx-auto rounded"
                    />
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Accepted formats: PDF, JPG, PNG (max 5MB). On mobile, you can also take a photo.
            </p>
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
