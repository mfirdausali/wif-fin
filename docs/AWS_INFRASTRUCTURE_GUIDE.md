# WIF Finance - AWS Infrastructure Guide

> **Single Source of Truth** for all AWS deployment, architecture, and operations.
> Last verified: 2026-03-03 | Region: ap-southeast-1 | Account: 387158738611

This document supersedes all previous deployment docs:
`AWS_DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_COMPLETE.md`, `PDF_DEPLOYMENT_GUIDE.md`,
`PDF_SERVICE_DEPLOYMENT_INFO.md`, `DEPLOYMENT_CHECKLIST.md`, `DEPLOY.md`,
`README_DEPLOYMENT.md`, `CLOUDFLARE_DNS_SETUP.md`, `AWS_QUICKSTART.md`,
`LINODE_DEPLOYMENT_GUIDE.md`, `CUSTOM_DOMAIN_SETUP.md`

---

## 1. Architecture Overview

```
                         finance.wifjapan.com
                                |
                          [Cloudflare DNS]
                           CNAME (DNS only)
                                |
                    [CloudFront CDN - E10R2ZLIGYCY0W]
                    d3iesx5hq3slg3.cloudfront.net
                     |                        |
            (default: /*)            (not used currently)
                     |
        [S3 - wif-finance-frontend-1763680224]
           Static React SPA (Vite build)


        PDF Service Request Flow:
        -------------------------
        Browser (VITE_PDF_SERVICE_URL)
                     |
        [API Gateway HTTP API - ytdes0sjr6]
        ytdes0sjr6.execute-api.ap-southeast-1.amazonaws.com
           Routes: GET /{proxy+}, POST /{proxy+}
                     |
           [HTTP_PROXY Integration]
                     |
           [ALB - wif-pdf-alb]
        wif-pdf-alb-1585597160.ap-southeast-1.elb.amazonaws.com
           Listener: port 80 -> Target Group
                     |
           [Target Group - wif-pdf-tg]
           Protocol: HTTP, Port: 3001
           Health Check: GET /health
                     |
           [ECS Fargate - wif-pdf-cluster]
           Service: wif-pdf-service
           Task: wif-pdf-service:3
           Container: wif-pdf-service (port 3001)
                     |
           [ECR Image - wif-pdf-service:latest]
           Node.js 20 + Puppeteer + Chromium
                     |
           [Supabase - fthkayaprkicvzgqeipq]
           Company info cache (5min TTL)
```

### Why This Architecture

| Layer | Purpose | Why Not Alternatives |
|-------|---------|---------------------|
| CloudFront | CDN for React SPA | Global edge caching, HTTPS, custom domain |
| S3 | Static file hosting | Cheapest for static files, no server needed |
| API Gateway | HTTPS entry point for PDF service | Managed TLS termination, CORS, throttling |
| ALB | Stable backend routing | Solves Fargate dynamic IP problem (tasks get new IPs on restart) |
| ECS Fargate | Run PDF service container | Serverless containers, no EC2 management |
| ECR | Docker image registry | Native AWS integration with ECS |

---

## 2. AWS Resource Inventory

### 2.1 Identifiers (Quick Reference)

