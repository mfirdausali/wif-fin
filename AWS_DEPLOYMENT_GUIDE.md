# WIF Finance - AWS Deployment Guide
## S3 + CloudFront + ECS Fargate + Supabase

Complete step-by-step guide to deploy WIF Finance on AWS with Supabase backend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ User Browser                                         │
│   ↓                                                  │
│ CloudFront CDN (Global Edge Locations)              │
│   ├─→ S3 Static Website (React Frontend)            │
│   └─→ ECS Fargate Task (PDF Service)                │
│         ↓                                            │
│       Supabase PostgreSQL (External)                 │
└─────────────────────────────────────────────────────┘
```

**Monthly Cost Estimate:**
- S3 Storage: $0.50-1/month (AWS Free Tier: 5GB free for 12 months)
- CloudFront: $5-10/month (AWS Free Tier: 50GB/month free for 12 months)
- ECS Fargate (1 task): $15-20/month
- Route 53: $0.50/month
- **Supabase Free Tier: $0/month**
- **Total: ~$6-12/month** (with free tier), ~$21-32/month after

---

## Prerequisites

### 1. AWS Account Setup
- [ ] AWS Account with free tier credits
- [ ] AWS CLI installed and configured
- [ ] IAM user with AdministratorAccess (or specific policies)

### 2. Supabase Account
- [ ] Free Supabase account at https://supabase.com
- [ ] Project created

### 3. Domain (Optional but Recommended)
- [ ] Domain registered (Route 53 or external)
- [ ] Access to DNS management

### 4. Local Tools
```bash
# Install AWS CLI
brew install awscli  # macOS
# OR
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version  # Should show aws-cli/2.x.x

# Configure AWS CLI
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: ap-southeast-1 (Singapore) or ap-northeast-1 (Tokyo)
# - Default output format: json
```

---

## Part 1: Supabase Setup (15 minutes)

### Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: `wif-finance`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: `Southeast Asia (Singapore)` or `Northeast Asia (Tokyo)`
   - **Pricing Plan**: Free

4. Wait 2-3 minutes for provisioning

### Step 2: Run Database Schema

1. In Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy **ALL** SQL from `DATABASE_SCHEMA.md` (lines 177-632)
4. Paste into SQL Editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. Verify in Table Editor:
   - ✅ 10 tables created
   - ✅ companies, accounts, documents, invoices, receipts, payment_vouchers, statements_of_payment, line_items, transactions, document_counters

### Step 3: Get API Credentials

1. Go to Settings → API
2. Copy these values (save them):
   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 4: Create Initial Company Record

In SQL Editor, run:
```sql
INSERT INTO companies (name, address, tel, email, registration_no, registered_office)
VALUES (
  'WIF JAPAN SDN BHD',
  'YOUR_ADDRESS',
  'YOUR_PHONE',
  'YOUR_EMAIL',
  'YOUR_REGISTRATION_NO',
  'YOUR_REGISTERED_OFFICE'
) RETURNING id;
```

Save the returned `id` (company UUID).

### Step 5: Disable RLS for Development (Optional)

For initial testing, you can temporarily disable Row Level Security:

```sql
-- Disable RLS on all tables (for development only)
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

**⚠️ WARNING:** Re-enable RLS before going to production!

---

## Part 2: Prepare Application (10 minutes)

### Step 1: Install Supabase Client

```bash
cd ~/Documents/2025/code/wif-fin
npm install @supabase/supabase-js
```

### Step 2: Create Environment Files

**For Local Development** (`.env.local`):
```bash
cat > .env.local << 'EOF'
# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# PDF Service (local)
VITE_PDF_SERVICE_URL=http://localhost:3001
EOF
```

**For Production** (`.env.production`):
```bash
cat > .env.production << 'EOF'
# Supabase (same as local)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# PDF Service (will be updated after ECS deployment)
VITE_PDF_SERVICE_URL=https://YOUR_CLOUDFRONT_DOMAIN/api/pdf
EOF
```

### Step 3: Test Local Build

```bash
# Build frontend
npm run build

# Verify build output
ls -lh dist/
# Should show: index.html, assets/, etc.
```

---

## Part 3: Deploy to AWS S3 + CloudFront (20 minutes)

### Step 1: Create S3 Bucket

```bash
# Set your bucket name (must be globally unique)
BUCKET_NAME="wif-finance-frontend-$(date +%s)"
AWS_REGION="ap-southeast-1"  # Singapore

# Create bucket
aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION

# Configure for static website hosting
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html

# Create bucket policy for CloudFront access
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file:///tmp/bucket-policy.json

# Disable block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

### Step 2: Upload Frontend to S3

```bash
# Upload build files
aws s3 sync dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html"

