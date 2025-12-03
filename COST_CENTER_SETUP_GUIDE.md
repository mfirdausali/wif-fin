# Cost Center & Booking Form Setup Guide

## 🎯 New Features Added

You now have a complete **Cost Center and Booking Form system** for tracking trip profitability!

### What's Been Built:

1. **Cost Centers** - Track trips/projects with budgeted vs actual revenue/costs
2. **Booking Forms** - Detailed trip cost breakdown (like Hilmi Salleh Osaka trip)
3. **Profit/Loss Analysis** - See profit margins, cost breakdowns, variance analysis
4. **Document Linking** - Connect invoices, receipts, vouchers to trips

---

## 📍 Where to Access the New Features

In your application, you'll now see **3 tabs** instead of 2:

```
[Documents] [Accounts] [Cost Centers] ← NEW!
```

Click on the **"Cost Centers"** tab to access all the new functionality.

---

## ⚠️ REQUIRED: Database Setup

Before you can use the new features, you need to create 3 new database tables in Supabase.

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. Click on **SQL Editor** in the left sidebar

3. Run these 3 migration files **in order**:

#### Step 1: Create `cost_centers` table
```sql
-- Copy contents from: supabase/migrations/004_add_cost_centers.sql
-- Paste and run in SQL Editor
```

#### Step 2: Create `booking_forms` table
```sql
-- Copy contents from: supabase/migrations/005_add_booking_forms.sql
-- Paste and run in SQL Editor
```

#### Step 3: Update `documents` table
```sql
-- Copy contents from: supabase/migrations/006_add_cost_center_to_documents.sql
-- Paste and run in SQL Editor
```

### Option 2: Using Migration Files Directly

Navigate to each file in your project and copy-paste the SQL into Supabase SQL Editor:

- `supabase/migrations/004_add_cost_centers.sql`
- `supabase/migrations/005_add_booking_forms.sql`
- `supabase/migrations/006_add_cost_center_to_documents.sql`

---

## ✅ Verify Setup

After running migrations, verify in Supabase Dashboard → Table Editor:

You should see these new tables:
- ✅ `cost_centers` (with ~15 columns)
- ✅ `booking_forms` (with ~30 columns)
- ✅ `documents` table should now have `cost_center_id` column

---

## 🚀 Using the New Features

### 1. Create Your First Cost Center (Trip)

1. Click **"Cost Centers"** tab
2. Click **"New Cost Center"** button
3. Fill in the form:
   - **Type**: Trip
   - **Name**: Hilmi Salleh - Osaka Tour
   - **Guest Name**: Hilmi Salleh
   - **Start/End Date**: Your trip dates
   - **Number of Pax**: 8A + 2CWB + 1TG
   - **Country**: Japan
   - **Currency**: JPY
   - **Budgeted Revenue**: Expected income (MYR)
   - **Budgeted Cost**: Expected expenses (MYR)
4. Click **"Create Cost Center"**
   - System auto-generates code: `TRIP-2025-001`

### 2. View Trip Details

1. Click on the cost center card you just created
2. You'll see:
   - Trip information summary
   - Financial cards (Revenue, Costs, Profit/Loss)
   - Cost breakdown by category
   - Linked documents (invoices, receipts, etc.)
   - Booking forms section

### 3. Create a Booking Form

1. In trip details view, click **"New Booking Form"**
2. The form auto-populates trip info
3. Add line items for each category:

   **Transportation Tab:**
   - Coaster: ¥150,000
   - 14-Seater: ¥80,000
   - Etc.

   **Meals Tab:**
   - Breakfast Day 1: ¥15,000
   - Lunch Day 1: ¥20,000
   - Etc.

   **Entrance Fees Tab:**
   - Osaka Castle: ¥3,500
   - Wonder Cruise: ¥5,500
   - Etc.

   **Tour Guide Tab:**
   - Accommodation: ¥35,000
   - Meals: ¥25,000
   - Transport: ¥15,000
   - Guide Fee: ¥60,000

   **Flights Tab:** (if applicable)

   **Accommodation Tab:**
   - Hotel Night 1: ¥45,000
   - Etc.

4. System automatically calculates:
   - Category subtotals
   - Grand total in JPY
   - Conversion to MYR (using exchange rate)

5. Enter pricing:
   - **WIF Cost**: Total cost WIF pays (MYR)
   - **B2B Selling Price**: What you charge customer (MYR)
   - **Expected Profit**: Auto-calculated

6. Click **"Create Booking Form"**

### 4. Track Profitability

Back in the trip details view, you'll now see:

- **Cost Breakdown Chart**: Shows spending by category
- **Expected vs Actual**: Compare budgeted to real numbers
- **Profit Margin**: Percentage profit on the trip
- **All Documents**: Invoices, receipts linked to this trip

### 5. Link Documents to Trips

When creating invoices or payment vouchers, you can now link them to cost centers. This updates the actual revenue/cost automatically!

---

## 📊 What You Get

### Cost Center List View
- Filter by: All, Trips, Planning, Active, Completed
- See at a glance:
  - Trip code (TRIP-2025-001)
  - Guest name and pax
  - Trip dates and country
  - Budgeted vs Actual revenue
  - Profit/loss with color indicators (green = profit, red = loss)
  - Profit margin percentage