| Resource | Identifier | Notes |
|----------|-----------|-------|
| **AWS Account** | `387158738611` | |
| **Region** | `ap-southeast-1` (Singapore) | All resources here |
| **VPC** | `vpc-0deabd00b7f800da2` | Default VPC, CIDR `172.31.0.0/16` |
| **S3 Bucket** | `wif-finance-frontend-1763680224` | Public read, website hosting |
| **CloudFront Dist** | `E10R2ZLIGYCY0W` | Domain: `d3iesx5hq3slg3.cloudfront.net` |
| **API Gateway** | `ytdes0sjr6` | HTTP API (not REST API) |
| **API Gateway (old)** | `b85hcbivc3` | Legacy, created 2025-12-08, unused |
| **ALB** | `wif-pdf-alb` | DNS: `wif-pdf-alb-1585597160.ap-southeast-1.elb.amazonaws.com` |
| **ALB ARN** | `arn:aws:elasticloadbalancing:ap-southeast-1:387158738611:loadbalancer/app/wif-pdf-alb/a53242daa8e7b45b` | |
| **Target Group** | `wif-pdf-tg` | ARN: `...targetgroup/wif-pdf-tg/3cf66e3d89dcd30c` |
| **ECS Cluster** | `wif-pdf-cluster` | NOT `wif-finance-cluster` (scripts had wrong name) |
| **ECS Service** | `wif-pdf-service` | 1 desired task, Fargate |
| **Task Definition** | `wif-pdf-service:3` | 0.5 vCPU, 1GB RAM |
| **ECR Repository** | `wif-pdf-service` | URI: `387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service` |
| **ECR (legacy)** | `wif-pdf-service-lambda` | Old Lambda approach, unused |
| **IAM Role** | `ecsTaskExecutionRole` | Policy: AmazonECSTaskExecutionRolePolicy |
| **CloudWatch Logs** | `/ecs/wif-pdf-service` | ~3.2MB stored |
| **SG (ECS tasks)** | `sg-067f9c3d9737bec7f` | Inbound: 3001 from ALB SG + 0.0.0.0/0 |
| **SG (ALB)** | `sg-0409ad7e49822bce9` | Inbound: 80 from 0.0.0.0/0 |
| **SSL Cert (pdf)** | `arn:aws:acm:ap-southeast-1:387158738611:certificate/9f63f6c9-d7b1-4b91-854f-a214994d90f0` | `pdf.wifjapan.com` |

### 2.2 Subnets

| Subnet ID | AZ | CIDR |
|-----------|----|------|
| `subnet-04758a6c5e7a9c0be` | ap-southeast-1a | 172.31.32.0/20 |
| `subnet-069ae3b207b82ef23` | ap-southeast-1b | 172.31.16.0/20 |
| `subnet-0f8c2766c04a5156a` | ap-southeast-1c | 172.31.0.0/20 |

### 2.3 Domains

| Domain | Points To | Provider | Proxy |
|--------|----------|----------|-------|
| `finance.wifjapan.com` | `d3iesx5hq3slg3.cloudfront.net` | Cloudflare | DNS only (grey cloud) |
| `pdf.wifjapan.com` | ALB DNS | Cloudflare | DNS only |

---

## 3. Environment Configuration

### 3.1 Production (.env.production)

```bash
# Supabase
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# PDF Service (API Gateway endpoint)
VITE_PDF_SERVICE_URL=https://ytdes0sjr6.execute-api.ap-southeast-1.amazonaws.com

# AWS (used by deploy scripts only, not bundled into frontend)
AWS_REGION=ap-southeast-1
BUCKET_NAME=wif-finance-frontend-1763680224
DISTRIBUTION_ID=E10R2ZLIGYCY0W
```

### 3.2 Local Development (.env or .env.local)

```bash
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_PDF_SERVICE_URL=http://localhost:3001
```

### 3.3 TypeScript Types (vite-env.d.ts)

```typescript
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PDF_SERVICE_URL: string
}
```

### 3.4 PDF Service Container Environment

Set in ECS task definition (not in .env):

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | Container port |
| `SUPABASE_URL` | (not set) | Optional: for fetching company info |
| `SUPABASE_ANON_KEY` | (not set) | Optional: falls back to defaults |
| `ALLOWED_ORIGINS` | (not set) | Uses hardcoded defaults in code |

---

## 4. Frontend Deployment (S3 + CloudFront)

### 4.1 How It Works

1. Vite builds React app to `dist/` with content-hashed filenames
2. All assets uploaded to S3 with 1-year cache (`max-age=31536000`)
3. `index.html` uploaded with no-cache (`max-age=0,no-cache,no-store,must-revalidate`)
4. CloudFront cache invalidated so users get new `index.html`
5. `index.html` references new hashed asset URLs -> cache-bust automatically

### 4.2 S3 Configuration