# Upload index.html separately (no cache)
aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"

# Verify upload
aws s3 ls s3://$BUCKET_NAME/
```

### Step 3: Create CloudFront Distribution

**Option A: Using AWS Console (Easier)**

1. Go to CloudFront → Create Distribution
2. **Origin Settings:**
   - Origin Domain: Select your S3 bucket
   - Name: `wif-frontend-origin`
   - Origin Access: Public
3. **Default Cache Behavior:**
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS
   - Cache Policy: CachingOptimized
4. **Settings:**
   - Price Class: Use Only North America, Europe, Asia, Middle East and Africa
   - Alternate Domain Names (CNAMEs): `yourdomain.com` (if you have one)
   - SSL Certificate: Default CloudFront Certificate (or request custom)
   - Default Root Object: `index.html`
5. Click "Create Distribution"
6. Wait 5-10 minutes for deployment
7. Save your CloudFront domain: `dxxxxxxxxxxxxx.cloudfront.net`

**Option B: Using AWS CLI (Advanced)**

```bash
# Create CloudFront distribution config
cat > /tmp/cloudfront-config.json << 'EOF'
{
  "CallerReference": "wif-finance-'$(date +%s)'",
  "Comment": "WIF Finance Frontend",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "wif-s3-origin",
        "DomainName": "'$BUCKET_NAME'.s3.'$AWS_REGION'.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "wif-s3-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "Compress": true
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "PriceClass": "PriceClass_100"
}
EOF

# Create distribution
aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json

# Get distribution domain
aws cloudfront list-distributions \
  --query "DistributionList.Items[0].DomainName" \
  --output text
```

### Step 4: Test Frontend

```bash
# Get CloudFront URL
CLOUDFRONT_URL="dxxxxxxxxxxxxx.cloudfront.net"

# Test
curl -I https://$CLOUDFRONT_URL
# Should return: HTTP/2 200

# Open in browser
open https://$CLOUDFRONT_URL
```

---

## Part 4: Deploy PDF Service to ECS Fargate (30 minutes)

### Step 1: Create ECR Repository

```bash
# Create ECR repository for PDF service
aws ecr create-repository \
  --repository-name wif-pdf-service \
  --region $AWS_REGION

# Get repository URI
ECR_URI=$(aws ecr describe-repositories \
  --repository-names wif-pdf-service \
  --region $AWS_REGION \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "ECR Repository: $ECR_URI"
```

### Step 2: Build and Push Docker Image

```bash
cd pdf-service

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build Docker image
docker build -t wif-pdf-service .

# Tag image
docker tag wif-pdf-service:latest $ECR_URI:latest

# Push to ECR
docker push $ECR_URI:latest

cd ..
```

### Step 3: Create ECS Cluster

```bash
# Create cluster
aws ecs create-cluster \
  --cluster-name wif-finance-cluster \
  --region $AWS_REGION
```

### Step 4: Create Task Definition

```bash
cat > /tmp/task-definition.json << EOF
{
  "family": "wif-pdf-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "pdf-service",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3001"
        },
        {
          "name": "CORS_ORIGIN",
          "value": "https://$CLOUDFRONT_URL"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/wif-pdf-service",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Replace placeholder
sed -i.bak "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" /tmp/task-definition.json

# Create CloudWatch log group
aws logs create-log-group \
  --log-group-name /ecs/wif-pdf-service \
  --region $AWS_REGION

# Create task execution role (if it doesn't exist)
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null || true

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json \
  --region $AWS_REGION
```

### Step 5: Create Security Group

```bash
# Get default VPC ID
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' \
  --output text \
  --region $AWS_REGION)

# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name wif-pdf-service-sg \
  --description "Security group for WIF PDF service" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query 'GroupId' \
  --output text)

# Allow inbound traffic on port 3001
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3001 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

echo "Security Group ID: $SG_ID"
```

### Step 6: Create ECS Service

```bash
# Get default subnets
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
  --query 'Subnets[*].SubnetId' \
  --output text \
  --region $AWS_REGION)

# Convert to comma-separated list
SUBNET_LIST=$(echo $SUBNET_IDS | tr ' ' ',')

# Create ECS service
aws ecs create-service \
  --cluster wif-finance-cluster \
  --service-name wif-pdf-service \
  --task-definition wif-pdf-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
  --region $AWS_REGION
