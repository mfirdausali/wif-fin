# Invoice PDF Line Items Fix

## Problem
The invoice PDF generation was showing empty line items table with JPY 0.00 total, even though the frontend showed correct line items and amounts.

## Root Cause
There was a property name mismatch between the TypeScript interface and the PDF template:
- **Frontend TypeScript** (`types/document.ts`): Uses `items: LineItem[]` property
- **PDF Template** (`pdf-service/src/templates/invoice.js`): Was expecting `lineItems` property

## Solution Applied

### 1. Updated PDF Template (`/Users/firdaus/Documents/2025/code/wif-fin/pdf-service/src/templates/invoice.js`)
- Changed from `invoice.lineItems` to `invoice.items` to match TypeScript interface
- Added fallback logic to use provided totals or calculate them
- Improved handling of subtotal, tax, and total calculations

### 2. Added Debugging Logs (`/Users/firdaus/Documents/2025/code/wif-fin/pdf-service/src/index.js`)
- Added console logging to track incoming invoice data
- Logs document number, customer, items count, and total for debugging

## Files Modified
1. `/Users/firdaus/Documents/2025/code/wif-fin/pdf-service/src/templates/invoice.js`
2. `/Users/firdaus/Documents/2025/code/wif-fin/pdf-service/src/index.js`

## Test Results
Created and ran test script that confirms:
- Line items now appear correctly in the PDF
- Amounts are calculated properly (Subtotal: 2000, Tax: 200, Total: 2200)
- All invoice data is properly displayed

## How to Apply the Fix
1. The changes have been made to the PDF service files
2. Restart the PDF service: `npm start` or `npm run dev`
3. Test by generating a new invoice PDF from the frontend

## Verification
The fix ensures that:
- Line items from the frontend (`items` array) are correctly processed
- Subtotal, tax, and total amounts are properly calculated
- The PDF matches what's shown in the frontend UI