- **Website hosting**: Enabled (index: `index.html`, error: `index.html`)
- **Public access**: Unblocked, with public-read bucket policy
- **SPA routing**: Error document = `index.html` handles React Router paths

### 4.3 CloudFront Configuration

- **HTTPS enforcement**: Redirects HTTP to HTTPS
- **Custom domain**: `finance.wifjapan.com` via ACM certificate in `us-east-1`
- **Error pages**: 404 -> `/index.html` with 200 (SPA routing)
- **Compression**: Enabled (gzip)
- **Price class**: PriceClass_100 (all edge locations)

### 4.4 Quick Deploy (Frontend Only)

```bash
# Build and deploy frontend only (skip PDF service)
./deploy-frontend-only.sh
```

Or manually:

```bash
npm run build
aws s3 sync dist/ s3://wif-finance-frontend-1763680224/ \
  --delete --cache-control "max-age=31536000,public" --exclude "index.html"
aws s3 cp dist/index.html s3://wif-finance-frontend-1763680224/index.html \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"
aws cloudfront create-invalidation --distribution-id E10R2ZLIGYCY0W --paths "/*"
```

---

## 5. PDF Service Deployment (ECS Fargate)

### 5.1 Service Architecture

```
pdf-service/
├── Dockerfile          # Node.js 20-slim + Chromium + international fonts
├── package.json        # Express, Puppeteer, Supabase client, Helmet, CORS
├── src/
│   ├── index.js        # Express server (port 3001)
│   ├── supabaseClient.js  # Company info from Supabase (5min cache)
│   └── templates/
│       ├── invoice.js          # Invoice PDF template
│       ├── receipt.js          # Receipt PDF template
│       ├── paymentVoucher.js   # Payment voucher template
│       ├── statementOfPayment.js  # Statement of payment template
│       ├── bookingCard.js      # Booking card (per-category, combined/separate)
│       └── bookingForm.js      # Booking form (flexible pricing display)
```

### 5.2 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check (returns JSON status) |
| POST | `/api/pdf/invoice` | Generate invoice PDF |
| POST | `/api/pdf/receipt` | Generate receipt PDF |
| POST | `/api/pdf/payment-voucher` | Generate payment voucher PDF |
| POST | `/api/pdf/statement-of-payment` | Generate statement of payment PDF |
| POST | `/api/pdf/booking-card` | Generate booking card PDF(s) |
| POST | `/api/pdf/booking-form` | Generate booking form PDF |

### 5.3 Security & Middleware

| Feature | Configuration |
|---------|--------------|
| **Helmet** | Full HTTP security headers |
| **CORS** | Origins: `localhost:5173/5174`, `finance.wifjapan.com`, `d3iesx5hq3slg3.cloudfront.net` |
| **Rate Limit** | 100 requests / 15 minutes per IP on `/api/pdf/*` |
| **Body Limit** | 10MB JSON payload max |
| **Credentials** | `credentials: true` on CORS |

### 5.4 Puppeteer Configuration

- **Browser reuse**: Single instance, shared across requests
- **Crash recovery**: Auto-resets browser if disconnected
- **Viewport**: 1200x16000px (tall for pagination)
- **Wait strategy**: `networkidle0` + 1s render delay
- **Timeout**: 60s for content loading, 120s protocol timeout
- **Chrome args**: `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage`
- **Fonts**: Japanese (IPAfont), Chinese (WenQuanYi), Thai, Arabic, Latin

### 5.5 Docker Image

```dockerfile
FROM node:20-slim
# Installs: chromium, international fonts, libxss1
# ENV: PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# HEALTHCHECK: HTTP GET localhost:3001/health (30s interval, 40s start period)
# CMD: node src/index.js
```

### 5.6 ECS Task Definition (wif-pdf-service:3)

| Setting | Value |
|---------|-------|
| CPU | 512 (0.5 vCPU) |
| Memory | 1024 MB |
| Network Mode | awsvpc |
| Launch Type | FARGATE |
| Container Port | 3001 |
| Log Driver | awslogs -> `/ecs/wif-pdf-service` |
| Image | `387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service:latest` |

