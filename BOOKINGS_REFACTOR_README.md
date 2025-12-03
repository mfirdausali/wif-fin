# Bookings System - Complete Refactor

## What Changed

I've completely refactored the system to remove the unnecessary "Cost Centers" concept and built a clean, simple **Bookings** system instead.

### Before (Cost Centers - REMOVED):
- ❌ Cost Centers (unnecessary accounting abstraction)
- ❌ Booking Forms nested inside Cost Centers (confusing)
- ❌ Overly complex relationships

### After (Bookings - NEW):
- ✅ **Bookings** - The main feature for managing trips
- ✅ Direct, simple structure
- ✅ All trip info in one place
- ✅ Profit tracking built-in

## New Database Structure

### Main Table: `bookings`
Stores everything about a trip/tour booking:
- Guest information
- Trip dates & details
- Cost breakdown (transportation, meals, flights, accommodation, etc.)
- Pricing (WIF cost, B2B price, profit)
- Status (planning → confirmed → in_progress → completed)

## Files Created

### Types
- `types/booking.ts` - TypeScript types for bookings

### Services
- `services/bookingService.ts` - All booking CRUD operations

### Components
- `components/BookingList.tsx` - List all bookings with tabs by status
- `components/BookingForm.tsx` - Create/edit bookings
- `components/BookingManagement.tsx` - Main container component
- `components/BookingFormLineItemEditor.tsx` - Cost breakdown editor

### Database
- `supabase/migrations/002_bookings_only.sql` - Migration to refactor database

## Files Deleted

Removed all cost center related code:
- All `CostCenter*.tsx` components
- `services/costCenterService.ts`
- `services/bookingFormService.ts`
- `services/profitLossService.ts`
- `types/costcenter.ts`
- `types/profitloss.ts`

## Next Steps - YOU NEED TO DO THIS!

### 1. Run the Database Migration

**IMPORTANT:** You must run the migration to update your database schema.

**Option 1: Supabase Dashboard (Recommended - 1 minute)**
1. Open: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy ALL contents from: `supabase/migrations/002_bookings_only.sql`
3. Paste into SQL editor
4. Click **RUN**

**Option 2: Supabase CLI**
```bash
npx supabase db push
```

### 2. Deploy to Production

The code is already built and ready. Just run:

```bash
./deploy-frontend-only.sh
```

This will:
- Upload to S3
- Invalidate CloudFront cache
- Deploy in 1-2 minutes

### 3. Test the New Bookings Tab

1. Open https://finance.wifjapan.com
2. Click the **"Bookings"** tab (3rd tab)
3. Create your first booking
4. Add cost breakdown details
5. See profit calculations in real-time

## What the Bookings Tab Includes

### Main Features:
1. **Create Booking** - Add new trip with guest name, dates, country
2. **Cost Breakdown** - Detailed line items for:
   - Transportation
   - Meals
   - Entrance fees
   - Tour guide
   - Flights
   - Accommodation
3. **Pricing** - Set WIF cost and B2B price, see profit automatically
4. **Status Tracking** - Planning → Confirmed → In Progress → Completed
5. **List Views** - Filter by status in separate tabs
6. **Profit Metrics** - See profit and margin for each booking

### Booking Workflow:
1. Create booking (guest, dates, destination)
2. Add cost breakdown (all expenses in JPY)
3. Set WIF cost and B2B price (in MYR)
4. System calculates profit automatically
5. Track booking through status changes
6. Link to invoices/vouchers (coming next)

## Technical Notes

- Auto-generates booking codes: `BK-2025-001`, `BK-2025-002`, etc.
- Supports JPY and MYR currencies
- Exchange rate conversion built-in
- RLS policies ensure company data isolation
- Soft deletes (sets `is_active = false`)

## Future Enhancements (Not Yet Implemented)

- Link bookings to invoices
- Link bookings to payment vouchers
- Export booking summary
- Booking templates for common trips
- Analytics dashboard for all bookings

---

**Questions?** The system is now much simpler - just Bookings! No more confusion with cost centers.
