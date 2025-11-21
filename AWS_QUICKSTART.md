# WIF Finance - AWS Quick Start (30 Minutes)

Get your app running on AWS in 30 minutes using free tier.

**Full guide**: See `AWS_DEPLOYMENT_GUIDE.md`

---

## Prerequisites (5 minutes)

- [ ] AWS Account with free tier voucher
- [ ] AWS CLI installed: `brew install awscli` or https://aws.amazon.com/cli/
- [ ] Docker installed: https://www.docker.com/
- [ ] Supabase account: https://supabase.com
- [ ] Terminal/Command line access

**Configure AWS CLI:**
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: ap-southeast-1 (Singapore)
# Default output format: json
```

---

## Step 1: Supabase Setup (10 minutes)

### 1.1 Create Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - Name: `wif-finance`
   - Database Password: (generate and save it!)
   - Region: `Southeast Asia (Singapore)`
4. Wait 2 minutes for provisioning

### 1.2 Run Database Schema
1. Go to SQL Editor → New Query
2. Copy **ALL** SQL from `DATABASE_SCHEMA.md`
3. Paste and click "Run"
4. Verify: Table Editor should show 10 tables

### 1.3 Get API Credentials
1. Go to Settings → API
2. Copy these values:
   ```
   Project URL: https://xxxxx.supabase.co
   anon public key: eyJhbGc...
   ```

### 1.4 Create Company Record
In SQL Editor:
```sql
INSERT INTO companies (name, address, tel, email, registration_no, registered_office)
VALUES (
  'WIF JAPAN SDN BHD',
  'Your Address',
  'Your Phone',
  'Your Email',
  'Your Registration No',
  'Your Registered Office'
);
```

### 1.5 Disable RLS (Development Only)
```sql
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_vouchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE statements_of_payment DISABLE ROW LEVEL SECURITY;
ALTER TABLE line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_counters DISABLE ROW LEVEL SECURITY;
```

---

## Step 2: Install Dependencies (2 minutes)

```bash
cd ~/Documents/2025/code/wif-fin

# Install Supabase client
npm install @supabase/supabase-js

# Verify build works
npm run build
```

---

## Step 3: Run AWS Setup Script (10 minutes)

This automated script creates all AWS resources:

```bash
# Make script executable
chmod +x aws-setup.sh