### 5.7 Deploying PDF Service Updates

```bash
# Full deployment (frontend + PDF service)
./deploy-aws.sh

# Or manually update just the PDF service:
cd pdf-service
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin 387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service
docker build -t wif-pdf-service .
docker tag wif-pdf-service:latest 387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service:latest
docker push 387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service:latest
cd ..
aws ecs update-service --cluster wif-pdf-cluster --service wif-pdf-service --force-new-deployment --region ap-southeast-1
```

---

## 6. API Gateway & ALB (Request Routing)

### 6.1 Why Both API Gateway AND ALB?

| Problem | Solution |
|---------|----------|
| Fargate tasks get new IPs on every restart | ALB provides stable DNS endpoint |
| Need managed HTTPS/CORS for PDF service | API Gateway handles TLS + CORS |
| Hardcoded IPs caused 503 errors | ALB auto-routes to healthy tasks |

**Request flow**: `Browser -> API Gateway (HTTPS, CORS) -> ALB (stable routing) -> Fargate task (dynamic IP)`

### 6.2 API Gateway (ytdes0sjr6)

- **Type**: HTTP API (not REST API)
- **Stage**: `$default` (auto-deploy enabled)
- **Routes**: `GET /{proxy+}` and `POST /{proxy+}` -> integration `6yk5p8l`
- **Integration**: HTTP_PROXY to ALB DNS, 30s timeout
- **CORS**: finance.wifjapan.com, localhost:5173/5174

### 6.3 ALB (wif-pdf-alb)

- **Listener**: Port 80 HTTP -> forward to target group
- **Target Group**: `wif-pdf-tg`, type=IP, port=3001
- **Health Check**: GET `/health`, interval 30s, healthy threshold 2, unhealthy threshold 3
- **Security Group**: `sg-0409ad7e49822bce9` (inbound port 80)

### 6.4 Historical Context

The infrastructure evolved through several iterations:

1. **v1 (Dec 2025)**: Direct EC2 IP (`3.1.49.180:3001`) -> broke when instance changed
2. **v2 (Jan 2026)**: API Gateway -> hardcoded Fargate IP (`13.212.195.131:3001`) -> broke on task restart
3. **v3 (Mar 2026)**: API Gateway -> ALB -> ECS Fargate -> **stable, auto-healing**

Legacy resources still exist:
- Old API Gateway `b85hcbivc3` (Dec 2025) - can be deleted
- Old ECR repo `wif-pdf-service-lambda` (Dec 2025) - from Lambda experiment, can be deleted

---

## 7. Networking & Security

### 7.1 Security Groups

**ALB Security Group** (`sg-0409ad7e49822bce9` / `wif-pdf-alb-sg`):
```
Inbound:  TCP 80 from 0.0.0.0/0
Outbound: All traffic
```

**ECS Task Security Group** (`sg-067f9c3d9737bec7f` / `wif-pdf-service-sg`):
```
Inbound:  TCP 3001 from sg-0409ad7e49822bce9 (ALB)
          TCP 3001 from 0.0.0.0/0 (legacy, can restrict)
          TCP 443  from 0.0.0.0/0
Outbound: All traffic
```

### 7.2 Network Path

```
Internet -> API Gateway (AWS-managed, no VPC)
         -> ALB (public, in VPC default subnets across 3 AZs)
         -> ECS Fargate task (public IP enabled, in same subnets)
```

### 7.3 DNS Resolution

```
finance.wifjapan.com
  -> Cloudflare CNAME (DNS only, NOT proxied)
  -> d3iesx5hq3slg3.cloudfront.net
  -> CloudFront edge -> S3 bucket

API Gateway endpoint (used by frontend JS):
  ytdes0sjr6.execute-api.ap-southeast-1.amazonaws.com
  -> API Gateway -> ALB -> ECS
```

---

## 8. Deployment Scripts

