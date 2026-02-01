import { useState, useCallback, CSSProperties, ReactElement } from 'react';
import { List } from 'react-window';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BookingWithProfit, BookingStatus, Booking } from '../types/booking';
import { formatDate } from './ui/date-picker';
import {
  Plane,
  Calendar,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Eye,
  Printer,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { BookingPrintDialog, PrintOptions } from './BookingPrintDialog';
import { BookingFormPrintDialog, BookingFormPrintOptions } from './BookingFormPrintDialog';
import { getCompanyInfoAsync } from './Settings';
import { useAuth } from '../contexts/AuthContext';
import { logBookingEvent } from '../services/activityLogService';
import { toast } from 'sonner';
import { statusBadge } from '../utils/statusBadges';

interface BookingListProps {
  bookings: BookingWithProfit[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView?: (booking: BookingWithProfit) => void;
  onEdit?: (booking: BookingWithProfit) => void;
  onDelete?: (bookingId: string) => void;
}

export function BookingList({ bookings, total, page, pageSize, onPageChange, onView, onEdit, onDelete }: BookingListProps) {
  const { user } = useAuth();
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedBookingForPrint, setSelectedBookingForPrint] = useState<BookingWithProfit | null>(null);
  const [formPrintDialogOpen, setFormPrintDialogOpen] = useState(false);
  const [selectedBookingForFormPrint, setSelectedBookingForFormPrint] = useState<BookingWithProfit | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const handlePrintClick = (booking: BookingWithProfit, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookingForPrint(booking);
    setPrintDialogOpen(true);
  };

  const handlePrint = async (options: PrintOptions) => {
    if (!selectedBookingForPrint) return;

    try {
      // Lazy-load PDF service for code splitting
      const { PdfService } = await import('../services/pdfService');

      const companyInfo = await getCompanyInfoAsync();
      const printerInfo = user ? {
        userName: user.fullName,
        printDate: new Date().toISOString()
      } : undefined;

      await PdfService.downloadBookingCard(
        selectedBookingForPrint as Booking,
        options,
        companyInfo,
        printerInfo
      );

      // Log booking card print activity
      if (user) {
        logBookingEvent(
          'booking:card_printed',
          user,
          {
            id: selectedBookingForPrint.id,
            bookingCode: selectedBookingForPrint.bookingCode,
            guestName: selectedBookingForPrint.guestName,
            status: selectedBookingForPrint.status
          },
          {
            categoriesPrinted: options.categories,
            categoryCount: options.categories.length,
            includePrices: options.includePrices,
            outputFormat: options.outputFormat,
            country: selectedBookingForPrint.country,
            tripStartDate: selectedBookingForPrint.tripStartDate,
            tripEndDate: selectedBookingForPrint.tripEndDate,
          }
        );
      }

      const categoryCount = options.categories.length;
      toast.success('Booking cards generated', {
        description: `${categoryCount} ${categoryCount === 1 ? 'card' : 'cards'} downloaded for ${selectedBookingForPrint.bookingCode}`
      });
    } catch (error) {
      console.error('Failed to print booking cards:', error);
      toast.error('Failed to generate booking cards', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  };

  const handleFormPrintClick = (booking: BookingWithProfit, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookingForFormPrint(booking);
    setFormPrintDialogOpen(true);
  };

  const handleFormPrint = async (options: BookingFormPrintOptions) => {
    if (!selectedBookingForFormPrint) return;

    try {
      // Lazy-load PDF service for code splitting
      const { PdfService } = await import('../services/pdfService');

      const companyInfo = await getCompanyInfoAsync();

      await PdfService.downloadBookingForm(
        selectedBookingForFormPrint as Booking,
        options,
        companyInfo
      );

      // Log booking form print activity
      if (user) {
        logBookingEvent(
          'booking:form_printed',
          user,
          {
            id: selectedBookingForFormPrint.id,
            bookingCode: selectedBookingForFormPrint.bookingCode,
            guestName: selectedBookingForFormPrint.guestName,
            status: selectedBookingForFormPrint.status
          },
          {
            pricingDisplay: options.pricingDisplay,
            includeNotes: options.includeNotes,
            includeEmptyCategories: options.includeEmptyCategories,
            showProfitMargin: options.showProfitMargin,
            showExchangeRate: options.showExchangeRate,
            country: selectedBookingForFormPrint.country,
            tripStartDate: selectedBookingForFormPrint.tripStartDate,
            tripEndDate: selectedBookingForFormPrint.tripEndDate,
          }
        );
      }

      toast.success('Booking form generated', {
        description: `Form downloaded for ${selectedBookingForFormPrint.bookingCode}`
      });
    } catch (error) {
      console.error('Failed to print booking form:', error);
      toast.error('Failed to generate booking form', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  };

  // Use unified status badge utility for consistent styling
  const getStatusBadge = (status: BookingStatus) => statusBadge(status);

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-green-600';
    if (profit < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getProfitIcon = (profit: number) => {
    if (profit > 0) return <TrendingUp className="w-4 h-4" />;
    if (profit < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const filterByStatus = (status: BookingStatus) => {
    return bookings.filter(b => b.status === status)
      .sort((a, b) => new Date(b.tripStartDate).getTime() - new Date(a.tripStartDate).getTime());
  };

  // Height for each booking card in the virtualized list
  const ITEM_HEIGHT = 280;
  const LIST_HEIGHT = 600;

  // Row component for the virtualized list
  interface BookingRowProps {
    bookingList: BookingWithProfit[];
  }

  const BookingRow = ({ index, style, bookingList }: {
    index: number;
    style: CSSProperties;
    ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
  } & BookingRowProps): ReactElement | null => {
    const booking = bookingList[index];
    if (!booking) return null;

    return (
      <div style={{ ...style, paddingRight: '16px', paddingBottom: '12px' }}>
        {renderBookingCard(booking)}
      </div>
    );
  };

  // Render virtualized list for a given set of bookings
  const renderVirtualizedList = useCallback((bookingList: BookingWithProfit[], emptyMessage: string) => {
    if (bookingList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center h-[600px]">
          <Plane className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <List
        defaultHeight={LIST_HEIGHT}
        rowCount={bookingList.length}
        rowHeight={ITEM_HEIGHT}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        rowComponent={BookingRow}
        rowProps={{ bookingList }}
      />
    );
  }, []);

  const renderBookingCard = (booking: BookingWithProfit) => (
    <div
      key={booking.id}
      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onView?.(booking)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Plane className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{booking.guestName}</h3>
            <p className="text-sm text-gray-500">{booking.bookingCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusBadge(booking.status).className}>
            {getStatusBadge(booking.status).label}
          </Badge>
          {!booking.isActive && (
            <Badge variant="outline" className="bg-gray-100">Inactive</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">{formatDate(booking.tripStartDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">{booking.country}</span>
        </div>
        {booking.numberOfPax && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{booking.numberOfPax}</span>
          </div>
        )}
      </div>

      <div className="border-t pt-3 mt-3">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">B2B Price</p>
            <p className="text-sm font-medium text-gray-900">
              {formatAmount(booking.b2bPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">WIF Cost</p>
            <p className="text-sm font-medium text-gray-900">
              {formatAmount(booking.wifCost)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {getProfitIcon(booking.expectedProfit)}
            <span className={`text-sm font-semibold ${getProfitColor(booking.expectedProfit)}`}>
              {formatAmount(booking.expectedProfit)}
            </span>
            <span className="text-xs text-gray-500">
              ({formatPercentage(booking.profitMargin)})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(booking);
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handlePrintClick(booking, e)}
              title="Print booking cards"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleFormPrintClick(booking, e)}
              title="Print full form"
            >
              <FileText className="w-4 h-4" />
            </Button>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(booking);
                }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Booking</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{booking.guestName} - {booking.bookingCode}"? This will mark it as inactive.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(booking.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const planningBookings = filterByStatus('planning');
  const confirmedBookings = filterByStatus('confirmed');
  const inProgressBookings = filterByStatus('in_progress');
  const completedBookings = filterByStatus('completed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="w-5 h-5" />
          Bookings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({bookings.length})</TabsTrigger>
            <TabsTrigger value="planning">Planning ({planningBookings.length})</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed ({confirmedBookings.length})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({inProgressBookings.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {renderVirtualizedList(
              [...bookings].sort((a, b) => new Date(b.tripStartDate).getTime() - new Date(a.tripStartDate).getTime()),
              'No bookings found'
            )}
          </TabsContent>

          <TabsContent value="planning">
            {renderVirtualizedList(planningBookings, 'No bookings in planning')}
          </TabsContent>

          <TabsContent value="confirmed">
            {renderVirtualizedList(confirmedBookings, 'No confirmed bookings')}
          </TabsContent>

          <TabsContent value="in_progress">
            {renderVirtualizedList(inProgressBookings, 'No bookings in progress')}
          </TabsContent>

          <TabsContent value="completed">
            {renderVirtualizedList(completedBookings, 'No completed bookings')}
          </TabsContent>
        </Tabs>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-sm text-gray-600">
              Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total} bookings
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

      {/* Print Dialog */}
      {selectedBookingForPrint && (
        <BookingPrintDialog
          booking={selectedBookingForPrint}
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          onPrint={handlePrint}
        />
      )}

      {/* Form Print Dialog */}
      <BookingFormPrintDialog
        booking={selectedBookingForFormPrint}
        open={formPrintDialogOpen}
        onOpenChange={setFormPrintDialogOpen}
        onPrint={handleFormPrint}
      />
    </Card>
  );
}
