const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { generateInvoiceHTML } = require('./templates/invoice');
const { generateReceiptHTML } = require('./templates/receipt');
const { generatePaymentVoucherHTML } = require('./templates/paymentVoucher');
const { generateStatementOfPaymentHTML } = require('./templates/statementOfPayment');
const { generateBookingCardHTML, generateCombinedBookingCardHTML, CATEGORY_LABELS } = require('./templates/bookingCard');
const { generateBookingFormHTML } = require('./templates/bookingForm');
const { getCompanyInfo } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://finance.wifjapan.com',
    'https://d3iesx5hq3slg3.cloudfront.net'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many PDF generation requests, please try again later.'
});
app.use('/api/pdf/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-generator', timestamp: new Date().toISOString() });
});

// Puppeteer browser instance (reuse for performance)
let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 120000, // 2 minutes for large images
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    console.log('Puppeteer browser launched successfully');
  }
  return browser;
}

// Generic PDF generation function
async function generatePDF(html, companyInfo = {}, printerInfo = null) {
  let page = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport - use tall height to ensure all content is rendered before pagination
    await page.setViewport({ width: 1200, height: 16000 });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 60000 // 60 seconds for large images
    });

    // Give it a moment to render styles fully
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create footer template with company info
    const registrationNo = companyInfo.registrationNo || '';
    const registeredOffice = companyInfo.registeredOffice || '';

    // Format printer info
    let printerText = '';
    if (printerInfo && printerInfo.userName && printerInfo.printDate) {
      const printDate = new Date(printerInfo.printDate);
      // Use timezone from printerInfo or default to Asia/Kuala_Lumpur (GMT+8)
      const timezone = printerInfo.timezone || 'Asia/Kuala_Lumpur';
      const dateStr = printDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
      });
      const timeStr = printDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone
      });
      // Determine GMT offset label
      const gmtOffset = timezone === 'Asia/Tokyo' ? 'GMT+9' : 'GMT+8';
      printerText = `Printed by ${printerInfo.userName} on ${dateStr} at ${timeStr} (${gmtOffset})`;
    }

    const footerTemplate = `
      <div style="width: 100%; font-family: Arial, sans-serif; font-size: 9.5px; text-align: center; color: #333333; padding: 10px 40px; margin-top: 10px;">
        <div style="margin-bottom: 4px; line-height: 1.4;">Company Registration No: ${registrationNo}. Registered Office: ${registeredOffice}</div>
        ${printerText ? `<div style="margin-bottom: 4px; color: #666666; line-height: 1.4;">${printerText}</div>` : ''}
        <div style="margin-top: 4px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
      </div>
    `;

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate,
      margin: {
        top: '20mm',      // Clean top margin
        right: '20mm',    // Professional side margins
        bottom: '25mm',   // Space for footer
        left: '20mm'      // Professional side margins
      },
      preferCSSPageSize: false
    });

    return pdf;
  } catch (error) {
    console.error('PDF generation error:', error);
    // If browser crashed, reset it
    if (browser && !browser.isConnected()) {
      console.log('Browser disconnected, resetting...');
      browser = null;
    }
    throw error;
  } finally {
    if (page) {
      await page.close().catch(err => console.error('Error closing page:', err));
    }
  }
}

