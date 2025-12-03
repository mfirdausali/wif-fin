import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Alert, AlertDescription } from './ui/alert';
import { Booking } from '../types/booking';
import { FileText, AlertTriangle, Loader2 } from 'lucide-react';

interface BookingFormPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onPrint: (options: BookingFormPrintOptions) => Promise<void>;
}

export interface BookingFormPrintOptions {
  pricingDisplay: 'none' | 'internal' | 'b2b' | 'both';
  includeNotes: boolean;
  includeEmptyCategories: boolean;
  showProfitMargin: boolean;
  showExchangeRate: boolean;
}

export function BookingFormPrintDialog({
  open,
  onOpenChange,
  booking,
  onPrint
}: BookingFormPrintDialogProps) {
  const [pricingDisplay, setPricingDisplay] = useState<'none' | 'internal' | 'b2b' | 'both'>('none');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeEmptyCategories, setIncludeEmptyCategories] = useState(false);
  const [showProfitMargin, setShowProfitMargin] = useState(false);
  const [showExchangeRate, setShowExchangeRate] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const requiresConfirmation = pricingDisplay !== 'none';
  const isConfirmed = confirmText.toUpperCase() === 'CONFIRM';
  const canPrint = !isPrinting && (!requiresConfirmation || isConfirmed);

  const handlePricingChange = (value: string) => {
    setPricingDisplay(value as 'none' | 'internal' | 'b2b' | 'both');
    // Reset confirmation when changing pricing option
    setConfirmText('');
    // Disable profit margin if not in 'both' mode
    if (value !== 'both') {
      setShowProfitMargin(false);
    }
  };

  const handlePrint = async () => {
    if (!canPrint || !booking) return;

    setIsPrinting(true);
    try {
      await onPrint({
        pricingDisplay,
        includeNotes,
        includeEmptyCategories,
        showProfitMargin,
        showExchangeRate,
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
      setPricingDisplay('none');
      setIncludeNotes(true);
      setIncludeEmptyCategories(false);
      setShowProfitMargin(false);
      setShowExchangeRate(true);
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Print Booking Form
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{booking.bookingCode}</span> - {booking.guestName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pricing Display Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Pricing Display</Label>
            <RadioGroup
              value={pricingDisplay}
              onValueChange={handlePricingChange}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-2 border rounded-md hover:bg-gray-50">
                <RadioGroupItem value="none" id="none" />
                <label htmlFor="none" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">No Pricing (Vendor-facing)</div>
                  <div className="text-xs text-gray-500">Hide all pricing information</div>
                </label>
              </div>
              <div className="flex items-center space-x-3 p-2 border rounded-md hover:bg-gray-50">
                <RadioGroupItem value="internal" id="internal" />
                <label htmlFor="internal" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">Internal Cost Only</div>
                  <div className="text-xs text-gray-500">Show WIF vendor costs only</div>
                </label>
              </div>
              <div className="flex items-center space-x-3 p-2 border rounded-md hover:bg-gray-50">
                <RadioGroupItem value="b2b" id="b2b" />
                <label htmlFor="b2b" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">B2B Price Only</div>
                  <div className="text-xs text-gray-500">Show partner pricing only</div>
                </label>
              </div>
              <div className="flex items-center space-x-3 p-2 border rounded-md hover:bg-gray-50">
                <RadioGroupItem value="both" id="both" />
                <label htmlFor="both" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">Both (Internal + B2B)</div>
                  <div className="text-xs text-gray-500">Show all pricing and margins</div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Options Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Options</Label>
            <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
              <div className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-100">
                <Checkbox
                  id="includeNotes"
                  checked={includeNotes}
                  onCheckedChange={(checked) => setIncludeNotes(!!checked)}
                />
                <label htmlFor="includeNotes" className="flex-1 cursor-pointer text-sm">
                  Include notes
                </label>
              </div>
              <div className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-100">
                <Checkbox
                  id="includeEmptyCategories"
                  checked={includeEmptyCategories}
                  onCheckedChange={(checked) => setIncludeEmptyCategories(!!checked)}
                />
                <label htmlFor="includeEmptyCategories" className="flex-1 cursor-pointer text-sm">
                  Show empty categories
                </label>
              </div>
              <div className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-100">
                <Checkbox
                  id="showExchangeRate"
                  checked={showExchangeRate}
                  onCheckedChange={(checked) => setShowExchangeRate(!!checked)}
                />
                <label htmlFor="showExchangeRate" className="flex-1 cursor-pointer text-sm">
                  Show exchange rate
                </label>
              </div>
              <div className={`flex items-start space-x-3 p-2 rounded-md ${
                pricingDisplay === 'both' ? 'hover:bg-gray-100' : 'opacity-50'
              }`}>
                <Checkbox
                  id="showProfitMargin"
                  checked={showProfitMargin}
                  onCheckedChange={(checked) => setShowProfitMargin(!!checked)}
                  disabled={pricingDisplay !== 'both'}
                />
                <label
                  htmlFor="showProfitMargin"
                  className={`flex-1 text-sm ${
                    pricingDisplay === 'both' ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  Show profit margin
                  <span className="text-xs text-gray-500 block">
                    Requires &quot;Both&quot; pricing display
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Confirmation Section - Only shown if pricing is selected */}
          {requiresConfirmation && (
            <div className="space-y-3">
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  <p className="font-medium mb-2">You are about to include sensitive pricing information:</p>
                  <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                    {(pricingDisplay === 'internal' || pricingDisplay === 'both') && (
                      <li>Internal Cost (WIF&apos;s vendor cost)</li>
                    )}
                    {(pricingDisplay === 'b2b' || pricingDisplay === 'both') && (
                      <li>B2B Price (charged to partners)</li>
                    )}
                  </ul>
                  <p className="font-medium text-red-600 mt-3">
                    This information should NEVER be shared with external vendors or customers.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirmText" className="text-sm font-medium text-red-700">
                  Type &quot;CONFIRM&quot; to proceed:
                </Label>
                <Input
                  id="confirmText"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type CONFIRM"
                  className={`border-2 ${
                    isConfirmed
                      ? 'border-green-500 bg-green-50'
                      : confirmText
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPrinting}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!canPrint}
            className={requiresConfirmation ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Print Form
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