### 8.1 Script Inventory

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `deploy-aws.sh` | **Full deployment** (frontend + PDF service) | Regular deployments |
| `deploy-frontend-only.sh` | Frontend only (S3 + CloudFront) | UI-only changes |
| `deploy-full.sh` | Everything including Supabase check | Fresh/complete deployments |
| `aws-setup.sh` | One-time infrastructure creation | Initial setup only |
| `aws-setup-continue.sh` | Resume setup after Docker available | If setup was interrupted |
| `setup-fargate-https.sh` | Create ALB + SSL for PDF service | One-time HTTPS setup |
| `setup-custom-domain.sh` | Custom domain + ACM certificate | Domain configuration |
| `setup-cloudfront-simple.sh` | Simple CloudFront creation | Alternative CF setup |
| `setup-pdf-cloudfront.sh` | CloudFront for PDF service | Legacy (not used with ALB) |

### 8.2 deploy-aws.sh (Primary Script)

This is the main deployment script. Steps:

1. Load `.env.production` variables
2. Verify AWS CLI configured, required variables set
3. Build frontend (`npm run build`)
4. Upload to S3 (assets: 1yr cache, index.html: no-cache)
5. Build PDF service Docker image
6. Push to ECR
7. Update ECS service (`--force-new-deployment`)
8. Wait for ECS stability (`ecs wait services-stable`)
9. Verify ALB target health
10. Verify API Gateway health endpoint
11. Invalidate CloudFront cache

### 8.3 Key Configuration in deploy-aws.sh

```bash
AWS_REGION="ap-southeast-1"
ECS_CLUSTER="wif-pdf-cluster"
ECS_SERVICE="wif-pdf-service"
API_GATEWAY_ID="ytdes0sjr6"
ALB_DNS="wif-pdf-alb-1585597160.ap-southeast-1.elb.amazonaws.com"
```

---

## 9. Frontend Integration

### 9.1 PdfService Client (services/pdfService.ts)

```typescript
const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
```

The frontend uses a static `PdfService` class that:
- Sends document/booking data as JSON POST to the API Gateway endpoint
- Receives binary PDF blobs for download
- Handles both single PDF and multiple PDF (base64 JSON) responses
- Lazy-loaded via dynamic `import()` for code splitting

### 9.2 Components Using PDF Service

| Component | Function | Endpoint |
|-----------|----------|----------|
| `DocumentList.tsx` | `handleDownloadPDF()` | `/api/pdf/{invoice,receipt,payment-voucher,statement-of-payment}` |
| `BookingList.tsx` | `handlePrint()` | `/api/pdf/booking-card` |
| `BookingList.tsx` | `handleFormPrint()` | `/api/pdf/booking-form` |
| `BookingForm.tsx` | `handleFormPrint()` | `/api/pdf/booking-form` |

### 9.3 Print Dialogs

- **BookingPrintDialog.tsx**: Category selection for booking cards (with security confirmation for pricing)
- **BookingFormPrintDialog.tsx**: Pricing display options (none/internal/b2b/both with confirmation)

### 9.4 WhatsApp Service Integration

The WhatsApp bot (`whatsapp-service/`) also calls the PDF service:
- Transforms Supabase snake_case to camelCase before sending
- Uses same endpoints as frontend
- Runs locally (not on AWS), connects to PDF service via URL

---

## 10. Monitoring & Troubleshooting

### 10.1 Health Checks

```bash
# Full chain: API Gateway -> ALB -> ECS
curl https://ytdes0sjr6.execute-api.ap-southeast-1.amazonaws.com/health

# ALB -> ECS directly
curl http://wif-pdf-alb-1585597160.ap-southeast-1.elb.amazonaws.com/health

# Expected response:
# {"status":"ok","service":"pdf-generator","timestamp":"..."}
```

### 10.2 View Logs

```bash
# Stream live logs
aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1

# Last 50 log events
aws logs tail /ecs/wif-pdf-service --region ap-southeast-1 --since 1h
```

### 10.3 Check ECS Service Status

