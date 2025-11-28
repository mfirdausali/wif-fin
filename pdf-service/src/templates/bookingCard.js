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
 * Matches Supabase database structure:
 * - Each category has line items with: date, description, quantity, prices, notes
 * - Clear category grouping with visual hierarchy
 * - Optional pricing section for internal use
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
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatQuantityWithUnit(quantity, category) {
  const unit = CATEGORY_UNITS[category] || 'unit(s)';
  const qty = quantity || 1;
  // Singularize unit if quantity is 1
  const unitLabel = qty === 1 ? unit.replace('(s)', '') : unit.replace('(s)', 's');
  return `${qty} ${unitLabel}`;
}

function generateBookingCardHTML(booking, category, items, options = {}) {
  const { includePrices = false, companyInfo = {} } = options;

  const company = {
    name: companyInfo.name || 'WIF JAPAN SDN BHD',
    address: companyInfo.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: companyInfo.tel || '+60-XXX-XXXXXXX',
    email: companyInfo.email || 'info@wifjapan.com'
  };

  const categoryLabel = CATEGORY_LABELS[category] || category.toUpperCase();
  const categoryIcon = CATEGORY_ICONS[category] || '📋';

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

  // Generate items rows with enhanced structure
  const itemsHTML = sortedItems.map((item, index) => `
    <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="row-num">${index + 1}</td>
      <td class="date-col">${item.date ? formatDateShort(item.date) : '-'}</td>
      <td class="description-col">
        <div class="item-description">${item.description || '-'}</div>
      </td>
      <td class="qty-col">
        <div class="qty-value">${item.quantity || 1}</div>
      </td>
      <td class="notes-col">${item.notes || '-'}</td>
    </tr>
  `).join('');

  // Generate pricing rows (only if includePrices is true)
  const pricingItemsHTML = includePrices ? sortedItems.map((item, index) => `
    <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="row-num">${index + 1}</td>
      <td class="description-col">${item.description || '-'}</td>
      <td class="qty-col">${item.quantity || 1}</td>
      <td class="price-col">¥${formatNumber(item.internalPrice || 0)}</td>
      <td class="price-col">¥${formatNumber(item.b2bPrice || 0)}</td>
      <td class="price-col total-col">¥${formatNumber(item.internalTotal || 0)}</td>
      <td class="price-col total-col">¥${formatNumber(item.b2bTotal || 0)}</td>
    </tr>
  `).join('') : '';

  const pricingSection = includePrices ? `
    <div class="pricing-section">
      <div class="pricing-header">
        <span class="warning-icon">⚠️</span>
        PRICING INFORMATION - INTERNAL USE ONLY
      </div>
      <table class="pricing-table">
        <thead>
          <tr>
            <th class="row-num">#</th>
            <th class="description-col">Item Description</th>
            <th class="qty-col">Qty</th>
            <th class="price-col">Internal<br/>(per unit)</th>
            <th class="price-col">B2B<br/>(per unit)</th>
            <th class="price-col total-col">Internal<br/>Total</th>
            <th class="price-col total-col">B2B<br/>Total</th>
          </tr>
        </thead>
        <tbody>
          ${pricingItemsHTML}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td class="row-num"></td>
            <td class="description-col"><strong>CATEGORY TOTAL</strong></td>
            <td class="qty-col"><strong>${totalQuantity}</strong></td>
            <td class="price-col">-</td>
            <td class="price-col">-</td>
            <td class="price-col total-col"><strong>¥${formatNumber(internalTotal)}</strong></td>
            <td class="price-col total-col"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  ` : '';

  const watermark = includePrices ? `
    <div class="watermark">INTERNAL USE ONLY</div>
  ` : '';

  // Summary stats row
  const summaryRow = `
    <div class="summary-row">
      <div class="summary-item">
        <div class="summary-label">Total Items</div>
        <div class="summary-value">${sortedItems.length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Quantity</div>
        <div class="summary-value">${formatQuantityWithUnit(totalQuantity, category)}</div>
      </div>
      ${items[0]?.date ? `
      <div class="summary-item">
        <div class="summary-label">Date Range</div>
        <div class="summary-value">${formatDateShort(sortedItems[0]?.date)} - ${formatDateShort(sortedItems[sortedItems.length - 1]?.date)}</div>
      </div>
      ` : ''}
    </div>
  `;

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
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.4;
            color: #1A1815;
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
            font-size: 60pt;
            color: rgba(199, 91, 74, 0.08);
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
        }

        .document-container {
            width: 100%;
            margin: 0;
            background: white;
            position: relative;
            z-index: 1;
        }

        /* Header */
        .document-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16pt;
            padding-bottom: 12pt;
            border-bottom: 2pt solid #1A1815;
        }

        .document-title-section {
            flex: 1;
        }

        .document-title {
            font-size: 18pt;
            font-weight: 300;
            letter-spacing: 4pt;
            color: #1A1815;
            margin-bottom: 4pt;
        }

        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 8pt;
            background: #F5F3EF;
            border: 1pt solid #E8E6E2;
            border-radius: 4pt;
            padding: 6pt 12pt;
            margin-top: 6pt;
        }

        .category-icon {
            font-size: 14pt;
        }

        .category-name {
            font-size: 12pt;
            font-weight: 600;
            color: #1A1815;
            letter-spacing: 1pt;
        }

        .booking-ref-box {
            text-align: right;
        }

        .booking-ref-label {
            font-size: 8pt;
            color: #6B6560;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
        }

        .booking-ref-value {
            font-size: 14pt;
            font-weight: 600;
            color: #B8963F;
            font-family: 'Courier New', monospace;
        }

        /* Info Grid */
        .info-grid {
            display: table;
            width: 100%;
            margin-bottom: 16pt;
        }

        .info-left, .info-right {
            display: table-cell;
            vertical-align: top;
            width: 50%;
        }

        .info-left {
            padding-right: 16pt;
        }

        .company-info {
            font-size: 9pt;
            line-height: 1.5;
        }

        .company-name {
            font-size: 11pt;
            font-weight: 600;
            margin-bottom: 4pt;
        }

        .company-details {
            color: #5C5650;
            white-space: pre-line;
        }

        .booking-info-card {
            background: #FAF8F5;
            border: 1pt solid #E8E6E2;
            border-radius: 6pt;
            padding: 12pt;
        }

        .booking-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6pt;
            font-size: 9pt;
        }

        .booking-info-row:last-child {
            margin-bottom: 0;
        }

        .booking-info-label {
            color: #6B6560;
        }

        .booking-info-value {
            font-weight: 600;
            color: #1A1815;
            text-align: right;
        }

        /* Section Title */
        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10pt;
            padding-bottom: 6pt;
            border-bottom: 1pt solid #E8E6E2;
        }

        .section-title {
            font-size: 11pt;
            font-weight: 600;
            color: #1A1815;
            letter-spacing: 0.5pt;
        }

        .item-count-badge {
            background: #B8963F;
            color: white;
            font-size: 8pt;
            font-weight: 600;
            padding: 3pt 8pt;
            border-radius: 10pt;
        }

        /* Summary Row */
        .summary-row {
            display: flex;
            gap: 20pt;
            background: #F5F3EF;
            border: 1pt solid #E8E6E2;
            border-radius: 6pt;
            padding: 10pt 14pt;
            margin-bottom: 12pt;
        }

        .summary-item {
            flex: 1;
        }

        .summary-label {
            font-size: 8pt;
            color: #6B6560;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            margin-bottom: 2pt;
        }

        .summary-value {
            font-size: 11pt;
            font-weight: 600;
            color: #1A1815;
        }

        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16pt;
        }

        .items-table th {
            background: #1A1815;
            color: white;
            padding: 10pt 8pt;
            font-size: 8pt;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            text-align: left;
        }

        .items-table td {
            padding: 10pt 8pt;
            font-size: 9pt;
            border-bottom: 1pt solid #E8E6E2;
            vertical-align: top;
        }

        .items-table .row-even {
            background: #FFFFFF;
        }

        .items-table .row-odd {
            background: #FAFAF8;
        }

        .items-table .row-num {
            width: 5%;
            text-align: center;
            color: #8C8680;
            font-size: 8pt;
        }

        .items-table th.row-num {
            color: rgba(255,255,255,0.6);
        }

        .items-table .date-col {
            width: 12%;
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 8pt;
        }

        .items-table .description-col {
            width: 43%;
        }

        .item-description {
            font-weight: 500;
            color: #1A1815;
        }

        .items-table .qty-col {
            width: 10%;
            text-align: center;
        }

        .qty-value {
            background: #F5F3EF;
            border: 1pt solid #E8E6E2;
            border-radius: 4pt;
            padding: 2pt 8pt;
            display: inline-block;
            font-weight: 600;
            font-size: 10pt;
        }

        .items-table .notes-col {
            width: 30%;
            font-size: 8pt;
            color: #5C5650;
            font-style: italic;
        }

        /* Pricing Section */
        .pricing-section {
            margin-top: 20pt;
            margin-bottom: 16pt;
            border: 2pt solid #C75B4A;
            border-radius: 6pt;
            overflow: hidden;
        }

        .pricing-header {
            background: rgba(199, 91, 74, 0.1);
            color: #C75B4A;
            font-weight: 700;
            font-size: 10pt;
            padding: 10pt 14pt;
            text-align: center;
            border-bottom: 1pt solid #C75B4A;
            letter-spacing: 0.5pt;
        }

        .warning-icon {
            margin-right: 8pt;
        }

        .pricing-table {
            width: 100%;
            border-collapse: collapse;
        }

        .pricing-table th {
            background: #FEF6F5;
            padding: 8pt 6pt;
            font-size: 7pt;
            font-weight: 700;
            text-align: center;
            border-bottom: 1pt solid rgba(199, 91, 74, 0.3);
            color: #1A1815;
        }

        .pricing-table td {
            padding: 8pt 6pt;
            font-size: 8pt;
            text-align: center;
            border-bottom: 0.5pt solid #F0EEEC;
        }

        .pricing-table .row-num {
            width: 5%;
            color: #8C8680;
        }

        .pricing-table .description-col {
            text-align: left;
            width: 30%;
        }

        .pricing-table .qty-col {
            width: 8%;
        }

        .pricing-table .price-col {
            width: 13%;
            text-align: right;
            font-family: 'Courier New', monospace;
            font-size: 8pt;
        }

        .pricing-table .total-col {
            background: rgba(199, 91, 74, 0.03);
            font-weight: 500;
        }

        .pricing-table .totals-row {
            background: rgba(199, 91, 74, 0.1);
        }

        .pricing-table .totals-row td {
            border-top: 2pt solid #C75B4A;
            padding: 10pt 6pt;
        }

        /* Notes Section */
        .notes-section {
            margin-top: 16pt;
            border: 1pt solid #E8E6E2;
            border-radius: 6pt;
            overflow: hidden;
        }

        .notes-header {
            background: #F5F3EF;
            padding: 8pt 12pt;
            font-size: 9pt;
            font-weight: 600;
            color: #1A1815;
            border-bottom: 1pt solid #E8E6E2;
        }

        .notes-content {
            padding: 12pt;
            min-height: 50pt;
            font-size: 9pt;
            line-height: 1.5;
            color: #5C5650;
        }

        .notes-lines {
            border-bottom: 0.5pt dotted #D5D0C8;
            height: 20pt;
            margin-bottom: 4pt;
        }

        /* Confirmation Section */
        .confirmation-section {
            margin-top: 20pt;
            border: 1pt solid #1A1815;
            border-radius: 6pt;
            overflow: hidden;
            page-break-inside: avoid;
        }

        .confirmation-header {
            background: #1A1815;
            color: white;
            padding: 8pt 12pt;
            font-size: 10pt;
            font-weight: 600;
            letter-spacing: 0.5pt;
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
            font-size: 7pt;
            color: #6B6560;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            margin-bottom: 4pt;
        }

        .confirmation-line {
            border-bottom: 1pt solid #1A1815;
            height: 22pt;
        }

        .signature-box {
            border: 1pt dashed #D5D0C8;
            border-radius: 4pt;
            height: 60pt;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #B5B0A8;
            font-size: 8pt;
        }

        .confirmation-checkboxes {
            display: flex;
            gap: 24pt;
            margin-top: 14pt;
            padding-top: 14pt;
            border-top: 1pt solid #E8E6E2;
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
            border: 1.5pt solid #1A1815;
            border-radius: 2pt;
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

        /* Footer */
        .footer-note {
            margin-top: 16pt;
            text-align: center;
            font-size: 8pt;
            color: #8C8680;
            font-style: italic;
            padding-top: 12pt;
            border-top: 1pt solid #E8E6E2;
        }
    </style>
</head>
<body>
    ${watermark}
    <div class="document-container">
        <!-- Header -->
        <div class="document-header">
            <div class="document-title-section">
                <div class="document-title">BOOKING CARD</div>
                <div class="category-badge">
                    <span class="category-icon">${categoryIcon}</span>
                    <span class="category-name">${categoryLabel}</span>
                </div>
            </div>
            <div class="booking-ref-box">
                <div class="booking-ref-label">Reference</div>
                <div class="booking-ref-value">${booking.bookingCode || '-'}</div>
            </div>
        </div>

        <!-- Info Grid -->
        <div class="info-grid">
            <div class="info-left">
                <div class="company-info">
                    <div class="company-name">${company.name}</div>
                    <div class="company-details">${company.address}
Tel: ${company.tel}
Email: ${company.email}</div>
                </div>
            </div>
            <div class="info-right">
                <div class="booking-info-card">
                    <div class="booking-info-row">
                        <span class="booking-info-label">Guest / Group</span>
                        <span class="booking-info-value">${booking.guestName || '-'}</span>
                    </div>
                    <div class="booking-info-row">
                        <span class="booking-info-label">Trip Period</span>
                        <span class="booking-info-value">${formatDate(booking.tripStartDate)}${booking.tripEndDate ? ' - ' + formatDate(booking.tripEndDate) : ''}</span>
                    </div>
                    <div class="booking-info-row">
                        <span class="booking-info-label">Number of Pax</span>
                        <span class="booking-info-value">${booking.numberOfPax || '-'}</span>
                    </div>
                    <div class="booking-info-row">
                        <span class="booking-info-label">Country</span>
                        <span class="booking-info-value">${booking.country || '-'}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Section Header -->
        <div class="section-header">
            <div class="section-title">${categoryIcon} ${categoryLabel} DETAILS</div>
            <div class="item-count-badge">${sortedItems.length} item${sortedItems.length !== 1 ? 's' : ''}</div>
        </div>

        <!-- Summary Row -->
        ${summaryRow}

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th class="row-num">#</th>
                    <th class="date-col">Date</th>
                    <th class="description-col">Description</th>
                    <th class="qty-col">Qty</th>
                    <th class="notes-col">Notes / Special Requirements</th>
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

        <div class="footer-note">
            This is a booking request document. Please confirm availability and details with the vendor.
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate combined booking card with multiple categories
 */
function generateCombinedBookingCardHTML(booking, categoriesData, options = {}) {
  const { includePrices = false, companyInfo = {} } = options;

  const pages = categoriesData.map(({ category, items }) => {
    return generateBookingCardHTML(booking, category, items, { includePrices, companyInfo });
  });

  // For combined output, we'll add page breaks between categories
  return pages.join('\n<div style="page-break-before: always;"></div>\n');
}

module.exports = {
  generateBookingCardHTML,
  generateCombinedBookingCardHTML,
  CATEGORY_LABELS
};
