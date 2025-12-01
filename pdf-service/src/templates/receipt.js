function generateReceiptHTML(receipt, companyInfo = {}) {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Receipt - ${receipt.documentNumber}</title>
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
        .receipt-box {
            border: 2pt solid #000000;
            padding: 24pt;
            margin: 24pt 0;
            background: #f9fafb;
            page-break-inside: avoid;
        }
        .receipt-row {
            display: flex;
            justify-content: space-between;
            padding: 8pt 0;
            border-bottom: 1pt solid #d1d5db;
        }
        .receipt-row:last-child {
            border-bottom: none;
        }
        .receipt-label {
            font-weight: bold;
            width: 40%;
        }
        .receipt-value {
            text-align: right;
            width: 60%;
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
        .notes-section {
            margin-top: 24pt;
            border: 1pt solid #000000;
        }
        .notes-header {
            background: #e8e8e8;
            padding: 8pt 12pt;
            font-size: 11pt;
            border-bottom: 0.5pt solid #000000;
        }
        .notes-content {
            padding: 12pt;
            font-size: 10pt;
            white-space: pre-line;
        }
    </style>
</head>
<body>
    <div class="document-title">RECEIPT</div>
    <div class="title-underline"></div>

    <div class="header-section">
        <div class="header-left">
            <div class="company-name">${company.name}</div>
            <div class="company-details">${company.address}<br>Tel: ${company.tel}<br>Email: ${company.email}</div>
        </div>
        <div class="header-right">
            <div style="margin-bottom: 6pt;">Date: ${new Date(receipt.createdAt).toLocaleDateString()}</div>
            <div style="margin-bottom: 6pt;">Receipt No.: ${receipt.documentNumber}</div>
            <div>Status: <strong>${receipt.status.toUpperCase()}</strong></div>
        </div>
    </div>

    <div class="amount-box">
        <div class="amount-label">Amount Received</div>
        <div class="amount-value">${receipt.currency} ${formatNumber(receipt.amount)}</div>
    </div>

    <div class="receipt-box">
        <div class="receipt-row">
            <div class="receipt-label">Received From:</div>
            <div class="receipt-value">${receipt.payerName || receipt.payer || 'N/A'}</div>
        </div>
        <div class="receipt-row">
            <div class="receipt-label">Payment Method:</div>
            <div class="receipt-value">${receipt.paymentMethod || 'Bank Transfer'}</div>
        </div>
        <div class="receipt-row">
            <div class="receipt-label">Country:</div>
            <div class="receipt-value">${receipt.country}</div>
        </div>
        ${receipt.linkedInvoiceNumber || receipt.linkedInvoiceId ? `
        <div class="receipt-row">
            <div class="receipt-label">Invoice Reference:</div>
            <div class="receipt-value">${receipt.linkedInvoiceNumber || receipt.linkedInvoiceId}</div>
        </div>
        ` : ''}
    </div>

    ${receipt.notes ? `
    <div class="notes-section">
        <div class="notes-header">Notes</div>
        <div class="notes-content">${receipt.notes}</div>
    </div>
    ` : ''}
</body>
</html>`;
}

module.exports = { generateReceiptHTML };