```bash
# Service overview
aws ecs describe-services --cluster wif-pdf-cluster --services wif-pdf-service \
  --region ap-southeast-1 \
  --query 'services[0].{status:status,desired:desiredCount,running:runningCount,pending:pendingCount}'

# Running tasks
aws ecs list-tasks --cluster wif-pdf-cluster --service-name wif-pdf-service --region ap-southeast-1
```

### 10.4 Check ALB Target Health

```bash
aws elbv2 describe-target-health \
  --target-group-arn "arn:aws:elasticloadbalancing:ap-southeast-1:387158738611:targetgroup/wif-pdf-tg/3cf66e3d89dcd30c" \
  --region ap-southeast-1 \
  --query 'TargetHealthDescriptions[*].{IP:Target.Id,Health:TargetHealth.State}'
```

### 10.5 Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| **503 from API Gateway** | ALB targets unhealthy or no targets | Check ECS task status, view CloudWatch logs |
| **CORS error in browser** | Origin not in CORS list | Add origin to `pdf-service/src/index.js` CORS config AND API Gateway CORS |
| **PDF timeout** | Puppeteer taking too long | Check CloudWatch logs for specific error, may need more memory |
| **CloudFront serving old content** | Cache not invalidated | Run `aws cloudfront create-invalidation --distribution-id E10R2ZLIGYCY0W --paths "/*"` |
| **ECS task keeps restarting** | Container crashing | Check CloudWatch logs, may be OOM (increase task memory) |
| **Cannot push to ECR** | Login expired | Re-run `aws ecr get-login-password ... \| docker login ...` |

### 10.6 Force Restart PDF Service

```bash
aws ecs update-service --cluster wif-pdf-cluster --service wif-pdf-service \
  --force-new-deployment --region ap-southeast-1
```

---

## 11. Cost Breakdown

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| S3 | ~$0.50 | Static files, minimal storage |
| CloudFront | ~$5-10 | Depends on traffic volume |
| ECS Fargate (0.5 vCPU, 1GB) | ~$15-20 | Always-on single task |
| ALB | ~$16-22 | Minimum charge + LCU hours |
| API Gateway | ~$1-3 | Per-request pricing |
| ECR | ~$0.10 | Image storage |
| CloudWatch Logs | ~$0.50 | Log ingestion + storage |
| **Total** | **~$38-56/month** | |

### Cost Optimization Options

- **Reduce ECS to 0.25 vCPU / 512MB**: Saves ~$8/month (test if Puppeteer fits)
- **Remove ALB, use Cloud Map + VPC Link**: Saves ~$16/month (more complex)
- **Use Lambda for PDF generation**: Pay-per-request, better for low traffic
- **Schedule ECS to scale to 0 overnight**: Saves ~30% on compute

---

## 12. Cleanup Checklist (Legacy Resources)

These resources are from previous architecture iterations and can be safely removed:

| Resource | ID/Name | Reason |
|----------|---------|--------|
| API Gateway (old) | `b85hcbivc3` | Replaced by `ytdes0sjr6` |
| ECR Repository | `wif-pdf-service-lambda` | From Lambda experiment |
| Unused setup scripts | `setup-pdf-nginx.sh`, `setup-pdf-https.sh` | Never used or superseded |
| Old deployment docs | 10+ scattered .md files | Superseded by this document |

```bash
# Delete old API Gateway
aws apigatewayv2 delete-api --api-id b85hcbivc3 --region ap-southeast-1

# Delete old ECR repository (empty it first)
aws ecr delete-repository --repository-name wif-pdf-service-lambda --region ap-southeast-1 --force
```

---

## 13. Initial Setup (From Scratch)

If you need to recreate the entire infrastructure:

### Step 1: Prerequisites

```bash
# Install AWS CLI
brew install awscli

# Configure credentials
aws configure
# Region: ap-southeast-1
# Output: json

# Install Docker
brew install --cask docker

# Verify
aws sts get-caller-identity
docker info
```

### Step 2: Create S3 Bucket

