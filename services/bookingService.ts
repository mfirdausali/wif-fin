/**
 * Booking Service
 *
 * Handles booking management and cost tracking
 */

import { supabase } from './supabaseService';
import { Booking, BookingLineItem, BookingStatus, BookingFilters, BookingWithProfit } from '../types/booking';
// TODO: Update after running migration 002_bookings_only.sql
// type BookingRow = Database['public']['Tables']['bookings']['Row'];
// type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
// type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

type BookingRow = any;
type BookingInsert = any;
type BookingUpdate = any;

/**
 * Convert database row to application type
 */
function mapRowToBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    companyId: row.company_id,
    bookingCode: row.booking_code || '',
    documentId: row.document_id || undefined,
    guestName: row.guest_name,
    tripStartDate: row.trip_start_date || '',
    tripEndDate: row.trip_end_date || undefined,
    numberOfPax: row.number_of_pax || undefined,
    country: row.country || 'Japan',
    carTypes: row.car_types || [],
    transportationItems: (row.transportation_items as unknown as BookingLineItem[]) || [],
    mealsItems: (row.meals_items as unknown as BookingLineItem[]) || [],
    entranceItems: (row.entrance_items as unknown as BookingLineItem[]) || [],
    tourGuideItems: (row.tour_guide_items as unknown as BookingLineItem[]) || [],
    flightItems: (row.flight_items as unknown as BookingLineItem[]) || [],
    accommodationItems: (row.accommodation_items as unknown as BookingLineItem[]) || [],
    transportationTotal: Number(row.transportation_total),
    mealsTotal: Number(row.meals_total),
    entranceTotal: Number(row.entrance_total),
    tourGuideTotal: Number(row.tour_guide_total),
    flightTotal: Number(row.flight_total),
    accommodationTotal: Number(row.accommodation_total),
    transportationB2BTotal: Number(row.transportation_b2b_total || 0),
    mealsB2BTotal: Number(row.meals_b2b_total || 0),
    entranceB2BTotal: Number(row.entrance_b2b_total || 0),
    tourGuideB2BTotal: Number(row.tour_guide_b2b_total || 0),
    flightB2BTotal: Number(row.flight_b2b_total || 0),
    accommodationB2BTotal: Number(row.accommodation_b2b_total || 0),
    grandTotalJpy: Number(row.grand_total_jpy),
    grandTotalB2BJpy: Number(row.grand_total_b2b_jpy || 0),
    grandTotalMyr: Number(row.grand_total_myr),
    grandTotalB2BMyr: Number(row.grand_total_b2b_myr || 0),
    exchangeRate: Number(row.exchange_rate),
    wifCost: Number(row.wif_cost),
    b2bPrice: Number(row.b2b_price),
    expectedProfit: Number(row.expected_profit),
    status: (row.status as BookingStatus) || 'planning',
    isActive: row.is_active ?? true,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Calculate internal total from line items
 */
function calculateCategoryInternalTotal(items: BookingLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.internalTotal || 0), 0);
}

/**
 * Calculate B2B total from line items
 */
function calculateCategoryB2BTotal(items: BookingLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0);
}

/**
 * Calculate all category totals
 */
function calculateTotals(items: {
  transportationItems: BookingLineItem[];
  mealsItems: BookingLineItem[];
  entranceItems: BookingLineItem[];
  tourGuideItems: BookingLineItem[];
  flightItems: BookingLineItem[];
  accommodationItems: BookingLineItem[];
}) {
  // Internal cost totals
  const transportationTotal = calculateCategoryInternalTotal(items.transportationItems);
  const mealsTotal = calculateCategoryInternalTotal(items.mealsItems);
  const entranceTotal = calculateCategoryInternalTotal(items.entranceItems);
  const tourGuideTotal = calculateCategoryInternalTotal(items.tourGuideItems);
  const flightTotal = calculateCategoryInternalTotal(items.flightItems);
  const accommodationTotal = calculateCategoryInternalTotal(items.accommodationItems);

  // B2B price totals
  const transportationB2BTotal = calculateCategoryB2BTotal(items.transportationItems);
  const mealsB2BTotal = calculateCategoryB2BTotal(items.mealsItems);
  const entranceB2BTotal = calculateCategoryB2BTotal(items.entranceItems);
  const tourGuideB2BTotal = calculateCategoryB2BTotal(items.tourGuideItems);
  const flightB2BTotal = calculateCategoryB2BTotal(items.flightItems);
  const accommodationB2BTotal = calculateCategoryB2BTotal(items.accommodationItems);

  const grandTotalJpy = transportationTotal + mealsTotal + entranceTotal +
    tourGuideTotal + flightTotal + accommodationTotal;

  const grandTotalB2BJpy = transportationB2BTotal + mealsB2BTotal + entranceB2BTotal +
    tourGuideB2BTotal + flightB2BTotal + accommodationB2BTotal;

  return {
    transportationTotal,
    mealsTotal,
    entranceTotal,
    tourGuideTotal,
    flightTotal,
    accommodationTotal,
    transportationB2BTotal,
    mealsB2BTotal,
    entranceB2BTotal,
    tourGuideB2BTotal,
    flightB2BTotal,
    accommodationB2BTotal,
    grandTotalJpy,
    grandTotalB2BJpy
  };
}

