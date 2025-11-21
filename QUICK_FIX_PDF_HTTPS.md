# Quick Fix: PDF HTTPS Issue

## Problem
PDF downloads are failing with this error:
```
Mixed Content: The page at 'https://finance.wifjapan.com/' was loaded over HTTPS,
but requested an insecure resource 'http://18.141.140.2:3001/api/pdf/invoice'.
```

**Root cause**: Your PDF service is on HTTP, but your website is on HTTPS. Browsers block mixed content.

## Solution Options

### Option 1: Use CloudFront (Easiest, No Domain Required)

**Time**: ~15 minutes

```bash
# 1. Create CloudFront distribution
aws cloudfront create-distribution --cli-input-json '{
  "DistributionConfig": {
    "CallerReference": "pdf-service-'$(date +%s)'",
    "Comment": "PDF Service HTTPS Distribution",
    "Enabled": true,
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "pdf-service-origin",
        "DomainName": "18.141.140.2",
        "CustomOriginConfig": {
          "HTTPPort": 3001,
          "OriginProtocolPolicy": "http-only"
        }
      }]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "pdf-service-origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      },
      "ForwardedValues": {
        "QueryString": true,
        "Headers": {"Quantity": 1, "Items": ["*"]}
      }
    }
  }
}'

# 2. Get the CloudFront domain (wait ~5 min for deployment)
aws cloudfront list-distributions --query 'DistributionList.Items[0].DomainName'
# Example output: d1234567890abc.cloudfront.net

# 3. Update .env.production
# Replace VITE_PDF_SERVICE_URL=http://18.141.140.2:3001
# With: VITE_PDF_SERVICE_URL=https://d1234567890abc.cloudfront.net

# 4. Rebuild and deploy frontend
npm run build
npm run deploy
```

### Option 2: Use nginx with Let's Encrypt (Requires Domain)

**Time**: ~30 minutes
**Requires**: A domain name (e.g., pdf.wifjapan.com)

**Prerequisites**:
1. Create DNS A record: `pdf.wifjapan.com` → `18.141.140.2`
2. Wait for DNS propagation (~5 minutes)

**Steps**:
```bash
# 1. SSH to PDF service server
ssh -i your-key.pem ec2-user@18.141.140.2

# 2. Copy and run the setup script
# (The setup-pdf-https.sh script I created)
bash setup-pdf-https.sh pdf.wifjapan.com

# 3. Update .env.production on frontend
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com

# 4. Rebuild and deploy frontend
npm run build
npm run deploy
```

### Option 3: Temporarily Allow HTTP (Not Recommended)

**Only for testing - NOT for production!**

This involves adding meta tag to allow mixed content, but it's a security risk.

## Recommended Solution

**I recommend Option 1 (CloudFront)** because:
- ✅ No domain name required
- ✅ Automatic HTTPS via AWS certificate
- ✅ Global CDN for faster PDF generation
- ✅ No changes to PDF service server
- ✅ Easy to set up

## After Fixing PDF HTTPS

Once the PDF service has HTTPS, we need to fix the localStorage issue:
- Current: Data saved to browser localStorage only
- Target: Data saved to Supabase for persistence

See `SUPABASE_INTEGRATION_GUIDE.md` for migration steps.

## Quick Commands

**Check PDF service health**:
```bash
curl http://18.141.140.2:3001/health
```

**Test after CloudFront setup**:
```bash
curl https://YOUR_CLOUDFRONT_DOMAIN/health
```

**Rebuild frontend**:
```bash
npm run build
npm run deploy
```