```bash
BUCKET_NAME="wif-finance-frontend-$(date +%s)"

aws s3 mb s3://$BUCKET_NAME --region ap-southeast-1
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html
aws s3api put-public-access-block --bucket $BUCKET_NAME \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Apply bucket policy (public read)
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
  }]
}
EOF
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json
```

### Step 3: Create CloudFront Distribution

```bash
# Request SSL certificate (must be us-east-1 for CloudFront)
aws acm request-certificate --domain-name finance.wifjapan.com \
  --validation-method DNS --region us-east-1

# Add DNS validation CNAME in Cloudflare, then create distribution
# (Use AWS Console for CloudFront - easier for initial setup)
```

### Step 4: Create ECR + ECS Infrastructure

```bash
# ECR
aws ecr create-repository --repository-name wif-pdf-service --region ap-southeast-1

# ECS Cluster
aws ecs create-cluster --cluster-name wif-pdf-cluster --region ap-southeast-1

# IAM Role
aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# CloudWatch Log Group
aws logs create-log-group --log-group-name /ecs/wif-pdf-service --region ap-southeast-1

# Build and push Docker image
cd pdf-service
ECR_URI="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service"
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ECR_URI
docker build -t wif-pdf-service .
docker tag wif-pdf-service:latest $ECR_URI:latest
docker push $ECR_URI:latest
cd ..
```

