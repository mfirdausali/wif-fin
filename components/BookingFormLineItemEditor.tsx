import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { BookingLineItem } from '../types/booking';
import { DatePicker, getTodayISO } from './ui/date-picker';

interface BookingFormLineItemEditorProps {
  label: string;
  items: BookingLineItem[];
  onChange: (items: BookingLineItem[]) => void;
  showDate?: boolean;
  currency?: string;
}

export function BookingFormLineItemEditor({
  label,
  items,
  onChange,
  showDate = false,
  currency = 'JPY'
}: BookingFormLineItemEditorProps) {
  const title = label;
  const [editingItems, setEditingItems] = useState<BookingLineItem[]>(items);

  const addItem = () => {
    const newItem: BookingLineItem = {
      date: showDate ? getTodayISO() : undefined,
      description: '',
      quantity: 1,
      internalPrice: 0,
      b2bPrice: 0,
      internalTotal: 0,
      b2bTotal: 0,
      profit: 0,
      notes: ''
    };
    const updated = [...editingItems, newItem];
    setEditingItems(updated);
    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = editingItems.filter((_, i) => i !== index);
    setEditingItems(updated);
    onChange(updated);
  };

  const updateItem = (index: number, field: keyof BookingLineItem, value: any) => {
    const updated = editingItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };

        // Auto-calculate totals and profit when quantity or prices change
        if (field === 'quantity' || field === 'internalPrice' || field === 'b2bPrice') {
          const qty = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
          const intPrice = field === 'internalPrice' ? parseFloat(value) || 0 : item.internalPrice;
          const b2bPriceVal = field === 'b2bPrice' ? parseFloat(value) || 0 : item.b2bPrice;

          updatedItem.internalTotal = qty * intPrice;
          updatedItem.b2bTotal = qty * b2bPriceVal;
          updatedItem.profit = updatedItem.b2bTotal - updatedItem.internalTotal;
        }

        return updatedItem;
      }
      return item;
    });

    setEditingItems(updated);
    onChange(updated);
  };

  const calculateTotals = () => {
    const internalTotal = editingItems.reduce((sum, item) => sum + item.internalTotal, 0);
    const b2bTotal = editingItems.reduce((sum, item) => sum + item.b2bTotal, 0);
    const profit = b2bTotal - internalTotal;
    return { internalTotal, b2bTotal, profit };
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totals = calculateTotals();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Internal:</span>
                <span className="font-semibold">{formatAmount(totals.internalTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">B2B:</span>
                <span className="font-semibold">{formatAmount(totals.b2bTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Profit:</span>
                <span className={`font-semibold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.profit >= 0 ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                  {formatAmount(totals.profit)}
                </span>
              </div>
            </div>
            <Button type="button" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editingItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No items yet. Click "Add Item" to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {editingItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-12 gap-3">
                  {showDate && (
                    <div className="col-span-12 sm:col-span-2">
                      <DatePicker
                        label="Date"
                        value={item.date || ''}
                        onChange={(value) => updateItem(index, 'date', value)}
                      />
                    </div>
                  )}

                  <div className={showDate ? 'col-span-12 sm:col-span-4' : 'col-span-12 sm:col-span-5'}>
                    <Label htmlFor={`${title}-desc-${index}`} className="text-xs">Description *</Label>
                    <Input
                      id={`${title}-desc-${index}`}
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-1">
                    <Label htmlFor={`${title}-qty-${index}`} className="text-xs">Qty</Label>
                    <Input
                      id={`${title}-qty-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <Label htmlFor={`${title}-int-price-${index}`} className="text-xs">Internal Price</Label>
                    <Input
                      id={`${title}-int-price-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.internalPrice}
                      onChange={(e) => updateItem(index, 'internalPrice', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <Label htmlFor={`${title}-b2b-price-${index}`} className="text-xs">B2B Price</Label>
                    <Input
                      id={`${title}-b2b-price-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.b2bPrice}
                      onChange={(e) => updateItem(index, 'b2bPrice', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-1">
                    <Label className="text-xs">Profit</Label>
                    <div className={`h-9 flex items-center justify-center px-2 rounded border text-xs font-semibold ${
                      item.profit >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {formatAmount(item.profit)}
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-1 flex items-end justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="h-9 w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Notes field */}
                <div className="mt-3">
                  <Label htmlFor={`${title}-notes-${index}`} className="text-xs">Notes (optional)</Label>
                  <Textarea
                    id={`${title}-notes-${index}`}
                    placeholder="Additional notes..."
                    value={item.notes || ''}
                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
