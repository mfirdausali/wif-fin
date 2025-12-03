function generateStatementOfPaymentHTML(sop, companyInfo = {}) {
  // Debug logging
  console.log('=== Statement of Payment PDF Generation ===');
  console.log('Full SOP object:', JSON.stringify(sop, null, 2));
  console.log('linkedVoucherId:', sop.linkedVoucherId);
  console.log('linkedVoucherNumber:', sop.linkedVoucherNumber);
  console.log('Document Number:', sop.documentNumber);
  console.log('Items:', sop.items);
  console.log('Transfer Proof Base64 exists:', !!sop.transferProofBase64);
  console.log('Transfer Proof Base64 length:', sop.transferProofBase64 ? sop.transferProofBase64.length : 0);
  console.log('Transfer Proof Filename:', sop.transferProofFilename);

  const company = {
    name: companyInfo.name || 'WIF JAPAN SDN BHD',
    address: companyInfo.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: companyInfo.tel || '+60-XXX-XXXXXXX',
    email: companyInfo.email || 'info@wifjapan.com'
  };

  // Determine the correct linked voucher number to display
  let displayVoucherNumber = sop.linkedVoucherNumber || sop.linkedVoucherId || 'N/A';

  // If it's still an internal ID (starts with DOC-), try to extract or show as N/A
  if (displayVoucherNumber.startsWith('DOC-')) {
    console.warn('⚠️ linkedVoucherNumber is internal ID format, should be payment voucher number!');
    // For now, keep it but mark it as needing fix
    displayVoucherNumber = sop.linkedVoucherId;
  }

  // Check if SOP has items to display
  const hasItems = sop.items && Array.isArray(sop.items) && sop.items.length > 0;

  // Helper function to format numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Statement of Payment - ${sop.documentNumber}</title>
    <style>
        @page {
            size: A4;
            margin: 0.75in 0.75in 1.5in 0.75in; /* Extra bottom margin for footer */
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            line-height: 1.4;
            color: #000000;
            margin: 0;
            padding: 0 0 100pt 0; /* Bottom padding to prevent overlap with footer */
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            position: relative;
            min-height: 100vh;
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
        .statement-details {
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
            width: 35%;
            font-weight: bold;
        }
        .detail-value {
            display: table-cell;
            padding: 8pt 12pt;
            font-size: 10pt;
            width: 65%;
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
        .confirmation-box {
            background: #f0fdf4;
            border: 2pt solid #059669;
            padding: 18pt;
            margin: 24pt 0;
            text-align: center;
            page-break-inside: avoid;
        }
        .confirmation-title {
            font-size: 14pt;
            font-weight: bold;
            color: #059669;
            margin-bottom: 12pt;
        }
        .confirmation-text {
            font-size: 10pt;
            line-height: 1.6;
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
        .footer {
            position: fixed;
            bottom: 0;
            left: 0.75in;
            right: 0.75in;
            padding: 12pt 0;
            border-top: 1pt solid #000000;
            font-size: 8pt;
            text-align: center;
            color: #666666;
            background: white;
        }
        .transfer-proof-container {
            page-break-inside: avoid;
            max-height: 350pt;
            overflow: hidden;
        }
        .transfer-proof-image {
            max-width: 100%;
            max-height: 330pt;
            object-fit: contain;
            border: 1pt solid #d1d5db;
        }
        .items-section {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    <div class="document-title">STATEMENT OF PAYMENT</div>
    <div class="title-underline"></div>

    <div class="header-section">
        <div class="header-left">
            <div class="company-name">${company.name}</div>
            <div class="company-details">${company.address}<br>Tel: ${company.tel}<br>Email: ${company.email}</div>
        </div>
        <div class="header-right">
            <div style="margin-bottom: 6pt;">Date: ${new Date(sop.createdAt).toLocaleDateString()}</div>
            <div style="margin-bottom: 6pt;">Statement No.: ${sop.documentNumber}</div>
            <div>Status: <strong style="color: #059669;">${sop.status.toUpperCase()}</strong></div>
        </div>
    </div>

    <div class="amount-box">
        <div class="amount-label">Payment Amount</div>
        <div class="amount-value">${sop.currency} ${formatNumber(sop.amount)}</div>
    </div>

    <div class="confirmation-box">
        <div class="confirmation-title">✓ PAYMENT CONFIRMED</div>
        <div class="confirmation-text">
            This statement certifies that the payment has been successfully processed and completed.
        </div>
    </div>

    <div class="statement-details">
        <div class="detail-row">
            <div class="detail-label">Linked Payment Voucher:</div>
            <div class="detail-value">${displayVoucherNumber}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Transaction Reference:</div>
            <div class="detail-value">${sop.transactionReference || 'N/A'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Payment Method:</div>
            <div class="detail-value">${sop.paymentMethod || 'Bank Transfer'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Country:</div>
            <div class="detail-value">${sop.country}</div>
        </div>
        ${sop.accountName ? `
        <div class="detail-row">
            <div class="detail-label">Paid from Account:</div>
            <div class="detail-value">${sop.accountName}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">Payment Date:</div>
            <div class="detail-value">${new Date(sop.createdAt).toLocaleDateString()}</div>
        </div>
    </div>

    ${hasItems ? `
    <div class="items-section" style="border: 1pt solid #000000; margin-top: 24pt;">
        <div style="background: #e8e8e8; padding: 8pt 12pt; font-size: 11pt; border-bottom: 0.5pt solid #000000;">Payment Items</div>
        <table class="items-table" style="border: none; margin: 0;">
            <thead>
                <tr>
                    <th style="width: 50%;">Description</th>
                    <th class="text-right" style="width: 15%;">Qty</th>
                    <th class="text-right" style="width: 17.5%;">Unit Price</th>
                    <th class="text-right" style="width: 17.5%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${sop.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${sop.currency} ${formatNumber(item.unitPrice)}</td>
                    <td class="text-right">${sop.currency} ${formatNumber(item.amount)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <table class="totals-table">
            <tr>
                <td>Subtotal:</td>
                <td class="text-right">${sop.currency} ${formatNumber(sop.subtotal)}</td>
            </tr>
            ${sop.taxAmount ? `
            <tr>
                <td>Tax (${sop.taxRate}%):</td>
                <td class="text-right">${sop.currency} ${formatNumber(sop.taxAmount)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
                <td>Total:</td>
                <td class="text-right">${sop.currency} ${formatNumber(sop.total)}</td>
            </tr>
        </table>
    </div>
    ` : ''}

    ${sop.transactionFee && sop.transactionFee > 0 ? `
    <div style="border: 1pt solid #000000; margin-top: 24pt; background: #fffbeb;">
        <div style="background: #fbbf24; padding: 8pt 12pt; font-size: 11pt; border-bottom: 0.5pt solid #000000; color: #000000;">Transaction Fees</div>
        <table class="totals-table" style="width: 100%; margin: 12pt 0;">
            <tr>
                <td style="padding-left: 24pt;">Voucher Amount:</td>
                <td class="text-right" style="padding-right: 24pt;">${sop.currency} ${formatNumber(sop.total)}</td>
            </tr>
            <tr>
                <td style="padding-left: 24pt;">Transaction Fee${sop.transactionFeeType ? ` (${sop.transactionFeeType})` : ''}:</td>
                <td class="text-right" style="padding-right: 24pt;">${sop.currency} ${formatNumber(sop.transactionFee)}</td>
            </tr>
            <tr class="total-row">
                <td style="padding-left: 24pt;">Total Deducted from Account:</td>
                <td class="text-right" style="padding-right: 24pt;">${sop.currency} ${formatNumber(sop.totalDeducted)}</td>
            </tr>
        </table>
    </div>
    ` : ''}

    ${sop.transferProofBase64 ? `
    <div style="border: 1pt solid #000000; margin-top: 24pt; page-break-inside: avoid;">
        <div style="background: #e8e8e8; padding: 8pt 12pt; font-size: 11pt; border-bottom: 0.5pt solid #000000;">Transfer Proof</div>
        <div class="transfer-proof-container" style="padding: 12pt; text-align: center;">
            <img src="${sop.transferProofBase64}" class="transfer-proof-image" alt="Transfer Proof" />
            ${sop.transferProofFilename ? `<div style="margin-top: 6pt; font-size: 9pt; color: #6b7280;">File: ${sop.transferProofFilename}</div>` : ''}
        </div>
    </div>
    ` : ''}

    ${sop.notes ? `
    <div style="border: 1pt solid #000000; margin-top: 24pt;">
        <div style="background: #e8e8e8; padding: 8pt 12pt; font-size: 11pt; border-bottom: 0.5pt solid #000000;">Additional Notes</div>
        <div style="padding: 12pt; font-size: 10pt; white-space: pre-line;">${sop.notes}</div>
    </div>
    ` : ''}
</body>
</html>`;
}

module.exports = { generateStatementOfPaymentHTML };
