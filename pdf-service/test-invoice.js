// Test script to verify invoice PDF generation with line items
const { generateInvoiceHTML } = require('./src/templates/invoice');

// Sample invoice data matching the TypeScript Invoice interface
const testInvoice = {
  id: 'test-001',
  documentType: 'invoice',
  documentNumber: 'INV-1762743865739',
  date: '2025-01-11',
  status: 'paid',
  currency: 'JPY',
  amount: 2200,
  country: 'Japan',

  // Customer details
  customerName: 'MUHAMAD FIRDAUS BIN ALI',
  customerAddress: 'Tokyo, Japan',
  customerEmail: 'firdaus@example.com',

  // Invoice specific fields
  invoiceDate: '2025-01-11',
  dueDate: '2025-02-11',

  // Line items - this is the critical field that was missing in PDF
  items: [
    {
      id: 'item-001',
      description: 'Test',
      quantity: 1,
      unitPrice: 2000,
      amount: 2000
    }
  ],

  // Totals
  subtotal: 2000,
  taxRate: 10,
  taxAmount: 200,
  total: 2200,
  paymentTerms: 'Net 30 Days',

  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Test the HTML generation
console.log('Testing invoice HTML generation...');
console.log('Invoice data:', {
  documentNumber: testInvoice.documentNumber,
  customerName: testInvoice.customerName,
  itemsCount: testInvoice.items.length,
  items: testInvoice.items,
  total: testInvoice.total,
  currency: testInvoice.currency
});

try {
  const html = generateInvoiceHTML(testInvoice);

  // Check if HTML contains the line items
  const hasLineItem = html.includes('Test') && html.includes('2000');
  const hasCorrectTotal = html.includes('2200') || html.includes('2,200');

  console.log('\n✓ HTML generated successfully');
  console.log(`✓ Line items included: ${hasLineItem ? 'YES' : 'NO'}`);
  console.log(`✓ Correct total shown: ${hasCorrectTotal ? 'YES' : 'NO'}`);

  if (!hasLineItem) {
    console.error('\n✗ ERROR: Line items are not appearing in the HTML!');
  }

  if (!hasCorrectTotal) {
    console.error('\n✗ ERROR: Total amount is incorrect in the HTML!');
  }

  // Save HTML for manual inspection
  const fs = require('fs');
  fs.writeFileSync('/Users/firdaus/Documents/2025/code/wif-fin/pdf-service/test-invoice.html', html);
  console.log('\nTest HTML saved to test-invoice.html for inspection');

} catch (error) {
  console.error('Error generating HTML:', error);
}