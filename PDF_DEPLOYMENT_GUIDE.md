# PDF Generation Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────┐
│   Frontend (Cloudflare Pages)       │
│   - React app                        │
│   - localStorage data                │
│   - PDF download buttons             │
└─────────────┬───────────────────────┘
              │
              │ HTTPS API calls
              ▼
┌─────────────────────────────────────┐
│   PDF Service (Render.com FREE)     │
│   - Node.js + Express               │
│   - Puppeteer (headless Chrome)     │
│   - Generates PDFs from HTML        │
└─────────────────────────────────────┘
```

---

## Part 1: Deploy PDF Service to Render.com (FREE)

### Step 1: Prepare PDF Service Repository

**Option A: Separate Repository (Recommended)**
```bash
# From your project root
cd pdf-service
git init
git add .
git commit -m "Initial PDF service"

# Create new GitHub repo named 'wif-fin-pdf-service'
git remote add origin https://github.com/YOUR_USERNAME/wif-fin-pdf-service.git
git push -u origin main
```

**Option B: Same Repository (Monorepo)**
```bash
# The pdf-service folder already exists in your project
# Just push everything together
git add pdf-service/
git commit -m "Add PDF generation service"
git push
```

### Step 2: Deploy to Render.com

1. **Create Render.com Account**
   - Go to https://render.com/
   - Sign up with GitHub (FREE)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select: `wif-fin` (or `wif-fin-pdf-service` if separate repo)

3. **Configure Service**
   ```
   Name: wif-fin-pdf-service
   Region: Singapore (closest to Malaysia/Japan)
   Branch: main
   Root Directory: pdf-service (if monorepo)
   Environment: Docker
   Plan: FREE
   ```

4. **Environment Variables**
   ```
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-app.pages.dev,http://localhost:5173
   ```
   (We'll update ALLOWED_ORIGINS after deploying frontend)

5. **Deploy!**
   - Click "Create Web Service"
   - Wait 5-10 minutes for first build
   - Copy the service URL: `https://wif-fin-pdf-service.onrender.com`

6. **Test the Service**
   ```bash
   curl https://wif-fin-pdf-service.onrender.com/health
   # Should return: {"status":"ok"}
   ```

---

## Part 2: Deploy Frontend to Cloudflare Pages

### Step 1: Configure Frontend

1. **Create `.env` file**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`**
   ```env
   VITE_PDF_SERVICE_URL=https://wif-fin-pdf-service.onrender.com
   ```

3. **Test Locally**
   ```bash
   npm run dev
   # Create a test invoice
   # Click "PDF" button - should download PDF!
   ```

### Step 2: Deploy to Cloudflare Pages

1. **Push to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Add PDF generation feature"
   git push
   ```

2. **Create Cloudflare Pages**
   - Go to https://dash.cloudflare.com/
   - Click "Workers & Pages" → "Create application" → "Pages"
   - Connect to Git
   - Select your repository

3. **Build Configuration**
   ```
   Framework preset: Vite
   Build command: npm run build
   Build output directory: dist
   Root directory: / (leave empty)
   ```

4. **Environment Variables**
   ```
   VITE_PDF_SERVICE_URL=https://wif-fin-pdf-service.onrender.com
   ```

5. **Deploy**
   - Click "Save and Deploy"
   - Wait 2-3 minutes
   - Your app will be live at: `https://wif-fin-xxx.pages.dev`

### Step 3: Update CORS Settings

1. **Go back to Render.com**
   - Open your PDF service
   - Go to "Environment"
   - Update `ALLOWED_ORIGINS`:
     ```
     https://wif-fin-xxx.pages.dev,http://localhost:5173
     ```
   - Service will auto-redeploy (~2 minutes)

---

## Testing the Complete Setup

### Test 1: Health Check
```bash
curl https://wif-fin-pdf-service.onrender.com/health
```
Expected: `{"status":"ok","service":"pdf-generator"}`

### Test 2: Generate Invoice PDF
1. Open your deployed app: `https://wif-fin-xxx.pages.dev`
2. Go to Accounts → Add a test account
3. Create an Invoice
4. Click the "PDF" button
5. PDF should download automatically!

### Test 3: All Document Types
- ✅ Invoice PDF
- ✅ Receipt PDF
- ✅ Payment Voucher PDF
- ✅ Statement of Payment PDF

---

## Local Development Setup

### Run Both Services Locally

**Terminal 1 - Frontend:**
```bash
# In project root
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 - PDF Service:**
```bash
cd pdf-service
npm install
npm run dev
# Runs on http://localhost:3001
```

**Terminal 3 - Test PDF Generation:**
```bash
# Test invoice generation
curl -X POST http://localhost:3001/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoice": {
      "documentNumber": "INV-TEST-001",
      "customerName": "Test Customer",
      "createdAt": "2025-01-15",
      "currency": "MYR",
      "country": "Malaysia",
      "lineItems": [
        {
          "description": "Test Item",
          "quantity": 1,
          "unitPrice": 100,
          "amount": 100
        }
      ],
      "taxRate": 10,
      "status": "issued"
    }
  }' \
  --output test-invoice.pdf

