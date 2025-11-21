# Supabase Integration Guide

## Current Status

Your application is currently using **localStorage** for data persistence. This needs to be migrated to **Supabase** for:
- Persistent cloud storage
- Multi-device access
- Better data integrity
- Scalability

## Issues Found

### 1. localStorage Usage
**Problem**: App.tsx still uses localStorage directly
```typescript
const DOCUMENTS_STORAGE_KEY = 'malaysia_japan_documents';
const ACCOUNTS_STORAGE_KEY = 'malaysia_japan_accounts';
```

**Solution**: Use Supabase service layer that's already created in `services/supabaseService.ts`

### 2. PDF Service HTTP Issue
**Problem**: PDF service uses HTTP on HTTPS site (mixed content error)
```
VITE_PDF_SERVICE_URL=http://18.141.140.2:3001  ← Blocked by browser
```

**Solutions**:
1. **Quick Fix**: Set up CloudFront distribution for PDF service with HTTPS
2. **Alternative**: Set up Application Load Balancer with SSL certificate
3. **Long-term**: Use AWS Certificate Manager + ALB

## Migration Strategy

### Phase 1: Keep Both Systems (Recommended)
1. Add Supabase integration alongside localStorage
2. Sync data bidirectionally
3. Gradually migrate users
4. Eventually remove localStorage

### Phase 2: Direct Migration (Faster but riskier)
1. Replace localStorage with Supabase directly
2. Provide data migration utility
3. Users lose local data if not migrated

## Implementation Plan

### Step 1: Update App.tsx to use Supabase

The `supabaseService.ts` already provides:
- `getOrCreateDefaultCompany()` - Get/create company
- `createAccount()` - Create accounts
- `getAccounts()` - Fetch accounts
- `createDocument()` - Create documents
- `getDocuments()` - Fetch documents
- `updateDocument()` - Update documents
- `deleteDocument()` - Delete documents

### Step 2: Data Migration Utility

Create a utility to migrate existing localStorage data to Supabase:
```typescript
async function migrateLocalDataToSupabase() {
  // 1. Get company
  const company = await getOrCreateDefaultCompany();

  // 2. Migrate accounts
  const localAccounts = JSON.parse(localStorage.getItem('malaysia_japan_accounts') || '[]');
  for (const account of localAccounts) {
    await createAccount(company.id, account);
  }

  // 3. Migrate documents
  const localDocs = JSON.parse(localStorage.getItem('malaysia_japan_documents') || '[]');
  for (const doc of localDocs) {
    await createDocument(company.id, doc);
  }
}
```

### Step 3: Update PDF Service for HTTPS

#### Option A: CloudFront Distribution (Recommended)
1. Create CloudFront distribution pointing to PDF service EC2
2. Use AWS Certificate Manager for SSL
3. Update `.env.production`:
   ```
   VITE_PDF_SERVICE_URL=https://YOUR_CLOUDFRONT_DOMAIN/api/pdf
   ```

#### Option B: Application Load Balancer
1. Create ALB in front of PDF service
2. Attach SSL certificate from ACM
3. Point to EC2 instance
4. Update `.env.production` with ALB HTTPS endpoint

#### Option C: Nginx Reverse Proxy on EC2
1. Install nginx on PDF service EC2
2. Set up Let's Encrypt SSL certificate
3. Configure nginx as reverse proxy to port 3001
4. Use domain name instead of IP address

## Quick Wins

### 1. Fix PDF Service HTTPS (Immediate)

**Using CloudFront**:
```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name 18.141.140.2:3001 \
  --default-root-object / \
  --viewer-protocol-policy redirect-to-https

# Get the CloudFront domain
# Update .env.production
VITE_PDF_SERVICE_URL=https://CLOUDFRONT_DOMAIN/api/pdf
```

**Using nginx on EC2** (if you have a domain):
```bash
# SSH to PDF service EC2
ssh -i your-key.pem ec2-user@18.141.140.2

# Install certbot
sudo yum install -y certbot python3-certbot-nginx nginx

# Configure nginx reverse proxy
sudo nano /etc/nginx/conf.d/pdf-service.conf
# Add configuration for reverse proxy to localhost:3001

# Get SSL certificate (requires domain)
sudo certbot --nginx -d pdf.yourdomain.com

# Update .env.production
VITE_PDF_SERVICE_URL=https://pdf.yourdomain.com/api/pdf
```

### 2. Enable Supabase Integration (Next)

I can create a new version of App.tsx that:
- Uses Supabase for data storage
- Keeps localStorage as backup/cache
- Syncs between both systems
- Provides migration utility

## Next Steps

1. **Immediate**: Fix PDF HTTPS issue
   - Choose CloudFront, ALB, or nginx approach
   - Update environment variables
   - Rebuild and deploy frontend

2. **Short-term**: Integrate Supabase
   - Create new App.tsx with Supabase integration
   - Add data migration utility
   - Test thoroughly

3. **Long-term**: Remove localStorage
   - After all data migrated to Supabase
   - Keep only as cache layer
   - Clean up old code

## Decision Needed

**Which approach do you prefer?**

A. **Quick CloudFront Fix** (30 minutes)
   - Set up CloudFront for PDF service
   - Get HTTPS working immediately
   - No code changes needed

B. **Full Supabase Migration** (2-3 hours)
   - Rewrite App.tsx to use Supabase
   - Add migration utility
   - More robust long-term

C. **Both** (Recommended, 3-4 hours)
   - Fix PDF HTTPS first
   - Then migrate to Supabase
   - Complete solution

Let me know your preference and I'll implement it!
