import { useState, useCallback, CSSProperties, ReactElement } from 'react';
import { List } from 'react-window';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Document, DocumentType } from '../types/document';
import { FileText, Receipt, FileCheck, CheckCircle2, Calendar, DollarSign, Edit, Trash2, Download, Loader2, Paperclip, ChevronLeft, ChevronRight, LayoutGrid, LayoutList } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { getCompanyInfoAsync } from './Settings';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from './ui/date-picker';
import { logDocumentEvent } from '../services/activityLogService';
import { getDocument } from '../services/supabaseService';
import { statusBadge } from '../utils/statusBadges';

interface DocumentListProps {
  documents: Document[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit?: (document: Document) => void;
  onDelete?: (documentId: string) => void;
}

type ViewMode = 'card' | 'table';

export function DocumentList({ documents, total, page, pageSize, onPageChange, onEdit, onDelete }: DocumentListProps) {
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  const handleDownloadPDF = async (doc: Document) => {
    setDownloadingId(doc.id);
    try {
      // Lazy-load PDF service for code splitting
      const { PdfService } = await import('../services/pdfService');

      // Fetch fresh document data to ensure we have the latest (including discounts)
      const freshDoc = await getDocument(doc.id, doc.documentType);

      const companyInfo = await getCompanyInfoAsync();
      const printerInfo = user ? {
        userName: user.fullName,
        printDate: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      } : undefined;

      await PdfService.downloadPDF(freshDoc, companyInfo, printerInfo);
      toast.success('PDF downloaded successfully');

      // Log document printed event
      if (user) {
        logDocumentEvent('document:printed', user, freshDoc, {
          printedBy: user.fullName,
          printDate: new Date().toISOString(),
        });
      }
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

  // Use unified status badge utility for consistent styling
  const getStatusBadge = (status: string) => statusBadge(status);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };


  const filterByType = (type: DocumentType) => {
    return documents.filter(doc => doc.documentType === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // Height for each document card in the virtualized list
  const ITEM_HEIGHT = 280;
  const LIST_HEIGHT = 600;

  // Row component for the virtualized list (react-window v2 API)
  interface DocumentRowProps {
    docs: Document[];
  }

  const DocumentRow = ({ index, style, docs }: {
    index: number;
    style: CSSProperties;
    ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
  } & DocumentRowProps): ReactElement | null => {
    const doc = docs[index];
    if (!doc) return null;

    return (
      <div style={{ ...style, paddingRight: '16px', paddingBottom: '12px' }}>
        {renderDocumentCard(doc)}
      </div>
    );
  };

  // Render virtualized list for a given set of documents
  const renderVirtualizedList = useCallback((docs: Document[], emptyIcon: React.ReactNode, emptyMessage: string) => {
    if (docs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center h-[600px]">
          {emptyIcon}
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <List
        defaultHeight={LIST_HEIGHT}
        rowCount={docs.length}
        rowHeight={ITEM_HEIGHT}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        rowComponent={DocumentRow}
        rowProps={{ docs }}
      />
    );
  }, []);

  const renderDocumentCard = (doc: Document) => (
    <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getDocumentIcon(doc.documentType)}
          <div>
            <div className="flex items-center gap-2">
              <span>{doc.documentNumber}</span>
              <Badge className={getStatusBadge(doc.status).className}>
                {getStatusBadge(doc.status).label}
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

      {doc.documentType === 'payment_voucher' && doc.supportingDocFilename && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Paperclip className="w-3 h-3 mr-1" />
            {doc.supportingDocFilename}
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
      {(doc.createdBy || (doc.documentType === 'payment_voucher' && doc.approvedBy)) && (
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

  // Get party name based on document type
  const getPartyName = (doc: Document) => {
    switch (doc.documentType) {
      case 'invoice':
        return doc.customerName || '-';
      case 'receipt':
        return doc.payerName || '-';
      case 'payment_voucher':
      case 'statement_of_payment':
        return doc.payeeName || '-';
      default:
        return '-';
    }
  };

  // Render table view for documents
  const renderTableView = useCallback((docs: Document[], emptyIcon: React.ReactNode, emptyMessage: string) => {
    if (docs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {emptyIcon}
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="max-h-[600px] overflow-auto border rounded-lg">
        <Table>
          <TableHeader sticky>
            <TableRow>
              <TableHead>Document #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {getDocumentIcon(doc.documentType)}
                    <span>{doc.documentNumber}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="capitalize text-xs">
                    {doc.documentType.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {getPartyName(doc)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDate(doc.date)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {doc.documentType === 'statement_of_payment' && doc.totalDeducted
                    ? formatAmount(doc.totalDeducted, doc.currency)
                    : formatAmount(doc.amount, doc.currency)}
                </TableCell>
                <TableCell>
                  <Badge className={`${getStatusBadge(doc.status).className} text-xs`}>
                    {getStatusBadge(doc.status).label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadPDF(doc)}
                      disabled={downloadingId === doc.id}
                      className="h-7 w-7 p-0"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                    </Button>
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(doc)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                    {onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3 h-3" />
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }, [downloadingId, onEdit, onDelete]);

  const invoices = filterByType('invoice');
  const receipts = filterByType('receipt');
  const vouchers = filterByType('payment_voucher');
  const statements = filterByType('statement_of_payment');

  const totalPages = Math.ceil(total / pageSize);

  // Render documents based on view mode
  const renderDocuments = (docs: Document[], emptyIcon: React.ReactNode, emptyMessage: string) => {
    if (viewMode === 'table') {
      return renderTableView(docs, emptyIcon, emptyMessage);
    }
    return renderVirtualizedList(docs, emptyIcon, emptyMessage);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Documents ({total})</CardTitle>
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="h-7 px-2"
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-7 px-2"
              title="Table view (dense)"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>
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
            {renderDocuments(
              [...documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
              <FileText className="w-12 h-12 text-gray-300 mb-3" />,
              'No documents created yet'
            )}
          </TabsContent>

          <TabsContent value="invoices">
            {renderDocuments(
              invoices,
              <FileText className="w-12 h-12 text-gray-300 mb-3" />,
              'No invoices created yet'
            )}
          </TabsContent>

          <TabsContent value="receipts">
            {renderDocuments(
              receipts,
              <Receipt className="w-12 h-12 text-gray-300 mb-3" />,
              'No receipts created yet'
            )}
          </TabsContent>

          <TabsContent value="vouchers">
            {renderDocuments(
              vouchers,
              <FileCheck className="w-12 h-12 text-gray-300 mb-3" />,
              'No payment vouchers created yet'
            )}
          </TabsContent>

          <TabsContent value="statements">
            {renderDocuments(
              statements,
              <CheckCircle2 className="w-12 h-12 text-gray-300 mb-3" />,
              'No statements of payment created yet'
            )}
          </TabsContent>
        </Tabs>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-sm text-gray-600">
              Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total} documents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600 px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
