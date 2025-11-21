function generateInvoiceHTML(invoice, companyInfo = {}) {
  // Helper function to format numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const company = {
    name: companyInfo.name || 'WIF JAPAN SDN BHD',
    address: companyInfo.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: companyInfo.tel || '+60-XXX-XXXXXXX',
    email: companyInfo.email || 'info@wifjapan.com'
  };

  // Ensure items exists and is an array (matching TypeScript interface)
  const lineItems = Array.isArray(invoice.items) ? invoice.items : [];

  // Calculate subtotal from line items or use provided subtotal
  const subtotal = invoice.subtotal || lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Calculate tax amount
  const taxAmount = invoice.taxAmount !== undefined ? invoice.taxAmount : (subtotal * (invoice.taxRate || 0)) / 100;

  // Use provided total or calculate it
  const total = invoice.total !== undefined ? invoice.total : (subtotal + taxAmount);

  // Only add empty rows if there are few items (to maintain minimum table height)
  const emptyRows = lineItems.length < 5 ? Math.max(0, 5 - lineItems.length) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - ${invoice.documentNumber}</title>
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
        }

        .document-container {
            width: 100%;
            margin: 0;
            background: white;
        }

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
            margin-bottom: 18pt;
        }

        .company-name {
            font-size: 14pt;
            font-weight: normal;
            margin-bottom: 3pt;
        }

        .company-details {
            font-size: 10pt;
            line-height: 1.3;
            white-space: pre-line;
        }

        .date-info {
            margin-bottom: 18pt;
        }

        .date-info div {
            margin-bottom: 3pt;
        }

        .status-badge {
            display: inline-block;
            padding: 4pt 8pt;
            border-radius: 4pt;
            font-size: 9pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1pt;
        }

        .status-paid {
            background: #d1fae5;
            color: #065f46;
        }

        .status-issued {
            background: #fef3c7;
            color: #92400e;
        }

        .amount-section {
            display: table;
            width: 100%;
            margin-bottom: 12pt;
        }

        .total-amount-box {
            display: table-cell;
            width: 50%;
            background: #e8e8e8;
            border: 1pt solid #000000;
            padding: 8pt;
            text-align: center;
            vertical-align: middle;
        }

        .amount-label {
            font-size: 10pt;
            margin-bottom: 4pt;
        }

        .amount-value {
            font-size: 16pt;
            font-weight: bold;
        }

        .payment-terms-box {
            display: table-cell;
            width: 50%;
            border: 1pt solid #000000;
            padding: 0;
        }

        .payment-terms-box table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .payment-terms-box td {
            padding: 8pt 12pt;
            border-bottom: 0.5pt solid #000000;
            font-size: 10pt;
            width: 50%;
        }

        .payment-terms-box td:first-child {
            background: #e8e8e8;
            font-weight: normal;
        }

        .payment-terms-box tr:last-child td {
            border-bottom: none;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
            border: 1pt solid #000000;
        }

        .items-table thead {
            display: table-header-group;
        }

        .items-table th {
            background: #e8e8e8;
            padding: 8pt 6pt;
            border: 0.5pt solid #000000;
            font-size: 10pt;
            font-weight: normal;
            text-align: center;
        }

        .items-table td {
            padding: 6pt 6pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            text-align: center;
            line-height: 1.3;
        }

        .items-table .description-col {
            text-align: left;
            width: 50%;
        }

        .totals-section {
            border-left: 1pt solid #000000;
            border-right: 1pt solid #000000;
            border-bottom: 1pt solid #000000;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .totals-section table {
            width: 100%;
            border-collapse: collapse;
        }

        .totals-section td {
            padding: 6pt 10pt;
            border-top: 0.5pt solid #000000;
            font-size: 9pt;
            text-align: right;
        }

        .totals-section td:first-child {
            background: #e8e8e8;
            text-align: center;
            width: 15%;
        }

        .totals-section .final-total {
            background: #e8e8e8;
            font-weight: bold;
            font-size: 11pt;
        }

        .notes-section {
            margin-top: 24pt;
            border: 1pt solid #000000;
            min-height: 60pt;
        }

        .notes-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            border-bottom: 0.5pt solid #000000;
        }

        .notes-content {
            padding: 12pt;
            min-height: 48pt;
            font-size: 10pt;
            line-height: 1.4;
            white-space: pre-line;
        }
    </style>
</head>
<body>
    <div class="document-container">
        <div class="document-title">INVOICE</div>
        <div class="title-underline"></div>

        <div class="header-section">
            <div class="header-left">
                <div class="company-info">
                    <div class="company-name">${company.name}</div>
                    <div class="company-details">${company.address}<br>Tel: ${company.tel}<br>Email: ${company.email}</div>
                </div>

                <div>
                    <strong>Bill To:</strong><br>
                    <strong>${invoice.customerName}</strong><br>
                    ${invoice.customerAddress ? `<div style="white-space: pre-line">${invoice.customerAddress}</div>` : ''}
                </div>
            </div>

            <div class="header-right">
                <div class="date-info">
                    <div>Issue Date: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
                    <div>Invoice No.: ${invoice.documentNumber}</div>
                    <div>Status: <span class="status-badge status-${invoice.status}">${invoice.status}</span></div>
                </div>
            </div>
        </div>

        <div class="amount-section">
            <div class="total-amount-box">
                <div class="amount-label">Invoice Amount</div>
                <div class="amount-value">${invoice.currency} ${formatNumber(total)}</div>
            </div>
            <div class="payment-terms-box">
                <table>
                    <tr>
                        <td>Payment Terms</td>
                        <td>${invoice.paymentTerms || 'Net 30 Days'}</td>
                    </tr>
                    <tr>
                        <td>Country</td>
                        <td>${invoice.country}</td>
                    </tr>
                </table>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th class="description-col">Description</th>
                    <th style="width: 15%">Qty</th>
                    <th style="width: 17.5%">Unit Price</th>
                    <th style="width: 17.5%">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${lineItems.map(item => `
                <tr>
                    <td class="description-col">${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${invoice.currency} ${formatNumber(item.unitPrice)}</td>
                    <td>${invoice.currency} ${formatNumber(item.amount)}</td>
                </tr>
                `).join('')}
                ${Array.from({ length: emptyRows }).map(() => `
                <tr style="height: 24pt">
                    <td class="description-col">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals-section">
            <table>
                <tr>
                    <td>Subtotal</td>
                    <td>${invoice.currency} ${formatNumber(subtotal)}</td>
                </tr>
                <tr>
                    <td>Tax (${invoice.taxRate || 0}%)</td>
                    <td>${invoice.currency} ${formatNumber(taxAmount)}</td>
                </tr>
                <tr class="final-total">
                    <td>Total Amount</td>
                    <td>${invoice.currency} ${formatNumber(total)}</td>
                </tr>
            </table>
        </div>

        ${invoice.notes ? `
        <div class="notes-section">
            <div class="notes-header">Notes</div>
            <div class="notes-content">${invoice.notes}</div>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
}

module.exports = { generateInvoiceHTML };
