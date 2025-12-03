/**
 * Booking Form PDF Template
 *
 * Generates complete booking forms with flexible pricing display options:
 * - none: Vendor-facing (no pricing)
 * - internal: Internal cost review
 * - b2b: Partner/agent pricing
 * - both: Full internal review with profit margins
 *
 * Design aligned with invoice template (classic, professional style).
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

const STATUS_LABELS = {
  draft: 'DRAFT',
  planning: 'PLANNING',
  confirmed: 'CONFIRMED',
  in_progress: 'IN PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED'
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

function formatNumberDecimal(num) {
  if (num === null || num === undefined) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calculateDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || 'DRAFT';
}

function getWatermarkText(pricingDisplay) {
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
  let colCount = 5;

  if (pricingDisplay === 'none') {
    tableHeaders = `
      <th style="width: 5%">#</th>
      <th style="width: 12%">Date</th>
      <th style="width: 43%">Description</th>
      <th style="width: 10%">Qty</th>
      <th style="width: 30%">Notes</th>
    `;
    colCount = 5;
  } else if (pricingDisplay === 'internal') {
    tableHeaders = `
      <th style="width: 5%">#</th>
      <th style="width: 10%">Date</th>
      <th style="width: 33%">Description</th>
      <th style="width: 8%">Qty</th>
      <th style="width: 12%">Unit Price</th>
      <th style="width: 12%">Total</th>
      <th style="width: 20%">Notes</th>
    `;
    colCount = 7;
  } else if (pricingDisplay === 'b2b') {
    tableHeaders = `
      <th style="width: 5%">#</th>
      <th style="width: 10%">Date</th>
      <th style="width: 33%">Description</th>
      <th style="width: 8%">Qty</th>
      <th style="width: 12%">Unit Price</th>
      <th style="width: 12%">Total</th>
      <th style="width: 20%">Notes</th>
    `;
    colCount = 7;
  } else if (pricingDisplay === 'both') {
    tableHeaders = `
      <th style="width: 4%">#</th>
      <th style="width: 9%">Date</th>
      <th style="width: 27%">Description</th>
      <th style="width: 6%">Qty</th>
      <th style="width: 11%">Internal</th>
      <th style="width: 11%">B2B</th>
      <th style="width: 11%">Int. Total</th>
      <th style="width: 11%">B2B Total</th>
      <th style="width: 10%">Profit</th>
    `;
    colCount = 9;
  }

  // Generate item rows
  const itemsHTML = sortedItems.map((item, index) => {
    const profit = (item.b2bTotal || 0) - (item.internalTotal || 0);

    if (pricingDisplay === 'none') {
      return `
        <tr>
          <td style="text-align: center">${index + 1}</td>
          <td style="text-align: center">${formatDateShort(item.date)}</td>
          <td>${item.description || '-'}</td>
          <td style="text-align: center">${item.quantity || 1}</td>
          <td style="font-size: 8pt; color: #666">${item.notes || '-'}</td>
        </tr>
      `;
    } else if (pricingDisplay === 'internal') {
      return `
        <tr>
          <td style="text-align: center">${index + 1}</td>
          <td style="text-align: center">${formatDateShort(item.date)}</td>
          <td>${item.description || '-'}</td>
          <td style="text-align: center">${item.quantity || 1}</td>
          <td style="text-align: right">¥${formatNumber(item.internalPrice || 0)}</td>
          <td style="text-align: right">¥${formatNumber(item.internalTotal || 0)}</td>
          <td style="font-size: 8pt; color: #666">${item.notes || '-'}</td>
        </tr>
      `;
    } else if (pricingDisplay === 'b2b') {
      return `
        <tr>
          <td style="text-align: center">${index + 1}</td>
          <td style="text-align: center">${formatDateShort(item.date)}</td>
          <td>${item.description || '-'}</td>
          <td style="text-align: center">${item.quantity || 1}</td>
          <td style="text-align: right">¥${formatNumber(item.b2bPrice || 0)}</td>
          <td style="text-align: right">¥${formatNumber(item.b2bTotal || 0)}</td>
          <td style="font-size: 8pt; color: #666">${item.notes || '-'}</td>
        </tr>
      `;
    } else if (pricingDisplay === 'both') {
      return `
        <tr>
          <td style="text-align: center">${index + 1}</td>
          <td style="text-align: center">${formatDateShort(item.date)}</td>
          <td>${item.description || '-'}</td>
          <td style="text-align: center">${item.quantity || 1}</td>
          <td style="text-align: right">¥${formatNumber(item.internalPrice || 0)}</td>
          <td style="text-align: right">¥${formatNumber(item.b2bPrice || 0)}</td>
          <td style="text-align: right">¥${formatNumber(item.internalTotal || 0)}</td>
          <td style="text-align: right">¥${formatNumber(item.b2bTotal || 0)}</td>
          <td style="text-align: right; color: #065f46; font-weight: bold">¥${formatNumber(profit)}</td>
        </tr>
      `;
    }
  }).join('');

  // Generate subtotal row
  let subtotalRow = '';
  if (pricingDisplay !== 'none' && items.length > 0) {
    if (pricingDisplay === 'internal') {
      subtotalRow = `
        <tr class="subtotal-row">
          <td colspan="5" style="text-align: right"><strong>Subtotal</strong></td>
          <td style="text-align: right"><strong>¥${formatNumber(internalTotal)}</strong></td>
          <td></td>
        </tr>
      `;
    } else if (pricingDisplay === 'b2b') {
      subtotalRow = `
        <tr class="subtotal-row">
          <td colspan="5" style="text-align: right"><strong>Subtotal</strong></td>
          <td style="text-align: right"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          <td></td>
        </tr>
      `;
    } else if (pricingDisplay === 'both') {
      const profit = b2bTotal - internalTotal;
      subtotalRow = `
        <tr class="subtotal-row">
          <td colspan="6" style="text-align: right"><strong>Subtotal</strong></td>
          <td style="text-align: right"><strong>¥${formatNumber(internalTotal)}</strong></td>
          <td style="text-align: right"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          <td style="text-align: right; color: #065f46"><strong>¥${formatNumber(profit)}</strong></td>
        </tr>
      `;
    }
  }

  const emptyMessage = items.length === 0 ? `
    <tr>
      <td colspan="${colCount}" style="text-align: center; color: #999; font-style: italic; padding: 16pt">
        No items in this category
      </td>
    </tr>
  ` : '';

  return `
    <div class="category-section">
      <div class="category-header">
        <span class="category-name">${categoryLabel}</span>
        <span class="category-count">${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>
      <table class="items-table">
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
    return '';
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
      priceColumns = `<td style="text-align: right">¥${formatNumber(internalTotal)}</td>`;
    } else if (pricingDisplay === 'b2b') {
      priceColumns = `<td style="text-align: right">¥${formatNumber(b2bTotal)}</td>`;
    } else if (pricingDisplay === 'both') {
      priceColumns = `
        <td style="text-align: right">¥${formatNumber(internalTotal)}</td>
        <td style="text-align: right">¥${formatNumber(b2bTotal)}</td>
        <td style="text-align: right; color: #065f46">¥${formatNumber(profit)}</td>
      `;
    }

    return `
      <tr>
        <td>${categoryLabel}</td>
        <td style="text-align: center">${items.length}</td>
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
    totalPriceColumns = `<td style="text-align: right"><strong>¥${formatNumber(grandTotalInternal)}</strong></td>`;
  } else if (pricingDisplay === 'b2b') {
    totalPriceColumns = `<td style="text-align: right"><strong>¥${formatNumber(grandTotalB2B)}</strong></td>`;
  } else if (pricingDisplay === 'both') {
    totalPriceColumns = `
      <td style="text-align: right"><strong>¥${formatNumber(grandTotalInternal)}</strong></td>
      <td style="text-align: right"><strong>¥${formatNumber(grandTotalB2B)}</strong></td>
      <td style="text-align: right; color: #065f46"><strong>¥${formatNumber(totalProfit)}</strong></td>
    `;
  }

  const totalItems = categories.reduce((sum, cat) => sum + getCategoryItems(booking, cat).length, 0);

  // Table headers
  let summaryHeaders = '';
  if (pricingDisplay === 'internal') {
    summaryHeaders = `
      <th style="width: 50%">Category</th>
      <th style="width: 15%; text-align: center">Items</th>
      <th style="width: 35%; text-align: right">Internal (JPY)</th>
    `;
  } else if (pricingDisplay === 'b2b') {
    summaryHeaders = `
      <th style="width: 50%">Category</th>
      <th style="width: 15%; text-align: center">Items</th>
      <th style="width: 35%; text-align: right">B2B (JPY)</th>
    `;
  } else if (pricingDisplay === 'both') {
    summaryHeaders = `
      <th style="width: 35%">Category</th>
      <th style="width: 10%; text-align: center">Items</th>
      <th style="width: 18%; text-align: right">Internal (JPY)</th>
      <th style="width: 18%; text-align: right">B2B (JPY)</th>
      <th style="width: 19%; text-align: right">Profit (JPY)</th>
    `;
  }

  // Exchange rate
  const exchangeRate = booking.exchangeRate || 0.031;
  const exchangeRateRow = showExchangeRate ? `
    <tr class="exchange-rate-row">
      <td colspan="${pricingDisplay === 'both' ? 5 : 3}" style="text-align: center; font-style: italic; color: #666; font-size: 8pt">
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
    myrPriceColumns = `<td style="text-align: right"><strong>RM ${formatNumberDecimal(grandTotalMYRInternal)}</strong></td>`;
  } else if (pricingDisplay === 'b2b') {
    myrPriceColumns = `<td style="text-align: right"><strong>RM ${formatNumberDecimal(grandTotalMYRB2B)}</strong></td>`;
  } else if (pricingDisplay === 'both') {
    myrPriceColumns = `
      <td style="text-align: right"><strong>RM ${formatNumberDecimal(grandTotalMYRInternal)}</strong></td>
      <td style="text-align: right"><strong>RM ${formatNumberDecimal(grandTotalMYRB2B)}</strong></td>
      <td style="text-align: right; color: #065f46"><strong>RM ${formatNumberDecimal(totalProfitMYR)}</strong></td>
    `;
  }

  // Profit margin row
  const profitMarginRow = showProfitMargin && pricingDisplay === 'both' ? `
    <tr class="profit-margin-row">
      <td colspan="2"><strong>Expected Profit</strong></td>
      <td></td>
      <td></td>
      <td style="text-align: right; background: #d1fae5; color: #065f46"><strong>RM ${formatNumberDecimal(totalProfitMYR)}</strong></td>
    </tr>
  ` : '';

  return `
    <div class="summary-section">
      <div class="section-header">COST SUMMARY</div>
      <table class="summary-table">
        <thead>
          <tr>${summaryHeaders}</tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td><strong>TOTAL (JPY)</strong></td>
            <td style="text-align: center"><strong>${totalItems}</strong></td>
            ${totalPriceColumns}
          </tr>
          ${exchangeRateRow}
          <tr class="totals-row">
            <td><strong>TOTAL (MYR)</strong></td>
            <td></td>
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

  // Company info - sourced from Supabase via companyInfo parameter
  // No hardcoded defaults here - defaults are in supabaseClient.js
  const company = {
    name: companyInfo.name || 'Company Name',
    address: companyInfo.address || '',
    tel: companyInfo.tel || '',
    email: companyInfo.email || '',
    registrationNo: companyInfo.registrationNo || '',
    registeredOffice: companyInfo.registeredOffice || ''
  };

  const statusLabel = getStatusLabel(booking.status);
  const watermarkText = getWatermarkText(pricingDisplay);

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
      <div class="notes-header">Notes</div>
      <div class="notes-content">${booking.notes || '<em style="color: #999">No additional notes</em>'}</div>
    </div>
  ` : '';

  // Watermark for confidential documents
  const watermark = watermarkText ? `
    <div class="watermark">${watermarkText}</div>
  ` : '';

  // Print metadata - sourced from printerInfo parameter
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

  // Vehicle info
  const vehicleInfo = booking.carTypes && booking.carTypes.length > 0
    ? booking.carTypes.join(', ')
    : '-';

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

        .date-info {
            margin-bottom: 12pt;
        }

        .date-info div {
            margin-bottom: 3pt;
            font-size: 10pt;
        }

        .booking-ref {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 6pt;
        }

        .status-badge {
            display: inline-block;
            padding: 4pt 8pt;
            border-radius: 4pt;
            font-size: 9pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1pt;
            background: #e8e8e8;
            color: #333;
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

        /* Category sections */
        .category-section {
            margin-bottom: 16pt;
            page-break-inside: avoid;
        }

        .category-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            border: 1pt solid #000;
            border-bottom: none;
            display: flex;
            align-items: center;
            gap: 8pt;
        }

        .category-icon {
            font-size: 12pt;
        }

        .category-name {
            font-size: 11pt;
            font-weight: bold;
            flex: 1;
        }

        .category-count {
            font-size: 9pt;
            color: #666;
        }

        /* Tables - Invoice style */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            border: 1pt solid #000000;
        }

        .items-table thead {
            display: table-header-group;
        }

        .items-table th {
            background: #e8e8e8;
            padding: 6pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            font-weight: normal;
            text-align: center;
        }

        .items-table td {
            padding: 6pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            line-height: 1.3;
        }

        .items-table .subtotal-row {
            background: #f5f5f5;
        }

        .items-table .subtotal-row td {
            border-top: 1pt solid #000;
        }

        /* Summary section */
        .summary-section {
            margin-top: 20pt;
            margin-bottom: 16pt;
            page-break-inside: avoid;
        }

        .section-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            font-weight: bold;
            border: 1pt solid #000;
            border-bottom: none;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            border: 1pt solid #000000;
        }

        .summary-table th {
            background: #e8e8e8;
            padding: 8pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            font-weight: normal;
        }

        .summary-table td {
            padding: 8pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
        }

        .summary-table .totals-row {
            background: #f5f5f5;
        }

        .summary-table .totals-row td {
            border-top: 1pt solid #000;
        }

        .summary-table .exchange-rate-row td {
            background: #fafafa;
            border-top: none;
            padding: 4pt 8pt;
        }

        .summary-table .profit-margin-row td {
            background: #d1fae5;
        }

        /* Notes section - Invoice style */
        .notes-section {
            margin-top: 20pt;
            border: 1pt solid #000000;
            page-break-inside: avoid;
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
            white-space: pre-wrap;
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

            .category-section {
                page-break-inside: avoid;
            }

            .summary-section {
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
        <div class="document-title">BOOKING FORM</div>
        <div class="title-underline"></div>

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
                <div class="date-info">
                    <div class="booking-ref">${booking.bookingCode || 'N/A'}</div>
                    <div>Issue Date: ${formatDate(booking.createdAt || new Date().toISOString())}</div>
                    <div style="margin-top: 6pt">
                        <span class="status-badge">${statusLabel}</span>
                    </div>
                </div>
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
                    <div class="trip-info-value">${tripPeriodText}</div>
                </div>
                <div class="trip-info-row">
                    <div class="trip-info-label">Number of Pax</div>
                    <div class="trip-info-value">${booking.numberOfPax || '-'}</div>
                </div>
                <div class="trip-info-row">
                    <div class="trip-info-label">Country</div>
                    <div class="trip-info-value">${booking.country || '-'}</div>
                </div>
                <div class="trip-info-row">
                    <div class="trip-info-label">Vehicles</div>
                    <div class="trip-info-value">${vehicleInfo}</div>
                </div>
            </div>
        </div>

        <!-- Category Sections -->
        ${categorySections}

        <!-- Cost Summary -->
        ${costSummary}

        <!-- Notes -->
        ${notesSection}

        <!-- Footer is handled by Puppeteer page footer in index.js -->
        <!-- This ensures consistent footer on every page with page numbers -->
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