// Invoice PDF endpoint
app.post('/api/pdf/invoice', async (req, res) => {
  try {
    const { invoice, companyInfo: providedCompanyInfo, printerInfo } = req.body;

    if (!invoice) {
      return res.status(400).json({ error: 'Invoice data is required' });
    }

    // Fetch company info from Supabase if not provided or incomplete
    const companyInfo = await getCompanyInfo(providedCompanyInfo);

    // Log invoice data for debugging
    console.log('Generating invoice PDF:', {
      documentNumber: invoice.documentNumber,
      customerName: invoice.customerName,
      itemsCount: invoice.items ? invoice.items.length : 0,
      items: invoice.items ? invoice.items.map(i => i.description) : [],
      total: invoice.total,
      currency: invoice.currency,
      printedBy: printerInfo?.userName,
      companyInfoSource: providedCompanyInfo ? 'request' : 'supabase'
    });

    const html = generateInvoiceHTML(invoice, companyInfo);
    const pdf = await generatePDF(html, companyInfo, printerInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.documentNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

// Receipt PDF endpoint
app.post('/api/pdf/receipt', async (req, res) => {
  try {
    const { receipt, companyInfo: providedCompanyInfo, printerInfo } = req.body;

    if (!receipt) {
      return res.status(400).json({ error: 'Receipt data is required' });
    }

    // Fetch company info from Supabase if not provided or incomplete
    const companyInfo = await getCompanyInfo(providedCompanyInfo);

    const html = generateReceiptHTML(receipt, companyInfo);
    const pdf = await generatePDF(html, companyInfo, printerInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.documentNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

// Payment Voucher PDF endpoint
app.post('/api/pdf/payment-voucher', async (req, res) => {
  try {
    const { paymentVoucher, companyInfo: providedCompanyInfo, printerInfo } = req.body;

    if (!paymentVoucher) {
      return res.status(400).json({ error: 'Payment voucher data is required' });
    }

    // Fetch company info from Supabase if not provided or incomplete
    const companyInfo = await getCompanyInfo(providedCompanyInfo);

    const html = generatePaymentVoucherHTML(paymentVoucher, companyInfo);
    const pdf = await generatePDF(html, companyInfo, printerInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payment-voucher-${paymentVoucher.documentNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating payment voucher PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

// Statement of Payment PDF endpoint
app.post('/api/pdf/statement-of-payment', async (req, res) => {
  try {
    const { statementOfPayment, companyInfo: providedCompanyInfo, printerInfo } = req.body;

    if (!statementOfPayment) {
      return res.status(400).json({ error: 'Statement of payment data is required' });
    }

    // Fetch company info from Supabase if not provided or incomplete
    const companyInfo = await getCompanyInfo(providedCompanyInfo);

    const html = generateStatementOfPaymentHTML(statementOfPayment, companyInfo);
    const pdf = await generatePDF(html, companyInfo, printerInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-of-payment-${statementOfPayment.documentNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generating statement of payment PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

// Booking Card PDF endpoint
app.post('/api/pdf/booking-card', async (req, res) => {
  try {
    const { booking, categories, includePrices, outputFormat, companyInfo: providedCompanyInfo, printerInfo } = req.body;

    if (!booking) {
      return res.status(400).json({ error: 'Booking data is required' });
    }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'At least one category must be selected' });
    }

    // Fetch company info from Supabase if not provided or incomplete
    const companyInfo = await getCompanyInfo(providedCompanyInfo);

    // Map category keys to item arrays
    const categoryItemsMap = {
      transportation: booking.transportationItems || [],
      meals: booking.mealsItems || [],
      entrance: booking.entranceItems || [],
      tourGuide: booking.tourGuideItems || [],
      flights: booking.flightItems || [],
      accommodation: booking.accommodationItems || []
    };

    // Filter to only selected categories with items
    const categoriesData = categories
      .filter(cat => categoryItemsMap[cat] && categoryItemsMap[cat].length > 0)
      .map(cat => ({
        category: cat,
        items: categoryItemsMap[cat]
      }));

    if (categoriesData.length === 0) {
      return res.status(400).json({ error: 'Selected categories have no items' });
    }

    console.log('Generating booking card PDF:', {
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      categories: categoriesData.map(c => c.category),
      includePrices,
      outputFormat,
      printedBy: printerInfo?.userName
    });

    const options = { includePrices: includePrices || false, companyInfo, printerInfo };

    if (outputFormat === 'combined' || categoriesData.length === 1) {
      // Generate single PDF with all categories
      const html = generateCombinedBookingCardHTML(booking, categoriesData, options);
      const pdf = await generatePDF(html, companyInfo, printerInfo);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="booking-card-${booking.bookingCode}.pdf"`);
      res.send(pdf);
    } else {
      // Generate separate PDFs and return as JSON with base64 encoded PDFs
      const pdfs = [];

      for (const { category, items } of categoriesData) {
        const html = generateBookingCardHTML(booking, category, items, options);
        const pdf = await generatePDF(html, companyInfo, printerInfo);
        pdfs.push({
          category,
          categoryLabel: CATEGORY_LABELS[category] || category,
          filename: `booking-card-${booking.bookingCode}-${category}.pdf`,
          data: pdf.toString('base64')
        });
      }

      res.json({ pdfs });
    }
  } catch (error) {
    console.error('Error generating booking card PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

// Booking Form PDF endpoint
app.post('/api/pdf/booking-form', async (req, res) => {
  try {
    const { booking, options: requestOptions, companyInfo: providedCompanyInfo, printerInfo } = req.body;

    if (!booking) {
      return res.status(400).json({ error: 'Booking data is required' });
    }

    if (!booking.bookingCode) {
      return res.status(400).json({ error: 'Booking code is required' });
    }

    // Fetch company info from Supabase if not provided or incomplete
    const companyInfo = await getCompanyInfo(providedCompanyInfo);

    // Set default options
    const defaultOptions = {
      pricingDisplay: 'none',
      includeNotes: true,
      includeEmptyCategories: false,
      showProfitMargin: false,
      showExchangeRate: true,
      paperSize: 'a4',
      orientation: 'portrait'
    };

    // Merge provided options with defaults
    const options = {
      ...defaultOptions,
      ...requestOptions,
      companyInfo,
      printerInfo
    };

    console.log('Generating booking form PDF:', {
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      pricingDisplay: options.pricingDisplay,
      includeNotes: options.includeNotes,
      paperSize: options.paperSize,
      orientation: options.orientation,
      printedBy: printerInfo?.userName
    });

    // Generate HTML using the template
    const html = generateBookingFormHTML(booking, options);

    // Set appropriate margins based on paper size
    let margins = {
      top: '20mm',
      right: '20mm',
      bottom: '25mm',
      left: '20mm'
    };

    if (options.paperSize === 'letter') {
      margins = {
        top: '0.75in',
        right: '0.75in',
        bottom: '1in',
        left: '0.75in'
      };
    }

    // Generate PDF with custom margins
    let page = null;

    try {
      const browser = await getBrowser();
      page = await browser.newPage();

      // Set viewport based on orientation
      const width = options.orientation === 'landscape' ? 1600 : 1200;
      const height = 16000;
      await page.setViewport({ width, height });

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Give it a moment to render styles fully
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create footer template with company info from Supabase
      const companyName = companyInfo.name || '';
      const registrationNo = companyInfo.registrationNo || '';
      const registeredOffice = companyInfo.registeredOffice || '';

      // Format printer info - uses device date/time from printerInfo
      let printerText = '';
      if (printerInfo && printerInfo.userName && printerInfo.printDate) {
        const printDate = new Date(printerInfo.printDate);
        const timezone = printerInfo.timezone || 'Asia/Kuala_Lumpur';
        const dateStr = printDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: timezone
        });
        const timeStr = printDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone
        });
        // Extract GMT offset from timezone
        const gmtOffsets = {
          'Asia/Tokyo': 'GMT+9',
          'Asia/Kuala_Lumpur': 'GMT+8',
          'Asia/Singapore': 'GMT+8',
          'Asia/Jakarta': 'GMT+7',
        };
        const gmtOffset = gmtOffsets[timezone] || timezone;
        printerText = `Printed by: ${printerInfo.userName} | ${dateStr} ${timeStr} (${gmtOffset})`;
      }

      // Footer format:
      // Line 1: Company Name (Registration No)
      // Line 2: Registered Office: [address]
      // Line 3: Printed by: [user] | [date] [time] (timezone)
      // Line 4: Page X of Y
      const footerTemplate = `
        <div style="width: 100%; font-family: Arial, sans-serif; font-size: 8px; text-align: center; color: #333333; padding: 8px 40px;">
          <div style="margin-bottom: 2px; line-height: 1.3;">${companyName}${registrationNo ? ` (${registrationNo})` : ''}</div>
          ${registeredOffice ? `<div style="margin-bottom: 2px; line-height: 1.3; color: #666666;">Registered Office: ${registeredOffice}</div>` : ''}
          ${printerText ? `<div style="margin-bottom: 2px; line-height: 1.3; color: #666666;">${printerText}</div>` : ''}
          <div style="margin-top: 3px; color: #999999;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
        </div>
      `;

      const pdf = await page.pdf({
        format: options.paperSize === 'letter' ? 'Letter' : 'A4',
        landscape: options.orientation === 'landscape',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate,
        margin: margins,
        preferCSSPageSize: false
      });

      await page.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="booking-form-${booking.bookingCode}.pdf"`);
      res.send(pdf);
    } catch (error) {
      if (page) {
        await page.close().catch(err => console.error('Error closing page:', err));
      }
      throw error;
    }
  } catch (error) {
    console.error('Error generating booking form PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser and server...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`PDF Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