```

### Step 7: Get ECS Task Public IP

```bash
# Wait for task to start (may take 2-3 minutes)
sleep 60

# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster wif-finance-cluster \
  --service-name wif-pdf-service \
  --region $AWS_REGION \
  --query 'taskArns[0]' \
  --output text)

# Get ENI ID
ENI_ID=$(aws ecs describe-tasks \
  --cluster wif-finance-cluster \
  --tasks $TASK_ARN \
  --region $AWS_REGION \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

# Get public IP
PDF_SERVICE_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids $ENI_ID \
  --region $AWS_REGION \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text)

echo "PDF Service Public IP: $PDF_SERVICE_IP"
echo "PDF Service URL: http://$PDF_SERVICE_IP:3001"

# Test
curl http://$PDF_SERVICE_IP:3001/health
```

---

## Part 5: Connect CloudFront to PDF Service (15 minutes)

### Step 1: Add PDF Service as CloudFront Origin

1. Go to CloudFront → Select your distribution → Origins tab
2. Click "Create Origin"
3. **Settings:**
   - Origin Domain: `$PDF_SERVICE_IP:3001`
   - Protocol: HTTP only
   - HTTP Port: 3001
   - Name: `pdf-service-origin`
4. Save

### Step 2: Create Cache Behavior

1. Go to Behaviors tab → Create Behavior
2. **Settings:**
   - Path Pattern: `/api/pdf/*`
   - Origin: `pdf-service-origin`
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache Policy: CachingDisabled
   - Origin Request Policy: AllViewer
3. Save

### Step 3: Invalidate CloudFront Cache

```bash
# Get distribution ID
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[0].Id" \
  --output text)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

### Step 4: Update Frontend Environment

```bash
# Update .env.production
cat > .env.production << EOF
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_PDF_SERVICE_URL=https://$CLOUDFRONT_URL/api/pdf
EOF

# Rebuild frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

---

## Part 6: Testing & Verification (10 minutes)

### Test Checklist

```bash
# 1. Test Frontend
curl -I https://$CLOUDFRONT_URL
# Expected: HTTP/2 200

# 2. Test PDF Service Health
curl https://$CLOUDFRONT_URL/api/pdf/health
# Expected: {"status":"ok","message":"PDF service is running"}

# 3. Test in Browser
open https://$CLOUDFRONT_URL
```

**Manual Testing:**
1. Create an invoice
2. Generate PDF
3. Verify data saves to Supabase:
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM documents ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5;
   ```

---

## Part 7: Custom Domain (Optional, 20 minutes)

### If Using Route 53

```bash
DOMAIN="yourdomain.com"

# 1. Request SSL Certificate (ACM - us-east-1 required for CloudFront)
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --subject-alternative-names "www.$DOMAIN" \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' \
  --output text)

# 2. Get DNS validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# 3. Add CNAME record to Route 53 (replace with actual values from step 2)
HOSTED_ZONE_ID="YOUR_HOSTED_ZONE_ID"

cat > /tmp/dns-validation.json << 'EOF'
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "_xxxxx.yourdomain.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "_xxxxx.acm-validations.aws."}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/dns-validation.json

# 4. Wait for validation (5-30 minutes)
aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN \
  --region us-east-1

# 5. Update CloudFront distribution
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --distribution-config '{
    "Aliases": {
      "Quantity": 2,
      "Items": ["'$DOMAIN'", "www.'$DOMAIN'"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "'$CERT_ARN'",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    }
  }'

# 6. Create A record pointing to CloudFront
cat > /tmp/cloudfront-alias.json << 'EOF'
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "'$DOMAIN'",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "'$CLOUDFRONT_URL'",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/cloudfront-alias.json
```

---

## Part 8: Deployment Script for Updates

Create `deploy-aws.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying WIF Finance to AWS..."

# Load environment variables
source .env.production

# Get AWS account info
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="${BUCKET_NAME:-wif-finance-frontend-xxxxx}"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wif-pdf-service"
DISTRIBUTION_ID="${DISTRIBUTION_ID:-xxxxx}"

echo "📦 Building frontend..."
npm install
npm run build

echo "☁️  Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"

echo "🐳 Building PDF service Docker image..."
cd pdf-service
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI
docker build -t wif-pdf-service .
docker tag wif-pdf-service:latest $ECR_URI:latest
docker push $ECR_URI:latest
cd ..

echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --force-new-deployment \
  --region $AWS_REGION

echo "🌐 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

echo "✅ Deployment complete!"
echo "Frontend: https://$CLOUDFRONT_URL"
echo "PDF Service: https://$CLOUDFRONT_URL/api/pdf/health"
```

Make it executable:
```bash
chmod +x deploy-aws.sh
```

---

## Cost Optimization Tips

### 1. Use AWS Free Tier
- **S3**: 5GB storage, 20,000 GET requests/month (12 months)
- **CloudFront**: 50GB data transfer out/month (12 months)
- **ECR**: 500MB storage/month (always free)

### 2. Optimize ECS Costs
```bash
# Use smaller CPU/memory if possible
# Change in task definition:
"cpu": "256",      # Down from 512 (save ~50%)
"memory": "512",   # Down from 1024 (save ~50%)
```

### 3. Stop ECS During Off-Hours (Development)
```bash
# Stop service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --desired-count 0 \
  --region $AWS_REGION

# Start service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --desired-count 1 \
  --region $AWS_REGION
```

### 4. CloudFront Caching
- Frontend assets: 1 year cache
- API responses: No cache
- Reduces S3/ECS requests

---

## Monitoring & Maintenance

### CloudWatch Logs

```bash
# View ECS logs
aws logs tail /ecs/wif-pdf-service --follow --region $AWS_REGION

# View specific time range
aws logs tail /ecs/wif-pdf-service \
  --since 1h \
  --region $AWS_REGION
```

### CloudWatch Metrics

1. Go to CloudWatch → Metrics → All Metrics
2. Check:
   - ECS → CPUUtilization, MemoryUtilization
   - CloudFront → Requests, BytesDownloaded
   - S3 → NumberOfObjects, BucketSizeBytes

### Set Up Alarms

```bash
# Create alarm for ECS CPU > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name wif-pdf-high-cpu \
  --alarm-description "PDF service CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --region $AWS_REGION
```

---

## Troubleshooting

### Issue: CloudFront returns 403 Forbidden

**Solution:**
```bash
# Check S3 bucket policy
aws s3api get-bucket-policy --bucket $BUCKET_NAME

# Verify files exist
aws s3 ls s3://$BUCKET_NAME/

# Check CloudFront origin settings
aws cloudfront get-distribution --id $DISTRIBUTION_ID
```

### Issue: PDF service not responding

**Solution:**
```bash
# Check ECS service status
aws ecs describe-services \
  --cluster wif-finance-cluster \
  --services wif-pdf-service \
  --region $AWS_REGION

# Check task status
aws ecs describe-tasks \
  --cluster wif-finance-cluster \
  --tasks $TASK_ARN \
  --region $AWS_REGION

# Check logs
aws logs tail /ecs/wif-pdf-service --follow --region $AWS_REGION

# Restart service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --force-new-deployment \
  --region $AWS_REGION
```

### Issue: Supabase connection errors

**Solution:**
1. Check environment variables in `.env.production`
2. Verify Supabase project is active
3. Check Supabase API settings → RLS policies
4. Test connection:
   ```javascript
   // In browser console
   console.log(import.meta.env.VITE_SUPABASE_URL);
   ```

### Issue: ECS task keeps restarting

**Solution:**
```bash
# Check stopped tasks
aws ecs list-tasks \
  --cluster wif-finance-cluster \
  --desired-status STOPPED \
  --region $AWS_REGION

# Get task details and error
aws ecs describe-tasks \
  --cluster wif-finance-cluster \
  --tasks <task-arn> \
  --region $AWS_REGION

# Common fixes:
# 1. Increase memory/CPU in task definition
# 2. Check Docker image exists in ECR
# 3. Verify security group allows port 3001
```

---

## Next Steps

1. **Set up CI/CD**: GitHub Actions for automatic deployments
2. **Enable monitoring**: CloudWatch dashboards
3. **Backup strategy**: Supabase automatic backups + manual exports
4. **Performance**: Add CloudFront caching rules
5. **Security**: Enable RLS policies in Supabase
6. **Scaling**: Add auto-scaling to ECS service

---

## Summary

You now have:
- ✅ Frontend hosted on S3 + CloudFront
- ✅ PDF service running on ECS Fargate
- ✅ Database on Supabase (PostgreSQL)
- ✅ HTTPS enabled
- ✅ Global CDN (CloudFront)
- ✅ Cost: ~$6-12/month (with free tier)

**Your app is live at:** `https://$CLOUDFRONT_URL`