### Trip Details View
- Complete financial analysis
- Revenue tracking (Budgeted → Invoiced → Received)
- Cost tracking (Budgeted → Total Costs → Paid)
- Actual profit vs budgeted profit
- Variance analysis
- Document tabs showing all related:
  - Invoices
  - Receipts
  - Payment Vouchers
  - Statements of Payment
- Booking forms with cost breakdown

### Booking Form Editor
- 6 category tabs for organized data entry
- Auto-calculations throughout
- Real-time totals and profit margins
- Currency conversion (JPY ↔ MYR)
- WIF cost vs B2B pricing comparison

---

## 🎨 UI Features

All new components follow your existing design:
- ✅ Same card-based layouts
- ✅ Consistent color scheme (blue, green, red badges)
- ✅ Same icons (Lucide React)
- ✅ Permission-based access (respects user roles)
- ✅ Responsive design
- ✅ Toast notifications for all actions

---

## 🔐 Permissions

The system respects your existing user permissions:

- **Admin / Finance Manager**: Full access (create, edit, delete)
- **Viewer**: Read-only access (can view but not modify)

---

## 🛠️ Technical Details

### Database Tables Created:

1. **cost_centers**
   - Stores trip/project information
   - Budget tracking (revenue and cost)
   - Actual revenue/cost (auto-updated from documents)
   - Status workflow (Planning → Active → Completed → Closed)

2. **booking_forms**
   - Detailed cost breakdown by category
   - JSONB fields for flexible line items
   - Auto-calculated totals
   - WIF cost vs B2B price comparison

3. **documents** (updated)
   - Added `cost_center_id` column
   - Links invoices/receipts/vouchers to trips

### Services Created:

- `costCenterService.ts` - CRUD operations, profit calculations
- `bookingFormService.ts` - Booking form management, line item editing
- `profitLossService.ts` - Financial analysis, reporting
- Updated `supabaseService.ts` - Document linking

### Components Created:

- `CostCenterList.tsx` - List view with filters
- `CostCenterForm.tsx` - Create/edit cost centers
- `CostCenterDetails.tsx` - Detailed financial view
- `CostCenterManagement.tsx` - Main container
- `BookingFormEditor.tsx` - Complete booking form UI
- `BookingFormLineItemEditor.tsx` - Reusable line item editor

---

## 📝 Example Workflow

**Scenario: Tracking Hilmi Salleh's Osaka Trip**

1. **Create Cost Center**
   - Name: Hilmi Salleh - Osaka Tour
   - Dates: Dec 27-31, 2025
   - Pax: 8A + 2CWB + 1TG
   - Budgeted Revenue: RM 30,000
   - Budgeted Cost: RM 24,000
   - Expected Profit: RM 6,000 (20% margin)

2. **Create Booking Form**
   - Add all transportation costs (Coaster, 14-seater)
   - Add all meal costs (B/L/D for 5 days)
   - Add entrance fees (Osaka Castle, temples, cruise)
   - Add tour guide expenses
   - System calculates total: ¥769,200 = RM 23,845
   - Enter WIF Cost: RM 23,845
   - Enter B2B Price: RM 30,000
   - Expected Profit: RM 6,155

3. **Create Invoice**
   - When creating invoice for customer
   - Link to "Hilmi Salleh - Osaka Tour" cost center
   - Amount: RM 30,000
   - System auto-updates cost center actual revenue

4. **Track Expenses**
   - Create payment vouchers for suppliers
   - Link each to the same cost center
   - System auto-updates actual costs

5. **View Profit/Loss**
   - Go to trip details
   - See real-time profit calculation
   - Compare budgeted vs actual
   - Export report (coming soon)

---

## 🐛 Troubleshooting

**Can't see Cost Centers tab?**
- Make sure you've run all 3 database migrations
- Refresh the page after migrations

**Getting database errors?**
- Check Supabase Dashboard → Table Editor
- Verify all tables exist
- Check RLS policies are enabled

**Can't create cost center?**
- Check your user role has permissions
- Verify companyId is set correctly

**Booking form totals not calculating?**
- Make sure line items have quantity and price
- Check exchange rate is entered

---

## 🎯 Next Steps

After setup, you can:

1. ✅ Create cost centers for all your trips
2. ✅ Enter detailed booking forms with cost breakdowns
3. ✅ Link all invoices and payment vouchers to trips
4. ✅ Track profitability in real-time
5. ✅ Analyze which trips are most profitable
6. 🔜 Export P&L reports (PDF/Excel) - coming soon
7. 🔜 Analytics dashboard - coming soon

---

## 💡 Tips

- **Use consistent naming**: "Guest Name - Destination Tour"
- **Update booking forms**: Edit as costs change during planning
- **Link documents early**: Connect invoices/vouchers as you create them
- **Review regularly**: Check trip details to see actual vs budgeted
- **Plan better**: Use historical data to improve future budgets

---

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Verify database migrations ran successfully
3. Check browser console for errors
4. Verify Supabase connection

---

**You're all set! 🎉**

Click the "Cost Centers" tab and start tracking your trip profitability!
