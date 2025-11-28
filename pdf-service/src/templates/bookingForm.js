/**
 * Booking Form PDF Template
 *
 * Generates complete booking forms with flexible pricing display options:
 * - none: Vendor-facing (no pricing)
 * - internal: Internal cost review
 * - b2b: Partner/agent pricing
 * - both: Full internal review with profit margins
 *
 * Includes all 6 categories with line items, cost summaries, and notes.
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

const STATUS_COLORS = {
  draft: '#8C8680',
  planning: '#B8963F',
  confirmed: '#4A7A5A',
  in_progress: '#4A5A7A',
  completed: '#1A1815',
  cancelled: '#C75B4A'
};

const PRICING_DISPLAY_OPTIONS = ['none', 'internal', 'b2b', 'both'];

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

function calculateDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end
  return diffDays;
}

function getStatusBadgeColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.draft;
}

function getStatusLabel(status) {
  if (!status) return 'DRAFT';
  return status.toUpperCase().replace('_', ' ');
}

function getWatermark(pricingDisplay) {
  switch (pricingDisplay) {
    case 'internal':
      return 'INTERNAL COST - CONFIDENTIAL';
    case 'b2b':
      return 'B2B PRICING - PARTNER USE ONLY';
    case 'both':
      return 'CONFIDENTIAL - INTERNAL USE ONLY';
    default:
      return null;
  }
}

function getCategoryItems(booking, categoryKey) {
  const itemsKey = `${categoryKey}Items`;
  return booking[itemsKey] || [];
}

function getCategoryTotal(booking, categoryKey, isB2B = false) {
  const totalKey = isB2B ? `${categoryKey}B2BTotal` : `${categoryKey}Total`;
  return booking[totalKey] || 0;
}

function generateCategorySection(categoryKey, items, pricingDisplay, includeEmptyCategories) {
  // Skip empty categories if not configured to show them
  if (!includeEmptyCategories && items.length === 0) {
    return '';
  }

  const categoryLabel = CATEGORY_LABELS[categoryKey] || categoryKey.toUpperCase();
  const categoryIcon = CATEGORY_ICONS[categoryKey] || '📋';

  // Sort items by date
  const sortedItems = [...items].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  // Calculate category totals
  const internalTotal = items.reduce((sum, item) => sum + (item.internalTotal || 0), 0);
  const b2bTotal = items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0);

  // Generate table headers based on pricing option
  let tableHeaders = '';
  if (pricingDisplay === 'none') {
    tableHeaders = `
      <th class="row-num">#</th>
      <th class="date-col">Date</th>
      <th class="description-col">Description</th>
      <th class="qty-col">Qty</th>
      <th class="notes-col">Notes</th>
    `;
  } else if (pricingDisplay === 'internal') {
    tableHeaders = `
      <th class="row-num">#</th>
      <th class="date-col">Date</th>
      <th class="description-col">Description</th>
      <th class="qty-col">Qty</th>
      <th class="price-col">Internal/Unit</th>
      <th class="price-col">Internal Total</th>
      <th class="notes-col">Notes</th>
    `;
  } else if (pricingDisplay === 'b2b') {
    tableHeaders = `
      <th class="row-num">#</th>
      <th class="date-col">Date</th>
      <th class="description-col">Description</th>
      <th class="qty-col">Qty</th>
      <th class="price-col">B2B/Unit</th>
      <th class="price-col">B2B Total</th>
      <th class="notes-col">Notes</th>
    `;
  } else if (pricingDisplay === 'both') {
    tableHeaders = `
      <th class="row-num">#</th>
      <th class="date-col">Date</th>
      <th class="description-col">Description</th>
      <th class="qty-col">Qty</th>
      <th class="price-col">Internal/Unit</th>
      <th class="price-col">B2B/Unit</th>
      <th class="price-col">Internal Total</th>
      <th class="price-col">B2B Total</th>
      <th class="price-col">Profit</th>
    `;
  }

  // Generate item rows based on pricing option
  const itemsHTML = sortedItems.map((item, index) => {
    const profit = (item.b2bTotal || 0) - (item.internalTotal || 0);

    if (pricingDisplay === 'none') {
      return `
        <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="row-num">${index + 1}</td>
          <td class="date-col">${formatDateShort(item.date)}</td>
          <td class="description-col">${item.description || '-'}</td>
          <td class="qty-col">${item.quantity || 1}</td>
          <td class="notes-col">${item.notes || '-'}</td>
        </tr>
      `;
    } else if (pricingDisplay === 'internal') {
      return `
        <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="row-num">${index + 1}</td>
          <td class="date-col">${formatDateShort(item.date)}</td>
          <td class="description-col">${item.description || '-'}</td>
          <td class="qty-col">${item.quantity || 1}</td>
          <td class="price-col">¥${formatNumber(item.internalPrice || 0)}</td>
          <td class="price-col">¥${formatNumber(item.internalTotal || 0)}</td>
          <td class="notes-col">${item.notes || '-'}</td>
        </tr>
      `;
    } else if (pricingDisplay === 'b2b') {
      return `
        <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="row-num">${index + 1}</td>
          <td class="date-col">${formatDateShort(item.date)}</td>
          <td class="description-col">${item.description || '-'}</td>
          <td class="qty-col">${item.quantity || 1}</td>
          <td class="price-col">¥${formatNumber(item.b2bPrice || 0)}</td>
          <td class="price-col">¥${formatNumber(item.b2bTotal || 0)}</td>
          <td class="notes-col">${item.notes || '-'}</td>
        </tr>
      `;
    } else if (pricingDisplay === 'both') {
      return `
        <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="row-num">${index + 1}</td>
          <td class="date-col">${formatDateShort(item.date)}</td>
          <td class="description-col">${item.description || '-'}</td>
          <td class="qty-col">${item.quantity || 1}</td>
          <td class="price-col">¥${formatNumber(item.internalPrice || 0)}</td>
          <td class="price-col">¥${formatNumber(item.b2bPrice || 0)}</td>
          <td class="price-col">¥${formatNumber(item.internalTotal || 0)}</td>
          <td class="price-col">¥${formatNumber(item.b2bTotal || 0)}</td>
          <td class="price-col profit-col">¥${formatNumber(profit)}</td>
        </tr>
      `;
    }
  }).join('');

  // Generate subtotal row if pricing is shown
  let subtotalRow = '';
  if (pricingDisplay !== 'none' && items.length > 0) {
    if (pricingDisplay === 'internal') {
      subtotalRow = `
        <tr class="subtotal-row">
          <td class="row-num"></td>
          <td class="date-col"></td>
          <td class="description-col"><strong>Subtotal</strong></td>
          <td class="qty-col"></td>
          <td class="price-col"></td>
          <td class="price-col"><strong>¥${formatNumber(internalTotal)}</strong></td>
          <td class="notes-col"></td>
        </tr>
      `;
    } else if (pricingDisplay === 'b2b') {
      subtotalRow = `
        <tr class="subtotal-row">
          <td class="row-num"></td>
          <td class="date-col"></td>
          <td class="description-col"><strong>Subtotal</strong></td>
          <td class="qty-col"></td>
          <td class="price-col"></td>
          <td class="price-col"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          <td class="notes-col"></td>
        </tr>
      `;
    } else if (pricingDisplay === 'both') {
      const profit = b2bTotal - internalTotal;
      subtotalRow = `
        <tr class="subtotal-row">
          <td class="row-num"></td>
          <td class="date-col"></td>
          <td class="description-col"><strong>Subtotal</strong></td>
          <td class="qty-col"></td>
          <td class="price-col"></td>
          <td class="price-col"></td>
          <td class="price-col"><strong>¥${formatNumber(internalTotal)}</strong></td>
          <td class="price-col"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          <td class="price-col profit-col"><strong>¥${formatNumber(profit)}</strong></td>
        </tr>
      `;
    }
  }

  const emptyMessage = items.length === 0 ? `
    <tr>
      <td colspan="10" class="empty-category">No items in this category</td>
    </tr>
  ` : '';

  return `
    <div class="category-section">
      <div class="category-header">
        <div class="category-title">
          <span class="category-icon">${categoryIcon}</span>
          <span class="category-name">${categoryLabel}</span>
        </div>
        <div class="category-badge">${items.length} item${items.length !== 1 ? 's' : ''}</div>
      </div>
      <table class="category-table">
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${emptyMessage}
          ${itemsHTML}
          ${subtotalRow}
        </tbody>
      </table>
    </div>
  `;
}

function generateCostSummary(booking, pricingDisplay, showProfitMargin, showExchangeRate) {
  if (pricingDisplay === 'none') {
    return ''; // No cost summary if pricing is hidden
  }

  const categories = ['transportation', 'meals', 'entrance', 'tourGuide', 'flights', 'accommodation'];

  // Generate summary rows
  const summaryRows = categories.map(categoryKey => {
    const items = getCategoryItems(booking, categoryKey);
    const internalTotal = getCategoryTotal(booking, categoryKey, false);
    const b2bTotal = getCategoryTotal(booking, categoryKey, true);
    const profit = b2bTotal - internalTotal;
    const categoryLabel = CATEGORY_LABELS[categoryKey];

    let priceColumns = '';
    if (pricingDisplay === 'internal') {
      priceColumns = `<td class="price-col">¥${formatNumber(internalTotal)}</td>`;
    } else if (pricingDisplay === 'b2b') {
      priceColumns = `<td class="price-col">¥${formatNumber(b2bTotal)}</td>`;
    } else if (pricingDisplay === 'both') {
      priceColumns = `
        <td class="price-col">¥${formatNumber(internalTotal)}</td>
        <td class="price-col">¥${formatNumber(b2bTotal)}</td>
        <td class="price-col profit-col">¥${formatNumber(profit)}</td>
      `;
    }

    return `
      <tr>
        <td class="category-col">${categoryLabel}</td>
        <td class="items-col">${items.length}</td>
        ${priceColumns}
      </tr>
    `;
  }).join('');

  // Grand totals
  const grandTotalInternal = booking.grandTotalJpy || 0;
  const grandTotalB2B = booking.grandTotalB2BJpy || 0;
  const totalProfit = grandTotalB2B - grandTotalInternal;

  let totalPriceColumns = '';
  if (pricingDisplay === 'internal') {
    totalPriceColumns = `<td class="price-col"><strong>¥${formatNumber(grandTotalInternal)}</strong></td>`;
  } else if (pricingDisplay === 'b2b') {
    totalPriceColumns = `<td class="price-col"><strong>¥${formatNumber(grandTotalB2B)}</strong></td>`;
  } else if (pricingDisplay === 'both') {
    totalPriceColumns = `
      <td class="price-col"><strong>¥${formatNumber(grandTotalInternal)}</strong></td>
      <td class="price-col"><strong>¥${formatNumber(grandTotalB2B)}</strong></td>
      <td class="price-col profit-col"><strong>¥${formatNumber(totalProfit)}</strong></td>
    `;
  }

  const totalItems = categories.reduce((sum, cat) => sum + getCategoryItems(booking, cat).length, 0);

  // Table headers
  let summaryHeaders = '';
  if (pricingDisplay === 'internal') {
    summaryHeaders = `
      <th class="category-col">Category</th>
      <th class="items-col">Items</th>
      <th class="price-col">Internal (JPY)</th>
    `;
  } else if (pricingDisplay === 'b2b') {
    summaryHeaders = `
      <th class="category-col">Category</th>
      <th class="items-col">Items</th>
      <th class="price-col">B2B (JPY)</th>
    `;
  } else if (pricingDisplay === 'both') {
    summaryHeaders = `
      <th class="category-col">Category</th>
      <th class="items-col">Items</th>
      <th class="price-col">Internal (JPY)</th>
      <th class="price-col">B2B (JPY)</th>
      <th class="price-col">Profit (JPY)</th>
    `;
  }

  // Exchange rate row
  const exchangeRate = booking.exchangeRate || 0.031;
  const exchangeRateRow = showExchangeRate ? `
    <tr class="exchange-rate-row">
      <td colspan="${pricingDisplay === 'both' ? 5 : 3}" class="exchange-rate-cell">
        Exchange Rate: ¥1 = MYR ${exchangeRate.toFixed(4)}
      </td>
    </tr>
  ` : '';

  // MYR totals
  const grandTotalMYRInternal = booking.grandTotalMyr || (grandTotalInternal * exchangeRate);
  const grandTotalMYRB2B = booking.grandTotalB2BMyr || (grandTotalB2B * exchangeRate);
  const totalProfitMYR = grandTotalMYRB2B - grandTotalMYRInternal;

  let myrPriceColumns = '';
  if (pricingDisplay === 'internal') {
    myrPriceColumns = `<td class="price-col"><strong>RM ${formatNumber(grandTotalMYRInternal)}</strong></td>`;
  } else if (pricingDisplay === 'b2b') {
    myrPriceColumns = `<td class="price-col"><strong>RM ${formatNumber(grandTotalMYRB2B)}</strong></td>`;
  } else if (pricingDisplay === 'both') {
    myrPriceColumns = `
      <td class="price-col"><strong>RM ${formatNumber(grandTotalMYRInternal)}</strong></td>
      <td class="price-col"><strong>RM ${formatNumber(grandTotalMYRB2B)}</strong></td>
      <td class="price-col profit-col"><strong>RM ${formatNumber(totalProfitMYR)}</strong></td>
    `;
  }

  // Profit margin row (only for 'both' mode)
  const profitMarginRow = showProfitMargin && pricingDisplay === 'both' ? `
    <tr class="profit-margin-row">
      <td class="category-col"><strong>Expected Profit</strong></td>
      <td class="items-col"></td>
      <td class="price-col"></td>
      <td class="price-col"></td>
      <td class="price-col profit-col"><strong>RM ${formatNumber(totalProfitMYR)}</strong></td>
    </tr>
  ` : '';

  return `
    <div class="cost-summary-section">
      <div class="section-title">COST SUMMARY</div>
      <table class="summary-table">
        <thead>
          <tr>${summaryHeaders}</tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td class="category-col"><strong>TOTAL (JPY)</strong></td>
            <td class="items-col"><strong>${totalItems}</strong></td>
            ${totalPriceColumns}
          </tr>
          ${exchangeRateRow}
          <tr class="totals-row">
            <td class="category-col"><strong>TOTAL (MYR)</strong></td>
            <td class="items-col"></td>
            ${myrPriceColumns}
          </tr>
          ${profitMarginRow}
        </tfoot>
      </table>
    </div>
  `;
}

function generateBookingFormHTML(booking, options = {}) {
  const {
    pricingDisplay = 'none',
    includeNotes = true,
    includeEmptyCategories = false,
    showProfitMargin = false,
    showExchangeRate = true,
    companyInfo = {},
    printerInfo = {}
  } = options;

  // Validate pricing display option
  if (!PRICING_DISPLAY_OPTIONS.includes(pricingDisplay)) {
    throw new Error(`Invalid pricing display option: ${pricingDisplay}`);
  }

  const company = {
    name: companyInfo.name || 'WIF JAPAN SDN BHD',
    address: companyInfo.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: companyInfo.tel || '+60-XXX-XXXXXXX',
    email: companyInfo.email || 'info@wifjapan.com'
  };

  const statusColor = getStatusBadgeColor(booking.status);
  const statusLabel = getStatusLabel(booking.status);
  const watermarkText = getWatermark(pricingDisplay);

  const tripDuration = calculateDaysBetween(booking.tripStartDate, booking.tripEndDate);
  const tripPeriodText = booking.tripEndDate
    ? `${formatDate(booking.tripStartDate)} — ${formatDate(booking.tripEndDate)}${tripDuration ? ` (${tripDuration} days)` : ''}`
    : formatDate(booking.tripStartDate);

  // Generate category sections
  const categories = ['transportation', 'meals', 'entrance', 'tourGuide', 'flights', 'accommodation'];
  const categorySections = categories.map(categoryKey => {
    const items = getCategoryItems(booking, categoryKey);
    return generateCategorySection(categoryKey, items, pricingDisplay, includeEmptyCategories);
  }).join('');

  // Generate cost summary
  const costSummary = generateCostSummary(booking, pricingDisplay, showProfitMargin, showExchangeRate);

  // Notes section
  const notesSection = includeNotes ? `
    <div class="notes-section">
      <div class="section-title">NOTES</div>
      <div class="notes-content">
        ${booking.notes || '<em>No additional notes</em>'}
      </div>
    </div>
  ` : '';

  // Watermark
  const watermark = watermarkText ? `
    <div class="watermark">${watermarkText}</div>
  ` : '';

  // Print metadata
  const printDate = printerInfo.printDate || new Date().toISOString();
  const printUser = printerInfo.userName || 'System';
  const printTimezone = printerInfo.timezone || 'GMT+8';
  const printDateTime = new Date(printDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Vehicle info (if available)
  const vehicleInfo = booking.carTypes && booking.carTypes.length > 0 ? `
    <div class="info-row">
      <span class="info-label">Vehicles</span>
      <span class="info-value">${booking.carTypes.join(', ')}</span>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Form - ${booking.bookingCode}</title>
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
            padding: 20pt;
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
            font-size: 48pt;
            color: rgba(199, 91, 74, 0.06);
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
        }

        .document-container {
            max-width: 800pt;
            margin: 0 auto;
            background: white;
            position: relative;
            z-index: 1;
        }

        /* Header */
        .document-header {
            margin-bottom: 16pt;
            padding-bottom: 12pt;
            border-bottom: 2pt solid #1A1815;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10pt;
        }

        .document-title {
            font-size: 20pt;
            font-weight: 300;
            letter-spacing: 3pt;
            color: #1A1815;
            margin-bottom: 2pt;
        }

        .document-subtitle {
            font-size: 12pt;
            color: #6B6560;
            letter-spacing: 2pt;
        }

        .booking-ref-box {
            text-align: right;
        }

        .booking-ref-label {
            font-size: 8pt;
            color: #6B6560;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            margin-bottom: 2pt;
        }

        .booking-ref-value {
            font-size: 16pt;
            font-weight: 600;
            color: #B8963F;
            font-family: 'Courier New', monospace;
            margin-bottom: 6pt;
        }

        .status-badge {
            display: inline-block;
            padding: 4pt 10pt;
            border-radius: 4pt;
            font-size: 8pt;
            font-weight: 600;
            letter-spacing: 0.5pt;
            color: white;
        }

        .header-bottom {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-top: 10pt;
        }

        .company-info {
            font-size: 9pt;
            line-height: 1.5;
            color: #5C5650;
        }

        .company-name {
            font-size: 11pt;
            font-weight: 600;
            color: #1A1815;
            margin-bottom: 4pt;
        }

        .created-date {
            font-size: 8pt;
            color: #8C8680;
            text-align: right;
        }

        /* Trip Information */
        .trip-info-card {
            background: #FAF8F5;
            border: 1pt solid #E8E6E2;
            border-radius: 6pt;
            padding: 14pt;
            margin-bottom: 20pt;
        }

        .trip-info-title {
            font-size: 11pt;
            font-weight: 600;
            color: #1A1815;
            letter-spacing: 0.5pt;
            margin-bottom: 10pt;
            padding-bottom: 6pt;
            border-bottom: 1pt solid #E8E6E2;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6pt;
            font-size: 9pt;
        }

        .info-row:last-child {
            margin-bottom: 0;
        }

        .info-label {
            color: #6B6560;
            font-weight: 500;
        }

        .info-value {
            font-weight: 600;
            color: #1A1815;
            text-align: right;
            flex: 1;
            margin-left: 20pt;
        }

        /* Category Section */
        .category-section {
            margin-bottom: 20pt;
            page-break-inside: avoid;
        }

        .category-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8pt;
            padding-bottom: 6pt;
            border-bottom: 1pt solid #E8E6E2;
        }

        .category-title {
            display: flex;
            align-items: center;
            gap: 8pt;
        }

        .category-icon {
            font-size: 14pt;
        }

        .category-name {
            font-size: 11pt;
            font-weight: 600;
            color: #1A1815;
            letter-spacing: 0.5pt;
        }

        .category-badge {
            background: #B8963F;
            color: white;
            font-size: 8pt;
            font-weight: 600;
            padding: 3pt 8pt;
            border-radius: 10pt;
        }

        /* Tables */
        .category-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
        }

        .category-table th {
            background: #1A1815;
            color: white;
            padding: 8pt 6pt;
            font-size: 7pt;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            text-align: left;
        }

        .category-table td {
            padding: 8pt 6pt;
            border-bottom: 0.5pt solid #E8E6E2;
            vertical-align: top;
        }

        .category-table .row-even {
            background: #FFFFFF;
        }

        .category-table .row-odd {
            background: #FAFAF8;
        }

        .category-table .row-num {
            width: 5%;
            text-align: center;
            color: #8C8680;
            font-size: 8pt;
        }

        .category-table th.row-num {
            color: rgba(255,255,255,0.6);
        }

        .category-table .date-col {
            width: 10%;
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 8pt;
        }

        .category-table .description-col {
            width: 30%;
        }

        .category-table .qty-col {
            width: 8%;
            text-align: center;
        }

        .category-table .price-col {
            width: 12%;
            text-align: right;
            font-family: 'Courier New', monospace;
            font-size: 8pt;
        }

        .category-table .notes-col {
            width: 25%;
            font-size: 8pt;
            color: #5C5650;
            font-style: italic;
        }

        .category-table .profit-col {
            background: rgba(74, 122, 90, 0.05);
            color: #4A7A5A;
            font-weight: 600;
        }

        .category-table .subtotal-row {
            background: #F5F3EF;
            border-top: 1pt solid #1A1815;
        }

        .category-table .subtotal-row td {
            padding: 10pt 6pt;
            font-weight: 600;
        }

        .empty-category {
            text-align: center;
            color: #8C8680;
            font-style: italic;
            padding: 16pt !important;
        }

        /* Cost Summary */
        .cost-summary-section {
            margin-top: 24pt;
            margin-bottom: 20pt;
            page-break-inside: avoid;
        }

        .section-title {
            font-size: 12pt;
            font-weight: 600;
            color: #1A1815;
            letter-spacing: 1pt;
            margin-bottom: 10pt;
            padding-bottom: 6pt;
            border-bottom: 2pt solid #1A1815;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
        }

        .summary-table th {
            background: #1A1815;
            color: white;
            padding: 10pt 8pt;
            font-size: 8pt;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            text-align: left;
        }

        .summary-table td {
            padding: 10pt 8pt;
            border-bottom: 0.5pt solid #E8E6E2;
        }

        .summary-table .category-col {
            width: 40%;
        }

        .summary-table .items-col {
            width: 10%;
            text-align: center;
        }

        .summary-table .price-col {
            width: 15%;
            text-align: right;
            font-family: 'Courier New', monospace;
        }

        .summary-table .totals-row {
            background: #FAF8F5;
            border-top: 2pt solid #1A1815;
        }

        .summary-table .totals-row td {
            padding: 12pt 8pt;
            font-size: 10pt;
        }

        .summary-table .exchange-rate-row {
            background: #FEF6F5;
        }

        .summary-table .exchange-rate-cell {
            text-align: center;
            color: #6B6560;
            font-size: 8pt;
            font-style: italic;
            padding: 8pt !important;
        }

        .summary-table .profit-margin-row {
            background: rgba(74, 122, 90, 0.1);
        }

        /* Notes Section */
        .notes-section {
            margin-top: 20pt;
            margin-bottom: 20pt;
            border: 1pt solid #E8E6E2;
            border-radius: 6pt;
            overflow: hidden;
            page-break-inside: avoid;
        }

        .notes-content {
            padding: 14pt;
            min-height: 50pt;
            font-size: 9pt;
            line-height: 1.6;
            color: #5C5650;
            white-space: pre-wrap;
        }

        /* Footer */
        .document-footer {
            margin-top: 20pt;
            padding-top: 12pt;
            border-top: 1pt solid #E8E6E2;
            text-align: center;
            font-size: 8pt;
            color: #8C8680;
        }

        .print-metadata {
            display: flex;
            justify-content: center;
            gap: 20pt;
            margin-bottom: 6pt;
        }

        .print-info {
            font-style: italic;
        }

        /* Print specific */
        @media print {
            body {
                padding: 0;
            }

            .document-container {
                max-width: 100%;
            }

            .category-section {
                page-break-inside: avoid;
            }

            .cost-summary-section {
                page-break-inside: avoid;
            }

            .notes-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    ${watermark}
    <div class="document-container">
        <!-- Header -->
        <div class="document-header">
            <div class="header-top">
                <div>
                    <div class="document-title">BOOKING FORM</div>
                    <div class="document-subtitle">予約フォーム</div>
                </div>
                <div class="booking-ref-box">
                    <div class="booking-ref-label">Booking Reference</div>
                    <div class="booking-ref-value">${booking.bookingCode || 'N/A'}</div>
                    <span class="status-badge" style="background-color: ${statusColor};">● ${statusLabel}</span>
                </div>
            </div>
            <div class="header-bottom">
                <div class="company-info">
                    <div class="company-name">${company.name}</div>
                    <div>${company.address.replace(/\n/g, '<br>')}</div>
                    <div>Tel: ${company.tel} | Email: ${company.email}</div>
                </div>
                <div class="created-date">
                    Created: ${formatDate(booking.createdAt || new Date().toISOString())}
                </div>
            </div>
        </div>

        <!-- Trip Information -->
        <div class="trip-info-card">
            <div class="trip-info-title">TRIP INFORMATION</div>
            <div class="info-row">
                <span class="info-label">Guest Name</span>
                <span class="info-value">${booking.guestName || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Trip Period</span>
                <span class="info-value">${tripPeriodText}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Number of Pax</span>
                <span class="info-value">${booking.numberOfPax || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Country</span>
                <span class="info-value">${booking.country || '-'}</span>
            </div>
            ${vehicleInfo}
        </div>

        <!-- Category Sections -->
        ${categorySections}

        <!-- Cost Summary -->
        ${costSummary}

        <!-- Notes -->
        ${notesSection}

        <!-- Footer -->
        <div class="document-footer">
            <div class="print-metadata">
                <span class="print-info">Printed by: ${printUser}</span>
                <span class="print-info">${printDateTime} (${printTimezone})</span>
            </div>
            <div>This is an official booking document from ${company.name}</div>
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
  generateBookingFormHTML,
  PRICING_DISPLAY_OPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ICONS
};
