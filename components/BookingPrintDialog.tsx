import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Booking } from '../types/booking';
import { Printer, FileText, AlertTriangle, Loader2, Car, UtensilsCrossed, Ticket, Users, Plane, Building } from 'lucide-react';

interface BookingPrintDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: (options: PrintOptions) => Promise<void>;
}

export interface PrintOptions {
  categories: string[];
  includePrices: boolean;
  outputFormat: 'combined' | 'separate';
}

interface CategoryInfo {
  key: string;
  label: string;
  icon: React.ReactNode;
  itemsKey: keyof Booking;
  count: number;
}

const CATEGORIES: Omit<CategoryInfo, 'count'>[] = [
  { key: 'transportation', label: 'Transportation', icon: <Car className="w-4 h-4" />, itemsKey: 'transportationItems' },
  { key: 'meals', label: 'Meals / Restaurant', icon: <UtensilsCrossed className="w-4 h-4" />, itemsKey: 'mealsItems' },
  { key: 'entrance', label: 'Entrance Fees', icon: <Ticket className="w-4 h-4" />, itemsKey: 'entranceItems' },
  { key: 'tourGuide', label: 'Tour Guide', icon: <Users className="w-4 h-4" />, itemsKey: 'tourGuideItems' },
  { key: 'flights', label: 'Flights', icon: <Plane className="w-4 h-4" />, itemsKey: 'flightItems' },
  { key: 'accommodation', label: 'Accommodation', icon: <Building className="w-4 h-4" />, itemsKey: 'accommodationItems' },
];

export function BookingPrintDialog({ booking, open, onOpenChange, onPrint }: BookingPrintDialogProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState<'combined' | 'separate'>('separate');
  const [includePrices, setIncludePrices] = useState(false);
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Get categories with item counts
  const categoriesWithCounts: CategoryInfo[] = CATEGORIES.map(cat => ({
    ...cat,
    count: Array.isArray(booking[cat.itemsKey]) ? (booking[cat.itemsKey] as any[]).length : 0
  }));

  const hasAnyItems = categoriesWithCounts.some(cat => cat.count > 0);
  const selectedCount = selectedCategories.length;
  const canPrint = selectedCount > 0 && !isPrinting;

  const handleCategoryToggle = (categoryKey: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryKey)
        ? prev.filter(k => k !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const handleSelectAll = () => {
    const allWithItems = categoriesWithCounts.filter(cat => cat.count > 0).map(cat => cat.key);
    setSelectedCategories(allWithItems);
  };

  const handleDeselectAll = () => {
    setSelectedCategories([]);
  };

  const handleIncludePricesChange = (checked: boolean) => {
    if (checked) {
      // Show confirmation dialog
      setShowPriceConfirmation(true);
    } else {
      setIncludePrices(false);
    }
  };

  const handlePriceConfirmation = () => {
    if (confirmText.toUpperCase() === 'CONFIRM') {
      setIncludePrices(true);
      setShowPriceConfirmation(false);
      setConfirmText('');
    }
  };

  const handlePriceConfirmationCancel = () => {
    setShowPriceConfirmation(false);
    setConfirmText('');
  };

  const handlePrint = async () => {
    if (!canPrint) return;

    setIsPrinting(true);
    try {
      await onPrint({
        categories: selectedCategories,
        includePrices,
        outputFormat
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Print failed:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSelectedCategories([]);
      setOutputFormat('separate');
      setIncludePrices(false);
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print Booking Cards
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium">{booking.bookingCode}</span> - {booking.guestName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Category Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select Categories to Print</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSelectAll}
                    disabled={!hasAnyItems}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleDeselectAll}
                    disabled={selectedCount === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                {categoriesWithCounts.map(category => (
                  <div
                    key={category.key}
                    className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
                      category.count === 0 ? 'opacity-50' : 'hover:bg-gray-100'
                    }`}
                  >
                    <Checkbox
                      id={category.key}
                      checked={selectedCategories.includes(category.key)}
                      onCheckedChange={() => handleCategoryToggle(category.key)}
                      disabled={category.count === 0}
                    />
                    <label
                      htmlFor={category.key}
                      className={`flex items-center gap-2 flex-1 text-sm ${
                        category.count === 0 ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {category.icon}
                      <span>{category.label}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                        category.count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {category.count} {category.count === 1 ? 'item' : 'items'}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Format */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Output Format</Label>
              <RadioGroup
                value={outputFormat}
                onValueChange={(value) => setOutputFormat(value as 'combined' | 'separate')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-2 border rounded-md hover:bg-gray-50">
                  <RadioGroupItem value="separate" id="separate" />
                  <label htmlFor="separate" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">Separate Documents</div>
                    <div className="text-xs text-gray-500">One PDF per category (recommended for vendors)</div>
                  </label>
                </div>
                <div className="flex items-center space-x-3 p-2 border rounded-md hover:bg-gray-50">
                  <RadioGroupItem value="combined" id="combined" />
                  <label htmlFor="combined" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">Combined Document</div>
                    <div className="text-xs text-gray-500">All categories in one PDF</div>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* Price Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Pricing Options
              </Label>
              <div className={`flex items-start space-x-3 p-3 border rounded-md ${
                includePrices ? 'border-red-300 bg-red-50' : 'hover:bg-gray-50'
              }`}>
                <Checkbox
                  id="includePrices"
                  checked={includePrices}
                  onCheckedChange={handleIncludePricesChange}
                />
                <label htmlFor="includePrices" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">Include Internal & B2B Prices</div>
                  <div className="text-xs text-gray-500">
                    For internal reference only - requires confirmation
                  </div>
                  {includePrices && (
                    <div className="mt-2 text-xs text-red-600 font-medium">
                      Pricing information will be included with "INTERNAL USE ONLY" watermark
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPrinting}>
              Cancel
            </Button>
            <Button onClick={handlePrint} disabled={!canPrint}>
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Print {selectedCount > 0 ? `(${selectedCount})` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Confirmation Dialog */}
      <AlertDialog open={showPriceConfirmation} onOpenChange={setShowPriceConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confidential Information Warning
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>You are about to include <strong>SENSITIVE PRICING INFORMATION</strong>:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Internal Cost (WIF's vendor cost)</li>
                  <li>B2B Price (charged to partners)</li>
                </ul>
                <p className="font-medium text-red-600">This information should NEVER be shared with:</p>
                <ul className="list-disc list-inside text-sm space-y-1 text-red-600">
                  <li>External vendors</li>
                  <li>End customers</li>
                  <li>Unauthorized personnel</li>
                </ul>
                <p>Only proceed if this document is for internal accounting or management review.</p>
                <div className="pt-2">
                  <Label htmlFor="confirmText" className="text-sm font-medium">
                    Type "CONFIRM" to proceed:
                  </Label>
                  <Input
                    id="confirmText"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type CONFIRM"
                    className="mt-2"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePriceConfirmationCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePriceConfirmation}
              disabled={confirmText.toUpperCase() !== 'CONFIRM'}
              className="bg-red-600 hover:bg-red-700"
            >
              Include Prices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
