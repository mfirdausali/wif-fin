# WIF FIN PDF Generation Service

Professional PDF generation service using Puppeteer for financial documents.

## Features

- ✅ Invoice PDF generation
- ✅ Receipt PDF generation
- ✅ Payment Voucher PDF generation
- ✅ Statement of Payment PDF generation
- ✅ Professional print-ready templates
- ✅ CORS support
- ✅ Rate limiting
- ✅ Health checks
- ✅ Docker support

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3001`

### Test Endpoints

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Generate Invoice PDF:**
```bash
curl -X POST http://localhost:3001/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -d @test-invoice.json \
  --output invoice.pdf
```

## API Endpoints

### POST /api/pdf/invoice
Generate invoice PDF

**Request Body:**
```json
{
  "invoice": {
    "documentNumber": "INV-2025-001",
    "customerName": "Customer Name",
    "customerAddress": "Customer Address",
    "createdAt": "2025-01-15T00:00:00.000Z",
    "currency": "MYR",
    "country": "Malaysia",
    "lineItems": [
      {
        "description": "Item description",
        "quantity": 1,
        "unitPrice": 100,
        "amount": 100
      }
    ],
    "taxRate": 10,
    "paymentTerms": "Net 30 Days",
    "notes": "Optional notes",
    "status": "issued"
  },
  "companyInfo": {
    "name": "Your Company Name",
    "address": "Company Address",
    "tel": "+60-XXX-XXXXXXX",
    "email": "info@company.com"
  }
}
```

**Response:** PDF file (application/pdf)

### POST /api/pdf/receipt
Generate receipt PDF

### POST /api/pdf/payment-voucher
Generate payment voucher PDF

### POST /api/pdf/statement-of-payment
Generate statement of payment PDF

## Environment Variables

```env
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://your-app.pages.dev,http://localhost:5173
```

## Docker

**Build:**
```bash
docker build -t wif-fin-pdf-service .
```

**Run:**
```bash
docker run -p 3001:3001 \
  -e ALLOWED_ORIGINS=http://localhost:5173 \
  wif-fin-pdf-service
```

## Deployment

See [PDF_DEPLOYMENT_GUIDE.md](../PDF_DEPLOYMENT_GUIDE.md) for complete deployment instructions to Render.com.

## Rate Limiting

- 100 requests per 15 minutes per IP
- Prevents abuse and ensures fair usage

## Security

- Helmet.js for security headers
- CORS restricted to allowed origins
- Input validation
- No file system access beyond PDF generation

## Performance

- Reuses Puppeteer browser instance
- Graceful shutdown handling
- Health checks for monitoring
- Optimized Docker image

## License

MIT