### Step 5: Create ALB + Target Group

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text --region ap-southeast-1)
SUBNETS=$(aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" --query 'Subnets[*].SubnetId' --output text --region ap-southeast-1)

# ALB Security Group
ALB_SG=$(aws ec2 create-security-group --group-name wif-pdf-alb-sg \
  --description "ALB for PDF service" --vpc-id $VPC_ID --region ap-southeast-1 --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0 --region ap-southeast-1

# Target Group
TG_ARN=$(aws elbv2 create-target-group --name wif-pdf-tg --protocol HTTP --port 3001 \
  --vpc-id $VPC_ID --target-type ip --health-check-path /health \
  --region ap-southeast-1 --query 'TargetGroups[0].TargetGroupArn' --output text)

# ALB
ALB_ARN=$(aws elbv2 create-load-balancer --name wif-pdf-alb --subnets $SUBNETS \
  --security-groups $ALB_SG --scheme internet-facing --type application \
  --region ap-southeast-1 --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Listener
aws elbv2 create-listener --load-balancer-arn $ALB_ARN --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN --region ap-southeast-1
```

### Step 6: Create ECS Task + Service

```bash
# Register task definition (create /tmp/task-definition.json first)
aws ecs register-task-definition --cli-input-json file:///tmp/task-definition.json --region ap-southeast-1

# ECS Security Group
ECS_SG=$(aws ec2 create-security-group --group-name wif-pdf-service-sg \
  --description "ECS PDF service" --vpc-id $VPC_ID --region ap-southeast-1 --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 3001 \
  --source-group $ALB_SG --region ap-southeast-1

# Create service with ALB
SUBNET_LIST=$(echo $SUBNETS | tr ' ' ',')
aws ecs create-service --cluster wif-pdf-cluster --service-name wif-pdf-service \
  --task-definition wif-pdf-service --desired-count 1 --launch-type FARGATE \
  --load-balancers targetGroupArn=$TG_ARN,containerName=wif-pdf-service,containerPort=3001 \
  --health-check-grace-period-seconds 60 \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$ECS_SG],assignPublicIp=ENABLED}" \
  --region ap-southeast-1
```

### Step 7: Create API Gateway

```bash
# Create HTTP API with CORS
API_ID=$(aws apigatewayv2 create-api --name wif-pdf-service-api --protocol-type HTTP \
  --cors-configuration AllowOrigins="https://finance.wifjapan.com,http://localhost:5173",AllowMethods="GET,POST,OPTIONS",AllowHeaders="content-type,authorization",MaxAge=86400 \
  --region ap-southeast-1 --query 'ApiId' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers --names wif-pdf-alb --region ap-southeast-1 --query 'LoadBalancers[0].DNSName' --output text)

# Create integration pointing to ALB
INT_ID=$(aws apigatewayv2 create-integration --api-id $API_ID \
  --integration-type HTTP_PROXY --integration-method ANY \
  --integration-uri "http://$ALB_DNS/{proxy}" --payload-format-version 1.0 \
  --region ap-southeast-1 --query 'IntegrationId' --output text)

# Create routes
aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /{proxy+}" --target "integrations/$INT_ID" --region ap-southeast-1
aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /{proxy+}" --target "integrations/$INT_ID" --region ap-southeast-1

# Create default stage with auto-deploy
aws apigatewayv2 create-stage --api-id $API_ID --stage-name '$default' --auto-deploy --region ap-southeast-1

echo "API Gateway: https://$API_ID.execute-api.ap-southeast-1.amazonaws.com"
```

### Step 8: Update .env.production

```bash
cat > .env.production << EOF
VITE_SUPABASE_URL=https://fthkayaprkicvzgqeipq.supabase.co
VITE_SUPABASE_ANON_KEY=<your-key>
VITE_PDF_SERVICE_URL=https://$API_ID.execute-api.ap-southeast-1.amazonaws.com
AWS_REGION=ap-southeast-1
BUCKET_NAME=$BUCKET_NAME
DISTRIBUTION_ID=<your-cloudfront-distribution-id>
EOF
```

### Step 9: Deploy

```bash
./deploy-aws.sh
```

---

## 14. Appendix

### A. AWS CLI Quick Reference

```bash
# ECS
aws ecs list-clusters --region ap-southeast-1
aws ecs describe-services --cluster wif-pdf-cluster --services wif-pdf-service --region ap-southeast-1
aws ecs list-tasks --cluster wif-pdf-cluster --region ap-southeast-1
aws ecs update-service --cluster wif-pdf-cluster --service wif-pdf-service --force-new-deployment --region ap-southeast-1

# Logs
aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1

# ALB
aws elbv2 describe-target-health --target-group-arn "arn:aws:elasticloadbalancing:ap-southeast-1:387158738611:targetgroup/wif-pdf-tg/3cf66e3d89dcd30c" --region ap-southeast-1

# CloudFront
aws cloudfront create-invalidation --distribution-id E10R2ZLIGYCY0W --paths "/*"

# ECR
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service

# API Gateway
aws apigatewayv2 get-integrations --api-id ytdes0sjr6 --region ap-southeast-1
```

### B. PDF Service Request/Response Format

**Request (all PDF endpoints):**
```json
{
  "invoice|receipt|paymentVoucher|statementOfPayment|booking": { "...document data" },
  "companyInfo": { "name": "...", "registrationNo": "...", "registeredOffice": "..." },
  "printerInfo": { "userName": "John", "printDate": "2026-03-03T10:00:00Z", "timezone": "Asia/Kuala_Lumpur" }
}
```

**Response (success):**
- Content-Type: `application/pdf`
- Body: Binary PDF data

**Response (booking card, separate mode):**
```json
{
  "pdfs": [
    { "category": "transportation", "filename": "booking-card-WIF001-transportation.pdf", "data": "<base64>" }
  ]
}
```

**Response (error):**
```json
{ "error": "Receipt data is required", "message": "..." }
```

### C. Company Info Priority Chain (PDF Service)

1. **Request body** `companyInfo` (if all 5 fields present)
2. **Supabase** `companies` table (id: `c0000000-0000-0000-0000-000000000001`, cached 5min)
3. **Hardcoded defaults** in `supabaseClient.js`

### D. Pricing Display Modes (Booking Form)

| Mode | What Shows | Watermark |
|------|-----------|-----------|
| `none` | No pricing | None |
| `internal` | Internal cost prices | "INTERNAL USE ONLY" |
| `b2b` | B2B partner prices | "B2B PRICING" |
| `both` | Both + profit margin | "CONFIDENTIAL" |
