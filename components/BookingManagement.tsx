import { useState, useEffect } from 'react';
import { BookingList } from './BookingList';
import { BookingForm } from './BookingForm';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { Booking, BookingWithProfit } from '../types/booking';
import {
  getAllBookingsWithProfit,
  createBooking,
  updateBooking,
  deleteBooking
} from '../services/bookingService';
import { logBookingEvent } from '../services/activityLogService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { canCreateDocuments } from '../utils/permissions';

interface BookingManagementProps {
  companyId: string;
}

type ViewMode = 'list' | 'create' | 'edit';

export function BookingManagement({ companyId }: BookingManagementProps) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithProfit[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithProfit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [companyId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await getAllBookingsWithProfit(companyId);
      setBookings(data);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      toast.error('Failed to load bookings', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: Omit<Booking, 'id' | 'bookingCode' | 'createdAt' | 'updatedAt'>) => {
    try {
      const createdBooking = await createBooking(data);

      // Log booking creation activity
      if (user) {
        logBookingEvent(
          'booking:created',
          { id: user.id, username: user.username, fullName: user.fullName },
          {
            id: createdBooking.id,
            bookingCode: createdBooking.bookingCode,
            guestName: createdBooking.guestName,
            status: createdBooking.status
          },
          {
            country: createdBooking.country,
            tripStartDate: createdBooking.tripStartDate,
            tripEndDate: createdBooking.tripEndDate,
            numberOfPax: createdBooking.numberOfPax,
            b2bPrice: createdBooking.b2bPrice,
            wifCost: createdBooking.wifCost,
            expectedProfit: createdBooking.expectedProfit,
          }
        );
      }

      toast.success('Booking created successfully');
      await loadBookings();
      setViewMode('list');
    } catch (error) {
      console.error('Failed to create booking:', error);
      toast.error('Failed to create booking', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleEdit = async (data: Omit<Booking, 'id' | 'bookingCode' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedBooking) return;

    const previousStatus = selectedBooking.status;

    try {
      const updatedBooking = await updateBooking(selectedBooking.id, data);

      // Log booking update activity
      if (user) {
        // Check if status changed
        const statusChanged = previousStatus !== updatedBooking.status;

        if (statusChanged) {
          // Log status change event
          logBookingEvent(
            'booking:status_changed',
            { id: user.id, username: user.username, fullName: user.fullName },
            {
              id: updatedBooking.id,
              bookingCode: updatedBooking.bookingCode,
              guestName: updatedBooking.guestName,
              status: updatedBooking.status
            },
            {
              previousStatus: previousStatus,
              newStatus: updatedBooking.status,
              country: updatedBooking.country,
              tripStartDate: updatedBooking.tripStartDate,
              tripEndDate: updatedBooking.tripEndDate,
            }
          );
        }

        // Log general update event
        logBookingEvent(
          'booking:updated',
          { id: user.id, username: user.username, fullName: user.fullName },
          {
            id: updatedBooking.id,
            bookingCode: updatedBooking.bookingCode,
            guestName: updatedBooking.guestName,
            status: updatedBooking.status
          },
          {
            country: updatedBooking.country,
            tripStartDate: updatedBooking.tripStartDate,
            tripEndDate: updatedBooking.tripEndDate,
            numberOfPax: updatedBooking.numberOfPax,
            b2bPrice: updatedBooking.b2bPrice,
            wifCost: updatedBooking.wifCost,
            expectedProfit: updatedBooking.expectedProfit,
            statusChanged: statusChanged,
            previousStatus: statusChanged ? previousStatus : undefined,
          }
        );
      }

      toast.success('Booking updated successfully');
      await loadBookings();
      setViewMode('list');
      setSelectedBooking(null);
    } catch (error) {
      console.error('Failed to update booking:', error);
      toast.error('Failed to update booking', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDelete = async (bookingId: string) => {
    // Find the booking to be deleted for logging purposes
    const bookingToDelete = bookings.find(b => b.id === bookingId);

    try {
      await deleteBooking(bookingId);

      // Log booking deletion activity
      if (user && bookingToDelete) {
        logBookingEvent(
          'booking:deleted',
          { id: user.id, username: user.username, fullName: user.fullName },
          {
            id: bookingToDelete.id,
            bookingCode: bookingToDelete.bookingCode,
            guestName: bookingToDelete.guestName,
            status: bookingToDelete.status
          },
          {
            country: bookingToDelete.country,
            tripStartDate: bookingToDelete.tripStartDate,
            tripEndDate: bookingToDelete.tripEndDate,
            numberOfPax: bookingToDelete.numberOfPax,
            b2bPrice: bookingToDelete.b2bPrice,
            wifCost: bookingToDelete.wifCost,
            expectedProfit: bookingToDelete.expectedProfit,
          }
        );
      }

      toast.success('Booking deleted successfully');
      await loadBookings();
    } catch (error) {
      console.error('Failed to delete booking:', error);
      toast.error('Failed to delete booking', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleView = (booking: BookingWithProfit) => {
    // For now, just open edit mode
    // Later we can create a detailed view component
    setSelectedBooking(booking);
    setViewMode('edit');
  };

  const handleEditClick = (booking: BookingWithProfit) => {
    setSelectedBooking(booking);
    setViewMode('edit');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedBooking(null);
  };

  const canCreate = user && canCreateDocuments(user);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {viewMode === 'list' && (
        <>
          {canCreate && (
            <div className="flex justify-end">
              <Button onClick={() => setViewMode('create')}>
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            </div>
          )}
          <BookingList
            bookings={bookings}
            onView={handleView}
            onEdit={canCreate ? handleEditClick : undefined}
            onDelete={canCreate ? handleDelete : undefined}
          />
        </>
      )}

      {viewMode === 'create' && (
        <BookingForm
          companyId={companyId}
          onSubmit={handleCreate}
          onCancel={handleBack}
        />
      )}

      {viewMode === 'edit' && selectedBooking && (
        <BookingForm
          companyId={companyId}
          initialData={selectedBooking}
          onSubmit={handleEdit}
          onCancel={handleBack}
        />
      )}
    </div>
  );
}
