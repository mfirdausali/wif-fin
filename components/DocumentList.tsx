import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Document, DocumentType } from '../types/document';
import { FileText, Receipt, FileCheck, CheckCircle2, Calendar, Building2, DollarSign, Edit, Trash2, Download, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { PdfService } from '../services/pdfService';
import { getCompanyInfo } from './Settings';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface DocumentListProps {
  documents: Document[];
  onEdit?: (document: Document) => void;
  onDelete?: (documentId: string) => void;
}

export function DocumentList({ documents, onEdit, onDelete }: DocumentListProps) {
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPDF = async (doc: Document) => {
    setDownloadingId(doc.id);
    try {
      const companyInfo = getCompanyInfo();
      const printerInfo = user ? {
        userName: user.fullName,
        printDate: new Date().toISOString()
      } : undefined;

      await PdfService.downloadPDF(doc, companyInfo, printerInfo);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to generate PDF', {
        description: error instanceof Error ? error.message : 'Please check if PDF service is running'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const getDocumentIcon = (type: DocumentType) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'receipt':
        return <Receipt className="w-5 h-5 text-green-600" />;
      case 'payment_voucher':
        return <FileCheck className="w-5 h-5 text-orange-600" />;
      case 'statement_of_payment':
        return <CheckCircle2 className="w-5 h-5 text-purple-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'issued':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAmount = (amount: number, currency: string) => {
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

  const filterByType = (type: DocumentType) => {
    return documents.filter(doc => doc.documentType === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const renderDocumentCard = (doc: Document) => (
    <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getDocumentIcon(doc.documentType)}
          <div>
            <div className="flex items-center gap-2">
              <span>{doc.documentNumber}</span>
              <Badge className={getStatusColor(doc.status)}>
                {doc.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {doc.documentType === 'invoice' && `Customer: ${doc.customerName}`}
              {doc.documentType === 'receipt' && `Payer: ${doc.payerName}`}
              {doc.documentType === 'payment_voucher' && `Payee: ${doc.payeeName}`}
              {doc.documentType === 'statement_of_payment' && `Payee: ${doc.payeeName}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div>
            {doc.documentType === 'statement_of_payment' && doc.totalDeducted
              ? formatAmount(doc.totalDeducted, doc.currency)
              : formatAmount(doc.amount, doc.currency)}
          </div>
          {doc.documentType === 'statement_of_payment' && doc.totalDeducted && doc.totalDeducted !== doc.amount && (
            <div className="text-xs text-gray-500">
              Voucher: {formatAmount(doc.amount, doc.currency)}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {doc.country === 'Malaysia' ? '🇲🇾' : '🇯🇵'} {doc.country}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span className="text-xs">{formatDate(doc.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          <span className="text-xs">{doc.currency}</span>
        </div>
      </div>

      {doc.documentType === 'invoice' && doc.dueDate && (
        <div className="mt-2 text-xs text-gray-600">
          Due: {formatDate(doc.dueDate)}
        </div>
      )}

      {doc.documentType === 'receipt' && doc.linkedInvoiceNumber && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            Linked to: {doc.linkedInvoiceNumber}
          </Badge>
        </div>
      )}

      {doc.documentType === 'statement_of_payment' && (
        <div className="mt-2 space-y-1">
          <Badge variant="outline" className="text-xs">
            Voucher: {doc.linkedVoucherNumber}
          </Badge>
          {doc.transactionReference && (
            <div className="text-xs text-gray-600">
              Ref: {doc.transactionReference}
            </div>
          )}
          {doc.transactionFee && doc.transactionFee > 0 && (
            <div className="text-xs text-amber-600 font-medium">
              Fee{doc.transactionFeeType ? ` (${doc.transactionFeeType})` : ''}: {formatAmount(doc.transactionFee, doc.currency)}
            </div>
          )}
        </div>
      )}

      {doc.notes && (
        <div className="mt-3 pt-3 border-t text-sm text-gray-600">
          <span className="text-xs text-gray-500">Notes: </span>
          {doc.notes}
        </div>
      )}

      {/* User tracking information */}
      {(doc.createdBy || doc.approvedBy) && (
        <div className="mt-3 pt-3 border-t space-y-1">
          {doc.createdBy && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-500">Created by:</span>{' '}
              <span className="font-medium">
                {typeof doc.createdBy === 'object' ? doc.createdBy.name : doc.createdBy}
              </span>
            </div>
          )}
          {doc.documentType === 'payment_voucher' && doc.approvedBy && (
            <div className="text-xs text-green-700">
              <span className="text-gray-500">Approved by:</span>{' '}
              <span className="font-medium">
                {typeof doc.approvedBy === 'object' ? doc.approvedBy.name : doc.approvedBy}
              </span>
              {doc.approvalDate && (
                <span className="text-gray-500 ml-1">
                  on {formatDate(doc.approvalDate)}
                </span>
              )}
            </div>
          )}
          {doc.updatedBy && doc.updatedBy.id !== doc.createdBy?.id && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-500">Last modified by:</span>{' '}
              <span className="font-medium">
                {typeof doc.updatedBy === 'object' ? doc.updatedBy.name : doc.updatedBy}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <span className="text-xs text-gray-400 font-mono">ID: {doc.id}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadPDF(doc)}
            disabled={downloadingId === doc.id}
            className="h-8"
          >
            {downloadingId === doc.id ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Download className="w-3 h-3 mr-1" />
            )}
            PDF
          </Button>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(doc)}
              className="h-8"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {doc.documentNumber}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(doc.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );

  const invoices = filterByType('invoice');
  const receipts = filterByType('receipt');
  const vouchers = filterByType('payment_voucher');
  const statements = filterByType('statement_of_payment');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({documents.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="receipts">Receipts ({receipts.length})</TabsTrigger>
            <TabsTrigger value="vouchers">Vouchers ({vouchers.length})</TabsTrigger>
            <TabsTrigger value="statements">Statements ({statements.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ScrollArea className="h-[600px] pr-4">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No documents created yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(renderDocumentCard)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="invoices">
            <ScrollArea className="h-[600px] pr-4">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No invoices created yet</p>
                </div>
              ) : (
                <div className="space-y-4">{invoices.map(renderDocumentCard)}</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="receipts">
            <ScrollArea className="h-[600px] pr-4">
              {receipts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Receipt className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No receipts created yet</p>
                </div>
              ) : (
                <div className="space-y-4">{receipts.map(renderDocumentCard)}</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="vouchers">
            <ScrollArea className="h-[600px] pr-4">
              {vouchers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileCheck className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No payment vouchers created yet</p>
                </div>
              ) : (
                <div className="space-y-4">{vouchers.map(renderDocumentCard)}</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="statements">
            <ScrollArea className="h-[600px] pr-4">
              {statements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No statements of payment created yet</p>
                </div>
              ) : (
                <div className="space-y-4">{statements.map(renderDocumentCard)}</div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
