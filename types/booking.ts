/**
 * Booking Types
 *
 * Represents tour/trip bookings with detailed cost breakdown
 */

export type BookingStatus = 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface BookingLineItem {
  date?: string;
  description: string;
  quantity: number;
  internalPrice: number; // WIF's cost per unit (JPY)
  b2bPrice: number; // Price charged to B2B partner per unit (JPY)
  internalTotal: number; // quantity * internalPrice
  b2bTotal: number; // quantity * b2bPrice
  profit: number; // b2bTotal - internalTotal
  notes?: string;
}

export interface Booking {
  id: string;
  companyId: string;
  bookingCode: string;
  documentId?: string; // Optional - links to invoice if generated

  // Trip Details
  guestName: string;
  tripStartDate: string;
  tripEndDate?: string;
  numberOfPax?: string; // e.g., "8A + 2CWB + 1TG"
  country: string; // 'Malaysia' | 'Japan'
  carTypes?: string[]; // e.g., ['Alphard', 'Hiace']

  // Cost Breakdown - Line Items
  transportationItems: BookingLineItem[];
  mealsItems: BookingLineItem[];
  entranceItems: BookingLineItem[];
  tourGuideItems: BookingLineItem[];
  flightItems: BookingLineItem[];
  accommodationItems: BookingLineItem[];

  // Cost Breakdown - Totals (in JPY)
  transportationTotal: number; // Sum of internal costs
  mealsTotal: number;
  entranceTotal: number;
  tourGuideTotal: number;
  flightTotal: number;
  accommodationTotal: number;

  // B2B Price Breakdown - Totals (in JPY)
  transportationB2BTotal: number; // Sum of B2B prices
  mealsB2BTotal: number;
  entranceB2BTotal: number;
  tourGuideB2BTotal: number;
  flightB2BTotal: number;
  accommodationB2BTotal: number;

  // Grand Totals
  grandTotalJpy: number; // Total internal cost (JPY)
  grandTotalB2BJpy: number; // Total B2B price (JPY)
  grandTotalMyr: number; // Total internal cost (MYR)
  grandTotalB2BMyr: number; // Total B2B price (MYR)
  exchangeRate: number; // JPY to MYR

  // Pricing & Profit
  wifCost: number; // Total internal cost (in MYR) - same as grandTotalMyr
  b2bPrice: number; // Total B2B price (in MYR) - same as grandTotalB2BMyr
  expectedProfit: number; // b2bPrice - wifCost

  // Metadata
  status: BookingStatus;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingWithProfit extends Booking {
  profitMargin: number; // percentage
}

export interface BookingSummary {
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  averageMargin: number;
}

export interface BookingFilters {
  status?: BookingStatus;
  isActive?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
  country?: string;
  guestName?: string;
}