/**
 * Create a new booking
 */
export async function createBooking(
  data: Omit<Booking, 'id' | 'bookingCode' | 'createdAt' | 'updatedAt'>
): Promise<Booking> {
  // Auto-calculate totals from line items
  const totals = calculateTotals(data);
  const grandTotalMyr = totals.grandTotalJpy * data.exchangeRate;
  const expectedProfit = data.b2bPrice - data.wifCost;

  const insertData: BookingInsert = {
    company_id: data.companyId,
    document_id: data.documentId || null,
    guest_name: data.guestName,
    trip_start_date: data.tripStartDate || null,
    trip_end_date: data.tripEndDate || null,
    number_of_pax: data.numberOfPax || null,
    country: data.country,
    car_types: data.carTypes || [],
    transportation_items: data.transportationItems as any,
    meals_items: data.mealsItems as any,
    entrance_items: data.entranceItems as any,
    tour_guide_items: data.tourGuideItems as any,
    flight_items: data.flightItems as any,
    accommodation_items: data.accommodationItems as any,
    transportation_total: totals.transportationTotal,
    meals_total: totals.mealsTotal,
    entrance_total: totals.entranceTotal,
    tour_guide_total: totals.tourGuideTotal,
    flight_total: totals.flightTotal,
    accommodation_total: totals.accommodationTotal,
    grand_total_jpy: totals.grandTotalJpy,
    grand_total_myr: grandTotalMyr,
    exchange_rate: data.exchangeRate,
    wif_cost: data.wifCost,
    b2b_price: data.b2bPrice,
    expected_profit: expectedProfit,
    status: data.status,
    is_active: data.isActive,
    notes: data.notes || null
  };

  const { data: created, error } = await supabase
    .from('bookings')
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create booking: ${error.message}`);
  }

  return mapRowToBooking(created);
}

/**
 * Get booking by ID
 */
export async function getBooking(id: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get booking: ${error.message}`);
  }

  return mapRowToBooking(data);
}

/**
 * Get booking by code
 */
export async function getBookingByCode(
  companyId: string,
  code: string
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select()
    .eq('company_id', companyId)
    .eq('booking_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get booking: ${error.message}`);
  }

  return mapRowToBooking(data);
}

/**
 * Get all bookings with optional filters
 */
export async function getAllBookings(
  companyId: string,
  filters?: BookingFilters
): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select()
    .eq('company_id', companyId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }

  if (filters?.startDateFrom) {
    query = query.gte('trip_start_date', filters.startDateFrom);
  }

  if (filters?.startDateTo) {
    query = query.lte('trip_start_date', filters.startDateTo);
  }

  if (filters?.country) {
    query = query.eq('country', filters.country);
  }

  if (filters?.guestName) {
    query = query.ilike('guest_name', `%${filters.guestName}%`);
  }

  query = query.order('trip_start_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get bookings: ${error.message}`);
  }

  return data.map(mapRowToBooking);
}

/**
 * Update booking
 */
