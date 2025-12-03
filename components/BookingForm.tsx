import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { DatePicker, getTodayISO } from './ui/date-picker';
import { AlertCircle, Plane, Save, FileEdit, Printer } from 'lucide-react';
import { Booking, BookingStatus } from '../types/booking';
import { Alert, AlertDescription } from './ui/alert';
import { BookingFormLineItemEditor } from './BookingFormLineItemEditor';
import { BookingFormPrintDialog, BookingFormPrintOptions } from './BookingFormPrintDialog';
import { PdfService } from '../services/pdfService';
import { getCompanyInfoAsync } from './Settings';
import { useAuth } from '../contexts/AuthContext';
import { logBookingEvent } from '../services/activityLogService';
import { toast } from 'sonner';

interface BookingFormProps {
  onSubmit: (booking: Omit<Booking, 'id' | 'bookingCode' | 'createdAt' | 'updatedAt'>, isDraft?: boolean) => void;
  onCancel: () => void;
  initialData?: Booking;
  companyId: string;
}

export function BookingForm({ onSubmit, onCancel, initialData, companyId }: BookingFormProps) {
  const { user } = useAuth();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formPrintDialogOpen, setFormPrintDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    guestName: initialData?.guestName || '',
    tripStartDate: initialData?.tripStartDate || getTodayISO(),
    tripEndDate: initialData?.tripEndDate || '',
    numberOfPax: initialData?.numberOfPax || '',
    country: initialData?.country || 'Japan',
    carTypes: initialData?.carTypes || [],
    exchangeRate: initialData?.exchangeRate?.toString() || '0.031',
    status: initialData?.status || ('planning' as BookingStatus),
    isActive: initialData?.isActive ?? true,
    notes: initialData?.notes || '',
  });

  const [lineItems, setLineItems] = useState({
    transportationItems: initialData?.transportationItems || [],
    mealsItems: initialData?.mealsItems || [],
    entranceItems: initialData?.entranceItems || [],
    tourGuideItems: initialData?.tourGuideItems || [],
    flightItems: initialData?.flightItems || [],
    accommodationItems: initialData?.accommodationItems || [],
  });

  // Auto-calculate totals from line items
  const calculateTotals = () => {
    const categories = [
      { key: 'transportationItems' as const, items: lineItems.transportationItems },
      { key: 'mealsItems' as const, items: lineItems.mealsItems },
      { key: 'entranceItems' as const, items: lineItems.entranceItems },
      { key: 'tourGuideItems' as const, items: lineItems.tourGuideItems },
      { key: 'flightItems' as const, items: lineItems.flightItems },
      { key: 'accommodationItems' as const, items: lineItems.accommodationItems },
    ];

    let totalInternalJpy = 0;
    let totalB2BJpy = 0;

    const categoryTotals: any = {};

    categories.forEach(({ key, items }) => {
      const internalTotal = items.reduce((sum, item) => sum + (item.internalTotal || 0), 0);
      const b2bTotal = items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0);

      categoryTotals[key.replace('Items', 'Total')] = internalTotal;
      categoryTotals[key.replace('Items', 'B2BTotal')] = b2bTotal;

      totalInternalJpy += internalTotal;
      totalB2BJpy += b2bTotal;
    });

    const exchangeRate = parseFloat(formData.exchangeRate) || 0.031;
    const totalInternalMyr = totalInternalJpy * exchangeRate;
    const totalB2BMyr = totalB2BJpy * exchangeRate;
    const profit = totalB2BMyr - totalInternalMyr;
    const profitMargin = totalB2BMyr > 0 ? (profit / totalB2BMyr) * 100 : 0;

    return {
      ...categoryTotals,
      totalInternalJpy,
      totalB2BJpy,
      totalInternalMyr,
      totalB2BMyr,
      profit,
      profitMargin,
    };
  };

  const totals = calculateTotals();

  const handleSubmit = (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    setValidationError(null);

    // Validation for non-draft bookings
    if (!isDraft) {
      if (!formData.guestName.trim()) {
        setValidationError('Guest name is required');
        return;
      }
      if (!formData.tripStartDate) {
        setValidationError('Trip start date is required');
        return;
      }
    }

    const booking: Omit<Booking, 'id' | 'bookingCode' | 'createdAt' | 'updatedAt'> = {
      companyId,
      guestName: formData.guestName,
      tripStartDate: formData.tripStartDate,
      tripEndDate: formData.tripEndDate || undefined,
      numberOfPax: formData.numberOfPax || undefined,
      country: formData.country,
      carTypes: formData.carTypes,
      ...lineItems,

      // Internal cost totals (JPY)
      transportationTotal: totals.transportationTotal || 0,
      mealsTotal: totals.mealsTotal || 0,
      entranceTotal: totals.entranceTotal || 0,
      tourGuideTotal: totals.tourGuideTotal || 0,
      flightTotal: totals.flightTotal || 0,
      accommodationTotal: totals.accommodationTotal || 0,

      // B2B price totals (JPY)
      transportationB2BTotal: totals.transportationB2BTotal || 0,
      mealsB2BTotal: totals.mealsB2BTotal || 0,
      entranceB2BTotal: totals.entranceB2BTotal || 0,
      tourGuideB2BTotal: totals.tourGuideB2BTotal || 0,
      flightB2BTotal: totals.flightB2BTotal || 0,
      accommodationB2BTotal: totals.accommodationB2BTotal || 0,

      // Grand totals
      grandTotalJpy: totals.totalInternalJpy,
      grandTotalB2BJpy: totals.totalB2BJpy,
      grandTotalMyr: totals.totalInternalMyr,
      grandTotalB2BMyr: totals.totalB2BMyr,
      exchangeRate: parseFloat(formData.exchangeRate) || 0.031,

      // Pricing & profit (automatically calculated from line items)
      wifCost: totals.totalInternalMyr,
      b2bPrice: totals.totalB2BMyr,
      expectedProfit: totals.profit,

      // Status
      status: isDraft ? 'draft' : formData.status,
      isActive: formData.isActive,
      notes: formData.notes || undefined,
    };

    onSubmit(booking, isDraft);
  };

  const formatAmount = (amount: number, currency: string = 'MYR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleFormPrint = async (options: BookingFormPrintOptions) => {
    if (!initialData) return;

    try {
      const companyInfo = await getCompanyInfoAsync();

      await PdfService.downloadBookingForm(
        initialData,
        options,
        companyInfo
      );

      // Log booking form print activity
      if (user) {
        logBookingEvent(
          'booking:form_printed',
          { id: user.id, username: user.username, fullName: user.fullName },
          {
            id: initialData.id,
            bookingCode: initialData.bookingCode,
            guestName: initialData.guestName,
            status: initialData.status
          },
          {
            pricingDisplay: options.pricingDisplay,
            includeNotes: options.includeNotes,
            includeEmptyCategories: options.includeEmptyCategories,
            showProfitMargin: options.showProfitMargin,
            showExchangeRate: options.showExchangeRate,
            country: initialData.country,
            tripStartDate: initialData.tripStartDate,
            tripEndDate: initialData.tripEndDate,
          }
        );
      }

      toast.success('Booking form generated', {
        description: `Form downloaded for ${initialData.bookingCode}`
      });
    } catch (error) {
      console.error('Failed to print booking form:', error);
      toast.error('Failed to generate booking form', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Plane className="w-5 h-5" />
            {initialData ? 'Edit Booking' : 'New Booking'}
          </CardTitle>
          {initialData && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormPrintDialogOpen(true)}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Form
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Guest Name *</Label>
                <Input
                  id="guestName"
                  placeholder="e.g., Hilmi Salleh"
                  value={formData.guestName}
                  onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as BookingStatus })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <DatePicker
                label="Start Date"
                value={formData.tripStartDate}
                onChange={(value) => setFormData({ ...formData, tripStartDate: value || getTodayISO() })}
                required
              />

              <DatePicker
                label="End Date"
                value={formData.tripEndDate}
                onChange={(value) => setFormData({ ...formData, tripEndDate: value || '' })}
                minValue={formData.tripStartDate}
              />

              <div className="space-y-2">
                <Label htmlFor="numberOfPax">Number of Pax</Label>
                <Input
                  id="numberOfPax"
                  placeholder="e.g., 8A + 2CWB + 1TG"
                  value={formData.numberOfPax}
                  onChange={(e) => setFormData({ ...formData, numberOfPax: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger id="country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Japan">Japan</SelectItem>
                    <SelectItem value="Malaysia">Malaysia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exchangeRate">Exchange Rate (JPY to MYR)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.000001"
                  placeholder="0.031"
                  value={formData.exchangeRate}
                  onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Cost Breakdown */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Cost Breakdown (JPY)</h3>
            <p className="text-sm text-gray-600">Enter internal costs and B2B prices for each item. Profit will be calculated automatically.</p>

            <BookingFormLineItemEditor
              label="Transportation"
              items={lineItems.transportationItems}
              onChange={(items) => setLineItems({ ...lineItems, transportationItems: items })}
            />

            <BookingFormLineItemEditor
              label="Meals"
              items={lineItems.mealsItems}
              onChange={(items) => setLineItems({ ...lineItems, mealsItems: items })}
            />

            <BookingFormLineItemEditor
              label="Entrance Fees"
              items={lineItems.entranceItems}
              onChange={(items) => setLineItems({ ...lineItems, entranceItems: items })}
            />

            <BookingFormLineItemEditor
              label="Tour Guide"
              items={lineItems.tourGuideItems}
              onChange={(items) => setLineItems({ ...lineItems, tourGuideItems: items })}
            />

            <BookingFormLineItemEditor
              label="Flights"
              items={lineItems.flightItems}
              onChange={(items) => setLineItems({ ...lineItems, flightItems: items })}
            />

            <BookingFormLineItemEditor
              label="Accommodation"
              items={lineItems.accommodationItems}
              onChange={(items) => setLineItems({ ...lineItems, accommodationItems: items })}
            />
          </div>

          <Separator />

          {/* Automatic P&L Summary */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Preliminary P&L (Auto-calculated)</h3>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 space-y-4 border border-blue-200">
              {/* JPY Totals */}
              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-blue-200">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">Total Internal (JPY)</p>
                  <p className="text-lg font-bold text-gray-900">
                    ¥{totals.totalInternalJpy.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">Total B2B (JPY)</p>
                  <p className="text-lg font-bold text-gray-900">
                    ¥{totals.totalB2BJpy.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">Profit (JPY)</p>
                  <p className={`text-lg font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ¥{(totals.totalB2BJpy - totals.totalInternalJpy).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* MYR Totals */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">WIF Cost (MYR)</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatAmount(totals.totalInternalMyr)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">B2B Price (MYR)</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatAmount(totals.totalB2BMyr)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">Expected Profit (MYR)</p>
                  <p className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatAmount(totals.profit)}
                  </p>
                  <p className="text-xs text-gray-600">
                    Margin: <span className="font-semibold">{totals.profitMargin.toFixed(2)}%</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Additional Information</h3>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes or comments..."
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={(e: any) => handleSubmit(e, true)}
              >
                <FileEdit className="w-4 h-4 mr-2" />
                Save as Draft
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {initialData ? 'Update' : 'Create'} Booking
              </Button>
            </div>
          </div>
        </form>
      </CardContent>

      {/* Form Print Dialog */}
      {initialData && (
        <BookingFormPrintDialog
          booking={initialData}
          open={formPrintDialogOpen}
          onOpenChange={setFormPrintDialogOpen}
          onPrint={handleFormPrint}
        />
      )}
    </Card>
  );
}