# Run setup
./aws-setup.sh
```

**What it creates:**
- ✅ S3 bucket for frontend
- ✅ ECR repository for PDF service
- ✅ ECS Fargate cluster and service
- ✅ Security groups
- ✅ IAM roles
- ✅ CloudWatch logs
- ✅ Docker image build & push

**During setup, you'll be asked for:**
1. Supabase URL (from Step 1.3)
2. Supabase Anon Key (from Step 1.3)

**Output:**
- Creates `.env.production` file
- Shows PDF service public IP
- Displays S3 bucket name

---

## Step 4: Create CloudFront Distribution (5 minutes)

### Option A: AWS Console (Recommended)

1. Go to CloudFront → Create Distribution
2. **Origin:**
   - Domain: Select your S3 bucket
   - Origin Access: Public
3. **Cache Behavior:**
   - Viewer Protocol: Redirect HTTP to HTTPS
   - Allowed Methods: GET, HEAD, OPTIONS
4. **Settings:**
   - Price Class: North America, Europe, Asia
   - Default Root Object: `index.html`
5. Create Distribution
6. Wait 5-10 minutes
7. Copy CloudFront domain: `dxxxxx.cloudfront.net`

### Option B: Using CLI

```bash
# Create distribution (requires manual config editing)
# See AWS_DEPLOYMENT_GUIDE.md for full CLI commands
```

---

## Step 5: Add PDF Service to CloudFront (3 minutes)

1. Go to your CloudFront distribution → Origins
2. Click "Create Origin"
3. **Settings:**
   - Origin Domain: `<PDF_SERVICE_IP>:3001` (from Step 3)
   - Protocol: HTTP only
   - HTTP Port: 3001
4. Save

5. Go to Behaviors → Create Behavior
6. **Settings:**
   - Path: `/api/pdf/*`
   - Origin: Select PDF service origin
   - Viewer Protocol: Redirect HTTP to HTTPS
   - Allowed Methods: All
   - Cache Policy: CachingDisabled
7. Save

---

## Step 6: Deploy Application (3 minutes)

```bash
# Update .env.production with CloudFront domain
# Replace CLOUDFRONT_DOMAIN with your actual domain
nano .env.production

# Update this line:
# VITE_PDF_SERVICE_URL=https://YOUR_CLOUDFRONT_DOMAIN/api/pdf

# Run deployment
./deploy-aws.sh
```

---

## Step 7: Test (2 minutes)

```bash
# Get your CloudFront URL
CLOUDFRONT_URL="dxxxxx.cloudfront.net"

# Test frontend
curl -I https://$CLOUDFRONT_URL
# Should return: HTTP/2 200

# Test PDF service
curl https://$CLOUDFRONT_URL/api/pdf/health
# Should return: {"status":"ok","message":"PDF service is running"}

# Open in browser
open https://$CLOUDFRONT_URL
```

**Manual Tests:**
1. Open app in browser
2. Create a new invoice
3. Click "Generate PDF"
4. Verify PDF downloads
5. Check Supabase (SQL Editor):
   ```sql
   SELECT * FROM documents ORDER BY created_at DESC LIMIT 5;
   ```

---

## Costs with Free Tier

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| S3 | 5GB storage, 20K requests/month (12 months) | **$0** |
| CloudFront | 50GB data transfer/month (12 months) | **$0** |
| ECS Fargate | None | **$15-20/month** |
| ECR | 500MB storage (always free) | **$0** |
| **Total** | | **$15-20/month** |

**After 12 months:** ~$25-35/month

---

## Troubleshooting

### Issue: AWS CLI not configured
```bash
aws configure
# Enter your credentials
```

### Issue: Docker not running
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### Issue: ECS task not starting
```bash
# Check logs
aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1

# Restart service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --force-new-deployment \
  --region ap-southeast-1
```

### Issue: PDF service returns 502
```bash
# Check ECS task status
aws ecs describe-tasks \
  --cluster wif-finance-cluster \
  --tasks $(aws ecs list-tasks --cluster wif-finance-cluster --service-name wif-pdf-service --query 'taskArns[0]' --output text) \
  --region ap-southeast-1

# Verify security group allows port 3001
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=wif-pdf-service-sg" \
  --region ap-southeast-1
```

### Issue: Supabase connection error
1. Check `.env.production` has correct values
2. Verify Supabase project is active
3. Check RLS is disabled (for development)
4. Test in browser console:
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL);
   ```

---

## Update Deployment

After making changes:

```bash
# Pull latest code
git pull

# Rebuild and deploy
./deploy-aws.sh
```

The script automatically:
1. Builds frontend
2. Uploads to S3
3. Rebuilds Docker image
4. Pushes to ECR
5. Updates ECS service
6. Invalidates CloudFront cache

---

## Stop ECS (Save Money During Development)

```bash
# Stop PDF service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --desired-count 0 \
  --region ap-southeast-1

# Start PDF service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --desired-count 1 \
  --region ap-southeast-1
```

---

## Next Steps

1. **Custom Domain**: Set up Route 53 or external domain
2. **SSL Certificate**: Use AWS Certificate Manager (free)
3. **Monitoring**: Set up CloudWatch alarms
4. **Backups**: Configure Supabase backups
5. **CI/CD**: Add GitHub Actions for auto-deploy

---

## Resources

- Full Guide: `AWS_DEPLOYMENT_GUIDE.md`
- Database Schema: `DATABASE_SCHEMA.md`
- Linode Alternative: `LINODE_DEPLOYMENT_GUIDE.md`

---

## Summary

You now have:
- ✅ React app on S3 + CloudFront
- ✅ PDF service on ECS Fargate
- ✅ PostgreSQL on Supabase
- ✅ HTTPS enabled
- ✅ Global CDN
- ✅ Cost: $15-20/month with free tier

**Your app is live!** 🎉