export async function updateBooking(
  id: string,
  updates: Partial<Omit<Booking, 'id' | 'bookingCode' | 'companyId' | 'createdAt' | 'updatedAt'>>
): Promise<Booking> {
  // Get current booking to merge line items
  const current = await getBooking(id);
  if (!current) {
    throw new Error('Booking not found');
  }

  const updateData: BookingUpdate = {};

  if (updates.documentId !== undefined) updateData.document_id = updates.documentId || null;
  if (updates.guestName !== undefined) updateData.guest_name = updates.guestName;
  if (updates.tripStartDate !== undefined) updateData.trip_start_date = updates.tripStartDate || null;
  if (updates.tripEndDate !== undefined) updateData.trip_end_date = updates.tripEndDate || null;
  if (updates.numberOfPax !== undefined) updateData.number_of_pax = updates.numberOfPax || null;
  if (updates.country !== undefined) updateData.country = updates.country;
  if (updates.carTypes !== undefined) updateData.car_types = updates.carTypes;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.notes !== undefined) updateData.notes = updates.notes || null;

  // Update line items and recalculate totals
  const transportationItems = updates.transportationItems || current.transportationItems;
  const mealsItems = updates.mealsItems || current.mealsItems;
  const entranceItems = updates.entranceItems || current.entranceItems;
  const tourGuideItems = updates.tourGuideItems || current.tourGuideItems;
  const flightItems = updates.flightItems || current.flightItems;
  const accommodationItems = updates.accommodationItems || current.accommodationItems;

  updateData.transportation_items = transportationItems as any;
  updateData.meals_items = mealsItems as any;
  updateData.entrance_items = entranceItems as any;
  updateData.tour_guide_items = tourGuideItems as any;
  updateData.flight_items = flightItems as any;
  updateData.accommodation_items = accommodationItems as any;

  // Recalculate totals
  const totals = calculateTotals({
    transportationItems,
    mealsItems,
    entranceItems,
    tourGuideItems,
    flightItems,
    accommodationItems
  });

  updateData.transportation_total = totals.transportationTotal;
  updateData.meals_total = totals.mealsTotal;
  updateData.entrance_total = totals.entranceTotal;
  updateData.tour_guide_total = totals.tourGuideTotal;
  updateData.flight_total = totals.flightTotal;
  updateData.accommodation_total = totals.accommodationTotal;
  updateData.grand_total_jpy = totals.grandTotalJpy;

  const exchangeRate = updates.exchangeRate || current.exchangeRate;
  updateData.exchange_rate = exchangeRate;
  updateData.grand_total_myr = totals.grandTotalJpy * exchangeRate;

  const wifCost = updates.wifCost !== undefined ? updates.wifCost : current.wifCost;
  const b2bPrice = updates.b2bPrice !== undefined ? updates.b2bPrice : current.b2bPrice;
  updateData.wif_cost = wifCost;
  updateData.b2b_price = b2bPrice;
  updateData.expected_profit = b2bPrice - wifCost;

  const { data, error } = await supabase
    .from('bookings')
    // @ts-ignore - Supabase type generation issue
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update booking: ${error.message}`);
  }

  return mapRowToBooking(data);
}

/**
 * Delete booking (soft delete)
 */
export async function deleteBooking(id: string): Promise<void> {
  console.log('Deleting booking:', id);

  const { data, error } = await supabase
    .from('bookings')
    // @ts-ignore - Supabase type generation issue
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  console.log('Delete result:', { data, error });

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete booking: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn('No booking was updated - booking may not exist');
    throw new Error('Booking not found or already deleted');
  }

  console.log('Booking successfully marked as inactive:', data);
}

/**
 * Get booking with profit metrics
 */
export async function getBookingWithProfit(id: string): Promise<BookingWithProfit | null> {
  const booking = await getBooking(id);
  if (!booking) return null;

  const profitMargin = booking.b2bPrice > 0
    ? (booking.expectedProfit / booking.b2bPrice) * 100
    : 0;

  return {
    ...booking,
    profitMargin
  };
}

/**
 * Get all bookings with profit metrics
 */
export async function getAllBookingsWithProfit(
  companyId: string,
  filters?: BookingFilters
): Promise<BookingWithProfit[]> {
  // By default, filter out inactive (soft-deleted) bookings
  const mergedFilters = {
    ...filters,
    isActive: filters?.isActive !== undefined ? filters.isActive : true
  };

  console.log('Getting bookings with filters:', mergedFilters);

  const bookings = await getAllBookings(companyId, mergedFilters);

  console.log(`Retrieved ${bookings.length} bookings, active filter:`, mergedFilters.isActive);
  console.log('Bookings:', bookings.map(b => ({ id: b.id, code: b.bookingCode, isActive: b.isActive })));

  return bookings.map(booking => {
    const profitMargin = booking.b2bPrice > 0
      ? (booking.expectedProfit / booking.b2bPrice) * 100
      : 0;

    return {
      ...booking,
      profitMargin
    };
  });
}