# Open the PDF
open test-invoice.pdf  # macOS
# or
xdg-open test-invoice.pdf  # Linux
```

---

## Cost Analysis

### Render.com FREE Tier
- ✅ **750 hours/month** (enough for 24/7 operation)
- ✅ **Unlimited bandwidth**
- ✅ **Automatic HTTPS**
- ⚠️ **Cold starts after 15 min inactivity** (~10-30 seconds)
- ⚠️ **Spins down after inactivity** (first request may be slow)

**Solutions for cold starts:**
1. Keep-alive ping (cron job)
2. User patience (show loading spinner)
3. Upgrade to paid tier ($7/month for always-on)

### Cloudflare Pages FREE Tier
- ✅ **Unlimited bandwidth**
- ✅ **Unlimited requests**
- ✅ **500 builds/month**
- ✅ **No cold starts** (always instant)

### Total Cost: $0/month! 🎉

---

## Troubleshooting

### Issue: PDF button shows "Failed to generate PDF"

**Check 1: PDF Service Running?**
```bash
curl https://wif-fin-pdf-service.onrender.com/health
```
If fails: Service might be sleeping (cold start). Wait 30 seconds and try again.

**Check 2: CORS Error?**
- Open browser console (F12)
- Look for CORS errors
- Verify `ALLOWED_ORIGINS` in Render.com includes your Cloudflare Pages URL

**Check 3: Render.com Logs**
- Go to Render.com dashboard
- Click your service → "Logs"
- Look for errors

### Issue: PDF Downloads but is Blank

**Possible causes:**
1. **Missing data in document** - Check invoice has lineItems
2. **Template error** - Check Render.com logs for errors
3. **Puppeteer timeout** - Increase timeout in `pdf-service/src/index.js`

**Fix:**
```javascript
// In pdf-service/src/index.js
await page.setContent(html, {
  waitUntil: 'networkidle0',
  timeout: 30000  // Increase to 30 seconds
});
```

### Issue: "Cold Start" Taking Too Long

**Solution: Add Cron Job Keep-Alive**

Create `pdf-service/src/cron.js`:
```javascript
// Ping service every 10 minutes to keep it warm
setInterval(async () => {
  try {
    await fetch('https://wif-fin-pdf-service.onrender.com/health');
    console.log('Keep-alive ping successful');
  } catch (error) {
    console.error('Keep-alive ping failed:', error);
  }
}, 10 * 60 * 1000); // 10 minutes
```

Or use external service:
- **UptimeRobot** (free) - Pings your service every 5 minutes
- **Cron-job.org** (free) - Same functionality

---

## Customizing Company Information

### Option 1: Hardcode in Frontend

Edit `services/pdfService.ts`:
```typescript
const defaultCompanyInfo = {
  name: 'WIF JAPAN SDN BHD',
  address: 'Suite 123, Business Tower\nKuala Lumpur, 50450\nMalaysia',
  tel: '+60-3-XXXX-XXXX',
  email: 'accounts@wifjapan.com'
};

// Pass to PDF service
await PdfService.downloadPDF(document, defaultCompanyInfo);
```

### Option 2: Make it Configurable

Add company settings UI:
1. Create `CompanySettings` component
2. Store in localStorage
3. Pass to PDF service on download

---

## Production Checklist

Before going live:

- [ ] Test all 4 document types (Invoice, Receipt, PV, SOP)
- [ ] Verify PDFs download correctly
- [ ] Check PDF formatting on different devices
- [ ] Update company information in templates
- [ ] Set up UptimeRobot for keep-alive
- [ ] Add custom domain to Cloudflare Pages (optional)
- [ ] Enable Cloudflare Analytics
- [ ] Test cold start behavior
- [ ] Document PDF service URL for team
- [ ] Add monitoring for PDF service

---

## Upgrading in Future

### When to upgrade Render.com?

**Symptoms:**
- Frequent cold starts annoying users
- Need faster response times
- Processing 1000s of PDFs/month

**Solution:**
Upgrade to Starter plan ($7/month):
- Always-on (no cold starts)
- Faster CPU
- Priority support

### Alternative: Self-Host PDF Service

For complete control:
1. Deploy to DigitalOcean Droplet ($5/month)
2. Use Docker Compose
3. Full control over resources

---

## Support & Resources

**Render.com Docs:**
- https://render.com/docs
- https://render.com/docs/docker

**Puppeteer Docs:**
- https://pptr.dev/

**Cloudflare Pages:**
- https://developers.cloudflare.com/pages/

**Need Help?**
- Check Render.com logs first
- Open browser console for frontend errors
- Test `/health` endpoint
- Check CORS configuration

---

## Summary

✅ **PDF Service:** Deployed to Render.com (FREE)
✅ **Frontend:** Deployed to Cloudflare Pages (FREE)
✅ **Total Cost:** $0/month
✅ **PDF Quality:** Professional, print-ready
✅ **Maintenance:** Minimal (auto-deploys on git push)

Your hybrid PDF generation system is production-ready!
