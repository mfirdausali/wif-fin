/**
 * Booking Card PDF Template
 *
 * Generates vendor-facing booking cards for trip elements:
 * - Transportation
 * - Meals
 * - Entrance Fees
 * - Tour Guide
 * - Flights
 * - Accommodation
 *
 * Design aligned with invoice/booking form template (classic, professional style).
 * Company info sourced from Supabase settings.
 */

const CATEGORY_LABELS = {
  transportation: 'TRANSPORTATION',
  meals: 'MEALS / RESTAURANT',
  entrance: 'ENTRANCE FEES',
  tourGuide: 'TOUR GUIDE',
  flights: 'FLIGHTS',
  accommodation: 'ACCOMMODATION'
};

const CATEGORY_ICONS = {
  transportation: '🚗',
  meals: '🍽️',
  entrance: '🎫',
  tourGuide: '👤',
  flights: '✈️',
  accommodation: '🏨'
};

const CATEGORY_UNITS = {
  transportation: 'trip(s)',
  meals: 'meal(s)',
  entrance: 'ticket(s)',
  tourGuide: 'day(s)',
  flights: 'flight(s)',
  accommodation: 'night(s)'
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatQuantityWithUnit(quantity, category) {
  const unit = CATEGORY_UNITS[category] || 'unit(s)';
  const qty = quantity || 1;
  // Singularize unit if quantity is 1
  const unitLabel = qty === 1 ? unit.replace('(s)', '') : unit.replace('(s)', 's');
  return `${qty} ${unitLabel}`;
}

function getWatermarkText(includePrices) {
  if (includePrices) {
    return 'CONFIDENTIAL - INTERNAL USE ONLY';
  }
  return null;
}

function generateBookingCardHTML(booking, category, items, options = {}) {
  const { includePrices = false, companyInfo = {}, printerInfo = {} } = options;

  // Company info - sourced from Supabase via companyInfo parameter
  // No hardcoded defaults - defaults are in supabaseClient.js
  const company = {
    name: companyInfo.name || 'Company Name',
    address: companyInfo.address || '',
    tel: companyInfo.tel || '',
    email: companyInfo.email || '',
    registrationNo: companyInfo.registrationNo || '',
    registeredOffice: companyInfo.registeredOffice || ''
  };

  const categoryLabel = CATEGORY_LABELS[category] || category.toUpperCase();
  const categoryIcon = CATEGORY_ICONS[category] || '📋';
  const watermarkText = getWatermarkText(includePrices);

  // Sort items by date
  const sortedItems = [...items].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  // Calculate totals for this category
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const internalTotal = items.reduce((sum, item) => sum + (item.internalTotal || 0), 0);
  const b2bTotal = items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0);

  // Date range for display
  const dateRangeText = sortedItems.length > 0 && sortedItems[0]?.date
    ? `${formatDateShort(sortedItems[0]?.date)} - ${formatDateShort(sortedItems[sortedItems.length - 1]?.date)}`
    : '-';

  // Generate items rows
  const itemsHTML = sortedItems.map((item, index) => `
    <tr>
      <td style="text-align: center">${index + 1}</td>
      <td style="text-align: center">${item.date ? formatDateShort(item.date) : '-'}</td>
      <td>${item.description || '-'}</td>
      <td style="text-align: center">${item.quantity || 1}</td>
      <td style="font-size: 8pt; color: #666">${item.notes || '-'}</td>
    </tr>
  `).join('');

  // Generate pricing rows (only if includePrices is true)
  const pricingSection = includePrices ? `
    <div class="pricing-section">
      <div class="pricing-header">PRICING INFORMATION - INTERNAL USE ONLY</div>
      <table class="pricing-table">
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 30%">Description</th>
            <th style="width: 8%">Qty</th>
            <th style="width: 14%">Internal (per unit)</th>
            <th style="width: 14%">B2B (per unit)</th>
            <th style="width: 14%">Internal Total</th>
            <th style="width: 15%">B2B Total</th>
          </tr>
        </thead>
        <tbody>
          ${sortedItems.map((item, index) => `
            <tr>
              <td style="text-align: center">${index + 1}</td>
              <td>${item.description || '-'}</td>
              <td style="text-align: center">${item.quantity || 1}</td>
              <td style="text-align: right">¥${formatNumber(item.internalPrice || 0)}</td>
              <td style="text-align: right">¥${formatNumber(item.b2bPrice || 0)}</td>
              <td style="text-align: right">¥${formatNumber(item.internalTotal || 0)}</td>
              <td style="text-align: right">¥${formatNumber(item.b2bTotal || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td></td>
            <td><strong>CATEGORY TOTAL</strong></td>
            <td style="text-align: center"><strong>${totalQuantity}</strong></td>
            <td>-</td>
            <td>-</td>
            <td style="text-align: right"><strong>¥${formatNumber(internalTotal)}</strong></td>
            <td style="text-align: right"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  ` : '';

  // Watermark for confidential documents
  const watermark = watermarkText ? `
    <div class="watermark">${watermarkText}</div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Card - ${categoryLabel} - ${booking.bookingCode}</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #000000;
            background-color: white;
            margin: 0;
            padding: 0;
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            position: relative;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 24pt;
            color: rgba(200, 0, 0, 0.08);
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
            letter-spacing: 3pt;
        }

        .document-container {
            width: 100%;
            margin: 0;
            background: white;
            position: relative;
            z-index: 1;
        }

        /* Header - Invoice style */
        .document-title {
            text-align: center;
            font-size: 18pt;
            font-weight: normal;
            margin-bottom: 6pt;
            letter-spacing: 4pt;
            color: #000000;
        }

        .title-underline {
            width: 100%;
            height: 2pt;
            background: #000000;
            margin-bottom: 16pt;
        }

        .category-badge {
            text-align: center;
            margin-bottom: 16pt;
        }

        .category-badge-inner {
            display: inline-block;
            background: #e8e8e8;
            border: 1pt solid #000000;
            padding: 6pt 16pt;
            font-size: 12pt;
            font-weight: bold;
            letter-spacing: 1pt;
        }

        .category-icon {
            margin-right: 8pt;
        }

        .header-section {
            display: table;
            width: 100%;
            margin-bottom: 16pt;
        }

        .header-left {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-right: 24pt;
        }

        .header-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            text-align: right;
        }

        .company-info {
            margin-bottom: 12pt;
        }

        .company-name {
            font-size: 14pt;
            font-weight: normal;
            margin-bottom: 3pt;
        }

        .company-details {
            font-size: 9pt;
            line-height: 1.4;
            white-space: pre-line;
        }

        .booking-ref {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 6pt;
        }

        /* Trip Info Box - Invoice style */
        .trip-info-box {
            border: 1pt solid #000000;
            margin-bottom: 16pt;
        }

        .trip-info-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            font-weight: bold;
            border-bottom: 0.5pt solid #000000;
        }

        .trip-info-content {
            display: table;
            width: 100%;
        }

        .trip-info-row {
            display: table-row;
        }

        .trip-info-label {
            display: table-cell;
            width: 30%;
            padding: 8pt 12pt;
            background: #f5f5f5;
            border-bottom: 0.5pt solid #ddd;
            font-weight: normal;
        }

        .trip-info-value {
            display: table-cell;
            width: 70%;
            padding: 8pt 12pt;
            border-bottom: 0.5pt solid #ddd;
        }

        .trip-info-row:last-child .trip-info-label,
        .trip-info-row:last-child .trip-info-value {
            border-bottom: none;
        }

        /* Summary Box */
        .summary-box {
            border: 1pt solid #000000;
            margin-bottom: 16pt;
        }

        .summary-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            font-weight: bold;
            border-bottom: 0.5pt solid #000000;
        }

        .summary-content {
            display: table;
            width: 100%;
        }

        .summary-item {
            display: table-cell;
            width: 33.33%;
            padding: 10pt 12pt;
            text-align: center;
            border-right: 0.5pt solid #ddd;
        }

        .summary-item:last-child {
            border-right: none;
        }

        .summary-label {
            font-size: 8pt;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            margin-bottom: 4pt;
        }

        .summary-value {
            font-size: 12pt;
            font-weight: bold;
        }

        /* Items Table - Invoice style */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            border: 1pt solid #000000;
            margin-bottom: 16pt;
        }

        .items-table th {
            background: #e8e8e8;
            padding: 8pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            font-weight: normal;
            text-align: center;
        }

        .items-table td {
            padding: 8pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            line-height: 1.3;
        }

        /* Pricing Section - Invoice style with warning color */
        .pricing-section {
            margin-top: 20pt;
            margin-bottom: 16pt;
            border: 2pt solid #c00;
        }

        .pricing-header {
            background: #fee;
            color: #c00;
            font-weight: bold;
            font-size: 10pt;
            padding: 8pt 12pt;
            text-align: center;
            border-bottom: 1pt solid #c00;
            letter-spacing: 0.5pt;
        }

        .pricing-table {
            width: 100%;
            border-collapse: collapse;
        }

        .pricing-table th {
            background: #fff0f0;
            padding: 8pt;
            font-size: 8pt;
            font-weight: bold;
            text-align: center;
            border-bottom: 0.5pt solid #c00;
        }

        .pricing-table td {
            padding: 8pt;
            font-size: 9pt;
            border-bottom: 0.5pt solid #ddd;
        }

        .pricing-table .totals-row {
            background: #fee;
        }

        .pricing-table .totals-row td {
            border-top: 2pt solid #c00;
            padding: 10pt 8pt;
        }

        /* Notes Section - Invoice style */
        .notes-section {
            margin-top: 16pt;
            border: 1pt solid #000000;
        }

        .notes-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            font-weight: bold;
            border-bottom: 0.5pt solid #000000;
        }

        .notes-content {
            padding: 12pt;
            min-height: 40pt;
            font-size: 9pt;
            line-height: 1.5;
        }

        .notes-lines {
            border-bottom: 0.5pt dotted #999;
            height: 20pt;
            margin-bottom: 4pt;
        }

        /* Vendor Confirmation Section */
        .confirmation-section {
            margin-top: 20pt;
            border: 1pt solid #000000;
            page-break-inside: avoid;
        }

        .confirmation-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            font-weight: bold;
            border-bottom: 0.5pt solid #000000;
        }

        .confirmation-content {
            padding: 14pt;
        }

        .confirmation-grid {
            display: table;
            width: 100%;
        }

        .confirmation-row {
            display: table-row;
        }

        .confirmation-field {
            display: table-cell;
            width: 50%;
            padding: 0 8pt 12pt 0;
        }

        .confirmation-field:last-child {
            padding-right: 0;
        }

        .confirmation-label {
            font-size: 8pt;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            margin-bottom: 4pt;
        }

        .confirmation-line {
            border-bottom: 1pt solid #000000;
            height: 22pt;
        }

        .signature-box {
            border: 1pt dashed #999;
            height: 60pt;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-size: 8pt;
        }

        .confirmation-checkboxes {
            display: flex;
            gap: 24pt;
            margin-top: 14pt;
            padding-top: 14pt;
            border-top: 0.5pt solid #ddd;
        }

        .confirmation-checkbox {
            display: flex;
            align-items: center;
            gap: 6pt;
            font-size: 9pt;
        }

        .checkbox-box {
            width: 14pt;
            height: 14pt;
            border: 1.5pt solid #000000;
        }

        .checkbox-confirmed .checkbox-box {
            border-color: #4A7A5A;
        }

        .checkbox-pending .checkbox-box {
            border-color: #B8963F;
        }

        .checkbox-cannot .checkbox-box {
            border-color: #C75B4A;
        }

        /* Footer is handled by Puppeteer page footer - not in HTML */

        /* Print specific */
        @media print {
            body {
                padding: 0;
            }

            .document-container {
                max-width: 100%;
            }

            .confirmation-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    ${watermark}
    <div class="document-container">
        <!-- Header -->
        <div class="document-title">BOOKING CARD</div>
        <div class="title-underline"></div>

        <div class="category-badge">
            <div class="category-badge-inner">
                <span>${categoryLabel}</span>
            </div>
        </div>

        <div class="header-section">
            <div class="header-left">
                <div class="company-info">
                    <div class="company-name">${company.name}</div>
                    <div class="company-details">${company.address}
Tel: ${company.tel}
Email: ${company.email}</div>
                </div>
            </div>

            <div class="header-right">
                <div class="booking-ref">${booking.bookingCode || 'N/A'}</div>
                <div style="font-size: 9pt; color: #666">Issue Date: ${formatDate(booking.createdAt || new Date().toISOString())}</div>
            </div>
        </div>

        <!-- Trip Information -->
        <div class="trip-info-box">
            <div class="trip-info-header">TRIP INFORMATION</div>
            <div class="trip-info-content">
                <div class="trip-info-row">
                    <div class="trip-info-label">Guest Name</div>
                    <div class="trip-info-value"><strong>${booking.guestName || '-'}</strong></div>
                </div>
                <div class="trip-info-row">
                    <div class="trip-info-label">Trip Period</div>
                    <div class="trip-info-value">${formatDate(booking.tripStartDate)}${booking.tripEndDate ? ' - ' + formatDate(booking.tripEndDate) : ''}</div>
                </div>
                <div class="trip-info-row">
                    <div class="trip-info-label">Number of Pax</div>
                    <div class="trip-info-value">${booking.numberOfPax || '-'}</div>
                </div>
                <div class="trip-info-row">
                    <div class="trip-info-label">Country</div>
                    <div class="trip-info-value">${booking.country || '-'}</div>
                </div>
            </div>
        </div>

        <!-- Summary Box -->
        <div class="summary-box">
            <div class="summary-header">${categoryLabel} SUMMARY</div>
            <div class="summary-content">
                <div class="summary-item">
                    <div class="summary-label">Total Items</div>
                    <div class="summary-value">${sortedItems.length}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Quantity</div>
                    <div class="summary-value">${formatQuantityWithUnit(totalQuantity, category)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Date Range</div>
                    <div class="summary-value">${dateRangeText}</div>
                </div>
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 5%">#</th>
                    <th style="width: 12%">Date</th>
                    <th style="width: 43%">Description</th>
                    <th style="width: 10%">Qty</th>
                    <th style="width: 30%">Notes / Special Requirements</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>

        ${pricingSection}

        <!-- Notes Section -->
        <div class="notes-section">
            <div class="notes-header">Additional Notes</div>
            <div class="notes-content">
                ${booking.notes ? booking.notes : `
                <div class="notes-lines"></div>
                <div class="notes-lines"></div>
                <div class="notes-lines"></div>
                `}
            </div>
        </div>

        <!-- Vendor Confirmation -->
        <div class="confirmation-section">
            <div class="confirmation-header">VENDOR CONFIRMATION</div>
            <div class="confirmation-content">
                <div class="confirmation-grid">
                    <div class="confirmation-row">
                        <div class="confirmation-field">
                            <div class="confirmation-label">Vendor / Supplier Name</div>
                            <div class="confirmation-line"></div>
                        </div>
                        <div class="confirmation-field">
                            <div class="confirmation-label">Contact Person</div>
                            <div class="confirmation-line"></div>
                        </div>
                    </div>
                    <div class="confirmation-row">
                        <div class="confirmation-field">
                            <div class="confirmation-label">Contact Number</div>
                            <div class="confirmation-line"></div>
                        </div>
                        <div class="confirmation-field">
                            <div class="confirmation-label">Date</div>
                            <div class="confirmation-line"></div>
                        </div>
                    </div>
                </div>
                <div class="confirmation-field" style="width: 100%; padding-right: 0;">
                    <div class="confirmation-label">Signature / Stamp</div>
                    <div class="signature-box">Vendor signature or stamp here</div>
                </div>
                <div class="confirmation-checkboxes">
                    <div class="confirmation-checkbox checkbox-confirmed">
                        <span class="checkbox-box"></span>
                        <span>Confirmed</span>
                    </div>
                    <div class="confirmation-checkbox checkbox-pending">
                        <span class="checkbox-box"></span>
                        <span>Pending</span>
                    </div>
                    <div class="confirmation-checkbox checkbox-cannot">
                        <span class="checkbox-box"></span>
                        <span>Cannot Fulfill</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer is handled by Puppeteer page footer in index.js -->
        <!-- This ensures consistent footer on every page with page numbers -->
    </div>
</body>
</html>`;
}

/**
 * Generate combined booking card with multiple categories
 */
function generateCombinedBookingCardHTML(booking, categoriesData, options = {}) {
  const { includePrices = false, companyInfo = {}, printerInfo = {} } = options;

  const pages = categoriesData.map(({ category, items }) => {
    return generateBookingCardHTML(booking, category, items, { includePrices, companyInfo, printerInfo });
  });

  // For combined output, we'll add page breaks between categories
  return pages.join('\n<div style="page-break-before: always;"></div>\n');
}

module.exports = {
  generateBookingCardHTML,
  generateCombinedBookingCardHTML,
  CATEGORY_LABELS
};
