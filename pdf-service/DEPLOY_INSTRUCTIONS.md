# PDF Service Deployment Instructions

## Changes Made
Fixed two critical PDF layout issues:
1. ✅ Payment Items table no longer overlaps with footer
2. ✅ Transfer proof images now fit within single page (max 330pt height)

## Quick Deploy

### Option 1: Deploy to Render (Recommended)

The PDF service is likely already deployed on Render. To deploy the fixes:

```bash
cd /Users/firdaus/Documents/2025/code/wif-fin/pdf-service

# Stage all changes
git add src/templates/statementOfPayment.js

# Commit with descriptive message
git commit -m "Fix PDF layout: prevent table/footer overlap and resize transfer proof images"

# Push to main branch (this triggers auto-deploy on Render)
git push origin main
```

Render will automatically:
- Detect the push to main
- Rebuild the Docker container
- Deploy the new version
- The service will be live in 2-3 minutes

### Option 2: Local Testing First

Test the changes locally before deploying:

```bash
cd /Users/firdaus/Documents/2025/code/wif-fin/pdf-service

# Install dependencies (if not already installed)
npm install

# Start the PDF service locally
npm start
# Service runs on http://localhost:3001

# In another terminal, test from the frontend
cd /Users/firdaus/Documents/2025/code/wif-fin
# Update VITE_PDF_SERVICE_URL in .env.local to http://localhost:3001
npm run dev

# Create a Statement of Payment with:
# - Payment items (to test table layout)
# - Transfer proof image (to test image sizing)
# - Generate PDF and verify:
#   ✓ Table doesn't overlap footer
#   ✓ Image fits on one page
#   ✓ Footer appears on all pages
```

### Option 3: Docker Manual Deploy

If you need to deploy manually via Docker:

```bash
cd /Users/firdaus/Documents/2025/code/wif-fin/pdf-service

# Build Docker image
docker build -t wif-pdf-service:latest .

# Run container
docker run -d \
  --name wif-pdf-service \
  -p 3001:3001 \
  -e PORT=3001 \
  -e ALLOWED_ORIGINS="https://finance.wifjapan.com" \
  wif-pdf-service:latest

# Check logs
docker logs -f wif-pdf-service

# Stop container
docker stop wif-pdf-service
docker rm wif-pdf-service
```

## Verification Steps

After deployment, verify the fixes:

1. **Go to** https://finance.wifjapan.com
2. **Create a Payment Voucher** with items (e.g., "ABC" item for MYR 2,500)
3. **Create a Statement of Payment**:
   - Link to the payment voucher
   - Add a transfer proof image (upload a receipt or screenshot)
   - Fill in payment details
   - Submit
4. **Download PDF**
5. **Check**:
   - ✅ Payment Items table doesn't overlap the footer text
   - ✅ Transfer proof image fits within the page (not extending to page 2)
   - ✅ Footer shows company registration and printer info
   - ✅ Page numbers appear correctly (Page 1 of 3, etc.)

## Rollback (if needed)

If there are issues, rollback to previous version:

```bash
cd /Users/firdaus/Documents/2025/code/wif-fin/pdf-service

# View commit history
git log --oneline

# Rollback to previous commit (replace <commit-hash>)
git revert <commit-hash>
git push origin main
```

## Environment Variables

Ensure these are set in Render dashboard:
- `PORT`: 3001 (default)
- `ALLOWED_ORIGINS`: https://finance.wifjapan.com,https://d3iesx5hq3slg3.cloudfront.net
- `NODE_ENV`: production

## Troubleshooting

### PDF service not responding
```bash
# Check if service is running
curl https://your-pdf-service.onrender.com/health

# Should return:
# {"status":"ok","service":"pdf-generator","timestamp":"..."}
```

### Images still too large
- Check that the image file size is reasonable (< 5MB)
- Very large images may need additional compression

### Footer not showing
- Footer is added by Puppeteer, not the HTML template
- Check that companyInfo and printerInfo are being passed correctly
- Verify in pdf-service logs

## Files Changed

- `src/templates/statementOfPayment.js` - Only file modified
- Added CSS classes and styling fixes
- No breaking changes to API or data structures

## Next Steps

After successful deployment:
1. Monitor Render logs for any errors
2. Test with real documents
3. Verify footer text is correct
4. Check all document types still work (Invoice, Receipt, Payment Voucher)
