/**
 * Operations Portal
 *
 * Dedicated interface for operations role users.
 * Limited access to Payment Vouchers and Bookings only.
 */

import { useState, useEffect } from 'react';
import { PaymentVoucherForm } from './PaymentVoucherForm';
import { DocumentList } from './DocumentList';
import { BookingManagement } from './BookingManagement';
import { useAuth } from '../contexts/AuthContext';
import { Document, PaymentVoucher } from '../types/document';
import { Account } from '../types/account';
import { logAuthEvent, logDocumentEvent } from '../services/activityLogService';
import { hasPermission } from '../services/userService';
import { canDeleteDocument } from '../utils/permissions';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowLeft, LogOut, User, FileText, Plane, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import * as SupabaseService from '../services/supabaseService';

export function OperationsApp() {
  const { user, logout } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucher | null>(null);

  // Handle logout
  const handleLogout = () => {
    if (user) {
      logAuthEvent('auth:logout', user);
    }
    logout();
    toast.info('Logged out successfully');
  };

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const company = await SupabaseService.getOrCreateDefaultCompany();
        setCompanyId(company.id);

        const [loadedDocs, loadedAccounts] = await Promise.all([
          SupabaseService.getDocuments(company.id, 'operations'), // Filter to payment_voucher only
          SupabaseService.getAccounts(company.id)
        ]);

        setDocuments(loadedDocs);
        setAccounts(loadedAccounts);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load data');
      }
    }

    loadData();
  }, []);

  // Filter to only payment vouchers
  const paymentVouchers = documents.filter(doc => doc.documentType === 'payment_voucher');

  const handleVoucherCreated = async (document: Document) => {
    if (!companyId) {
      toast.error('Company not initialized');
      return;
    }

    try {
      if (editingVoucher) {
        // Update existing voucher
        const updatedDoc = await SupabaseService.updateDocument(editingVoucher.id, document);
        if (updatedDoc) {
          setDocuments(prev => prev.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));

          if (user) {
            logDocumentEvent('document:updated', user, updatedDoc);
          }
        }

        toast.success('Payment Voucher updated');
      } else {
        // Create new voucher
        const createdDoc = await SupabaseService.createDocument(companyId, document);
        setDocuments(prev => [...prev, createdDoc]);

        if (user) {
          logDocumentEvent('document:created', user, createdDoc);
        }

        toast.success('Payment Voucher created');
      }

      setShowVoucherForm(false);
      setEditingVoucher(null);
    } catch (error) {
      console.error('Error saving voucher:', error);
      toast.error('Failed to save Payment Voucher');
    }
  };

  const handleEditVoucher = (document: Document) => {
    if (document.documentType === 'payment_voucher') {
      setEditingVoucher(document as PaymentVoucher);
      setShowVoucherForm(true);
    }
  };

  /**
   * Handle document deletion with permission check and activity logging.
   * Note: Operations users do NOT have 'documents:delete' permission,
   * so this handler will only be used if a manager/admin accesses this portal.
   */
  const handleDeleteVoucher = async (documentId: string) => {
    if (!user) {
      toast.error('You must be logged in to delete documents');
      return;
    }

    // Find the document to delete
    const documentToDelete = documents.find(doc => doc.id === documentId);
    if (!documentToDelete) {
      toast.error('Document not found');
      return;
    }

    // Permission check - use the fine-grained permission helper
    if (!canDeleteDocument(user, documentToDelete)) {
      toast.error('You do not have permission to delete this document');
      return;
    }

    try {
      await SupabaseService.deleteDocument(documentId);

      // Log the deletion activity
      logDocumentEvent('document:deleted', user, documentToDelete, {
        deletedAt: new Date().toISOString(),
        documentNumber: documentToDelete.documentNumber,
        documentType: documentToDelete.documentType,
      });

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));

      toast.success(`Payment Voucher ${documentToDelete.documentNumber} deleted`);
    } catch (error) {
      console.error('Error deleting voucher:', error);
      toast.error('Failed to delete Payment Voucher');
    }
  };

  // Check if current user can delete documents (for conditional UI rendering)
  const userCanDelete = user ? hasPermission(user, 'documents:delete') : false;

  // Stats for dashboard
  const voucherStats = {
    total: paymentVouchers.length,
    draft: paymentVouchers.filter(d => d.status === 'draft').length,
    pending: paymentVouchers.filter(d => d.status === 'issued').length,
    completed: paymentVouchers.filter(d => d.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />

      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">WIF Operations Portal</h1>
              <p className="text-gray-600 text-sm mt-1">
                Payment Vouchers & Bookings
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* User Info */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
                <User className="w-4 h-4 text-gray-700" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user?.fullName}</div>
                  <div className="text-xs text-gray-600">Operations</div>
                </div>
              </div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {showVoucherForm ? (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowVoucherForm(false);
                setEditingVoucher(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to List
            </Button>

            <PaymentVoucherForm
              accounts={accounts}
              onSubmit={handleVoucherCreated}
              onCancel={() => {
                setShowVoucherForm(false);
                setEditingVoucher(null);
              }}
              initialData={editingVoucher || undefined}
            />
          </div>
        ) : (
          <Tabs defaultValue="vouchers" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="vouchers" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Payment Vouchers
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Bookings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vouchers" className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-600">Total Vouchers</div>
                    <div className="text-2xl font-semibold">{voucherStats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-600">Draft</div>
                    <div className="text-2xl font-semibold text-gray-500">{voucherStats.draft}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-600">Pending</div>
                    <div className="text-2xl font-semibold text-blue-600">{voucherStats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-600">Completed</div>
                    <div className="text-2xl font-semibold text-green-600">{voucherStats.completed}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Create Button */}
              <div>
                <Button
                  onClick={() => setShowVoucherForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Payment Voucher
                </Button>
              </div>

              {/* Voucher List - filtered to only show payment vouchers */}
              {/* onDelete is only passed if user has 'documents:delete' permission */}
              {/* Operations users do NOT have this permission, so delete button won't appear for them */}
              <DocumentList
                documents={paymentVouchers}
                onEdit={handleEditVoucher}
                onDelete={userCanDelete ? handleDeleteVoucher : undefined}
              />
            </TabsContent>

            <TabsContent value="bookings" className="space-y-6">
              {companyId && (
                <BookingManagement companyId={companyId} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
