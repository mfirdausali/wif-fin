# PDF Service Deployment Information

## Current Deployment Status ✅

Your PDF service is **currently deployed and running** on AWS EC2.

### Deployment Details

| Component | Value |
|-----------|-------|
| **Service** | PDF Generator (Node.js service) |
| **EC2 IP Address** | `18.141.140.2` |
| **AWS Region** | `ap-southeast-1` (Singapore) |
| **Port** | `3001` |
| **Domain** | `pdf.wifjapan.com` (points to 18.141.140.2) |
| **Current URL** | `http://pdf.wifjapan.com:3001` |
| **Status** | ✅ Running and healthy |

### Service Endpoints

| Endpoint | URL | Status |
|----------|-----|--------|
| Health Check | `http://18.141.140.2:3001/health` | ✅ Working |
| Health Check (DNS) | `http://pdf.wifjapan.com:3001/health` | ✅ Working |
| Invoice PDF | `http://pdf.wifjapan.com:3001/api/pdf/invoice` | 🔴 Blocked by browser (mixed content) |
| Receipt PDF | `http://pdf.wifjapan.com:3001/api/pdf/receipt` | 🔴 Blocked by browser (mixed content) |
| Payment Voucher PDF | `http://pdf.wifjapan.com:3001/api/pdf/payment-voucher` | 🔴 Blocked by browser (mixed content) |
| Statement of Payment PDF | `http://pdf.wifjapan.com:3001/api/pdf/statement-of-payment` | 🔴 Blocked by browser (mixed content) |

### Why PDF Downloads Are Blocked

Your PDF service is running perfectly, but browsers block it because:
- **Frontend**: `https://finance.wifjapan.com` (HTTPS - Secure)
- **PDF Service**: `http://pdf.wifjapan.com:3001` (HTTP - Insecure)

**Browser security policy**: HTTPS pages cannot load HTTP resources (called "Mixed Content")

### Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                            │
│                 https://finance.wifjapan.com                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Tries to download PDF
                     │
                     ▼
              ┌──────────────┐
              │   CloudFront │ (HTTPS)
              │ d3iesx5hq...  │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  S3 Bucket   │
              │ Frontend App │
              └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PDF Service                               │
│           EC2: 18.141.140.2 (Singapore)                     │
│              pdf.wifjapan.com:3001                          │
│                                                              │
│  ┌────────────────────────────────────────┐                │
│  │  Node.js PDF Generator Service         │                │
│  │  - Port: 3001                          │                │
│  │  - Status: ✅ Running                   │                │
│  │  - Protocol: HTTP (needs HTTPS!)       │                │
│  └────────────────────────────────────────┘                │
│                                                              │
│  🔴 Problem: No SSL/HTTPS configured yet                    │
└─────────────────────────────────────────────────────────────┘
```

## Deployment History

### What Was Deployed

1. **PDF Service Code**
   - Location: `/home/ec2-user/wif-fin/pdf-service/` (on EC2)
   - Language: Node.js
   - Dependencies: Puppeteer, Express
   - Port: 3001

2. **DNS Configuration**
   - Domain: `pdf.wifjapan.com`
   - Type: A Record
   - Value: `18.141.140.2`
   - Status: ✅ Active

3. **What's NOT Deployed Yet**
   - ❌ nginx reverse proxy
   - ❌ SSL/TLS certificate
   - ❌ HTTPS configuration

## How to Access PDF Service

### Currently Accessible (HTTP):
```bash
# Health check
curl http://pdf.wifjapan.com:3001/health

# Generate invoice PDF (works via curl, blocked in browser)
curl -X POST http://pdf.wifjapan.com:3001/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -d '{"invoice": {...}}' \
  > invoice.pdf
```

### After SSL Setup (HTTPS):
```bash
# Health check
curl https://pdf.wifjapan.com:3001/health

# Generate PDF (will work in browser too!)
curl -X POST https://pdf.wifjapan.com:3001/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -d '{"invoice": {...}}' \
  > invoice.pdf
```

## To Check Your PDF Service

### Via Command Line:
```bash
# Test from your Mac
curl http://pdf.wifjapan.com:3001/health

# Should return:
# {"status":"ok","service":"pdf-generator","timestamp":"..."}
```

### Via Browser:
Open: http://pdf.wifjapan.com:3001/health

You should see:
```json
{
  "status": "ok",
  "service": "pdf-generator",
  "timestamp": "2025-11-21T03:25:31.596Z"
}
```

## What Needs to Be Done

To make PDFs downloadable from your HTTPS frontend:

1. **Set up SSL on PDF server** (COPY_PASTE_SSL_SETUP.txt)
   - Install nginx
   - Get Let's Encrypt certificate
   - Configure HTTPS on port 3001

2. **Update frontend configuration**
   - Change: `http://pdf.wifjapan.com:3001`
   - To: `https://pdf.wifjapan.com:3001`
   - Rebuild and deploy

3. **Test**
   - Visit https://finance.wifjapan.com
   - Create document
   - Download PDF
   - Should work! ✅

## Summary

✅ **PDF Service IS Deployed**: EC2 at `18.141.140.2` in Singapore
✅ **PDF Service IS Running**: Port 3001, responding to requests
✅ **DNS IS Configured**: `pdf.wifjapan.com` → `18.141.140.2`
🔴 **SSL NOT Configured**: Service uses HTTP, needs HTTPS
🔴 **PDFs Blocked**: Browser blocks HTTP requests from HTTPS site

**Next Step**: Follow `COPY_PASTE_SSL_SETUP.txt` to add SSL and fix the issue!
