function generatePaymentVoucherHTML(pv, companyInfo = {}) {
  // Debug logging
  console.log('Payment Voucher Data:', JSON.stringify(pv, null, 2));

  const company = {
    name: companyInfo.name || 'WIF JAPAN SDN BHD',
    address: companyInfo.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: companyInfo.tel || '+60-XXX-XXXXXXX',
    email: companyInfo.email || 'info@wifjapan.com'
  };

  // Ensure required fields have fallbacks
  const payeeName = pv.payeeName || 'Not Specified';
  const requestedBy = pv.requestedBy || 'Not Specified';
  const hasItems = pv.items && Array.isArray(pv.items) && pv.items.length > 0;

  // Helper function to format numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Payment Voucher - ${pv.documentNumber}</title>
    <style>
        @page { size: A4; margin: 0.75in; }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            line-height: 1.4;
            color: #000000;
            margin: 0;
            padding: 0;
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .document-title {
            text-align: center;
            font-size: 18pt;
            margin-bottom: 6pt;
            letter-spacing: 4pt;
        }
        .title-underline {
            width: 100%;
            height: 2pt;
            background: #000000;
            margin-bottom: 24pt;
        }
        .header-section {
            display: table;
            width: 100%;
            margin-bottom: 24pt;
        }
        .header-left, .header-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }
        .header-left { padding-right: 24pt; }
        .header-right { text-align: right; }
        .company-name {
            font-size: 14pt;
            margin-bottom: 3pt;
        }
        .company-details {
            font-size: 10pt;
            line-height: 1.3;
            white-space: pre-line;
        }
        .voucher-details {
            border: 1pt solid #000000;
            margin: 24pt 0;
            page-break-inside: avoid;
        }
        .detail-row {
            display: table;
            width: 100%;
            border-bottom: 0.5pt solid #000000;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            display: table-cell;
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 10pt;
            width: 30%;
            font-weight: bold;
        }
        .detail-value {
            display: table-cell;
            padding: 8pt 12pt;
            font-size: 10pt;
            width: 70%;
        }
        .amount-box {
            background: #e8e8e8;
            border: 2pt solid #000000;
            padding: 18pt;
            text-align: center;
            margin: 24pt 0;
            page-break-inside: avoid;
        }
        .amount-label {
            font-size: 12pt;
            margin-bottom: 8pt;
        }
        .amount-value {
            font-size: 24pt;
            font-weight: bold;
        }
        .approval-section {
            margin-top: 48pt;
            display: table;
            width: 100%;
        }
        .approval-box {
            display: table-cell;
            width: 33%;
            text-align: center;
            padding: 12pt;
        }
        .approval-label {
            font-size: 10pt;
            margin-bottom: 36pt;
            font-weight: bold;
        }
        .approval-line {
            border-top: 1pt solid #000000;
            padding-top: 6pt;
            font-size: 9pt;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 18pt 0;
            border: 1pt solid #000000;
        }
        .items-table th {
            background: #e8e8e8;
            padding: 8pt 12pt;
            text-align: left;
            font-size: 10pt;
            border-bottom: 1pt solid #000000;
        }
        .items-table td {
            padding: 8pt 12pt;
            font-size: 10pt;
            border-bottom: 0.5pt solid #cccccc;
        }
        .items-table tr:last-child td {
            border-bottom: none;
        }
        .items-table .text-right {
            text-align: right;
        }
        .totals-table {
            margin: 18pt 0 24pt auto;
            width: 300pt;
            page-break-inside: avoid;
        }
        .totals-table td {
            padding: 6pt 12pt;
            font-size: 10pt;
        }
        .totals-table .total-row {
            font-weight: bold;
            font-size: 11pt;
            border-top: 2pt solid #000000;
        }
    </style>
</head>
<body>
    <div class="document-title">PAYMENT VOUCHER</div>
    <div class="title-underline"></div>

    <div class="header-section">
        <div class="header-left">
            <div class="company-name">${company.name}</div>
            <div class="company-details">${company.address}<br>Tel: ${company.tel}<br>Email: ${company.email}</div>
        </div>
        <div class="header-right">
            <div style="margin-bottom: 6pt;">Date: ${new Date(pv.createdAt).toLocaleDateString()}</div>
            <div style="margin-bottom: 6pt;">Voucher No.: ${pv.documentNumber}</div>
            <div>Status: <strong>${pv.status.toUpperCase()}</strong></div>
        </div>
    </div>

    <div class="amount-box">
        <div class="amount-label">Payment Amount</div>
        <div class="amount-value">${pv.currency} ${formatNumber(pv.total || pv.amount)}</div>
    </div>

    <div class="voucher-details">
        <div class="detail-row">
            <div class="detail-label">Pay To:</div>
            <div class="detail-value">${payeeName}</div>
        </div>
        ${pv.payeeAddress ? `
        <div class="detail-row">
            <div class="detail-label">Payee Address:</div>
            <div class="detail-value">${pv.payeeAddress}</div>
        </div>
        ` : ''}
        ${pv.payeeBankName ? `
        <div class="detail-row">
            <div class="detail-label">Bank Name:</div>
            <div class="detail-value">${pv.payeeBankName}</div>
        </div>
        ` : ''}
        ${pv.payeeBankAccount ? `
        <div class="detail-row">
            <div class="detail-label">Bank Account:</div>
            <div class="detail-value">${pv.payeeBankAccount}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">Requested By:</div>
            <div class="detail-value">${requestedBy}</div>
        </div>
        ${pv.approvedBy ? `
        <div class="detail-row">
            <div class="detail-label">Approved By:</div>
            <div class="detail-value">${pv.approvedBy}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">Country:</div>
            <div class="detail-value">${pv.country || 'Not Specified'}</div>
        </div>
    </div>

    ${hasItems ? `
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 50%;">Description</th>
                <th class="text-right" style="width: 15%;">Qty</th>
                <th class="text-right" style="width: 17.5%;">Unit Price</th>
                <th class="text-right" style="width: 17.5%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${pv.items.map(item => `
            <tr>
                <td>${item.description}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${pv.currency} ${formatNumber(item.unitPrice)}</td>
                <td class="text-right">${pv.currency} ${formatNumber(item.amount)}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    <table class="totals-table">
        <tr>
            <td>Subtotal:</td>
            <td class="text-right">${pv.currency} ${formatNumber(pv.subtotal)}</td>
        </tr>
        ${pv.taxAmount ? `
        <tr>
            <td>Tax (${pv.taxRate}%):</td>
            <td class="text-right">${pv.currency} ${formatNumber(pv.taxAmount)}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
            <td>Total:</td>
            <td class="text-right">${pv.currency} ${formatNumber(pv.total)}</td>
        </tr>
    </table>
    ` : (pv.purpose ? `
    <div style="border: 1pt solid #000000; margin-top: 18pt;">
        <div style="background: #e8e8e8; padding: 8pt 12pt; font-size: 11pt; border-bottom: 0.5pt solid #000000;">Purpose</div>
        <div style="padding: 12pt; font-size: 10pt; white-space: pre-line;">${pv.purpose}</div>
    </div>
    ` : '')}

    ${pv.notes ? `
    <div style="border: 1pt solid #000000; margin-top: 24pt;">
        <div style="background: #e8e8e8; padding: 8pt 12pt; font-size: 11pt; border-bottom: 0.5pt solid #000000;">Notes</div>
        <div style="padding: 12pt; font-size: 10pt; white-space: pre-line;">${pv.notes}</div>
    </div>
    ` : ''}
</body>
</html>`;
}

module.exports = { generatePaymentVoucherHTML };
