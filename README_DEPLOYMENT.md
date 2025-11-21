# WIF Finance - AWS Deployment

Complete deployment solution for AWS with Supabase backend.

---

## Quick Start

**Total Time:** ~30 minutes
**Cost:** ~$15-20/month with AWS free tier

### Prerequisites
```bash
# Install dependencies
brew install awscli     # macOS
npm install -g aws-cli  # or download from aws.amazon.com/cli

# Configure AWS
aws configure
```

### 1-Command Setup
```bash
# Run automated setup
./aws-setup.sh

# Then deploy
./deploy-aws.sh
```

**Done!** Your app is now live on AWS.

---

## Documentation Files

| File | Purpose | When to Use |
|------|---------|-------------|
| **AWS_QUICKSTART.md** | 30-minute quick start guide | First-time deployment |
| **AWS_DEPLOYMENT_GUIDE.md** | Complete step-by-step guide | Detailed setup & troubleshooting |
| **DEPLOYMENT_CHECKLIST.md** | Interactive checklist | Track deployment progress |
| **DATABASE_SCHEMA.md** | Supabase database schema | Database setup & reference |

---

## Deployment Scripts

### `aws-setup.sh` - Initial Infrastructure Setup
**What it does:**
- Creates S3 bucket for frontend
- Creates ECR repository for Docker images
- Creates ECS Fargate cluster and service
- Builds and pushes PDF service Docker image
- Sets up security groups and IAM roles
- Creates CloudWatch log groups
- Generates `.env.production` file

**Run once:** During initial setup

```bash
./aws-setup.sh
```

### `deploy-aws.sh` - Update Deployment
**What it does:**
- Builds React frontend
- Uploads to S3
- Rebuilds PDF service Docker image
- Pushes to ECR
- Updates ECS service
- Invalidates CloudFront cache

**Run every time:** After code changes

```bash
./deploy-aws.sh
```

---

## Architecture

```
User
  ↓
CloudFront CDN (HTTPS)
  ├─→ S3 Bucket (React Frontend)
  └─→ ECS Fargate (PDF Service)
        ↓
      Supabase (PostgreSQL)
```

**Components:**
- **S3 + CloudFront:** Static frontend hosting with global CDN
- **ECS Fargate:** Containerized PDF service (Node.js + Puppeteer)
- **Supabase:** PostgreSQL database, authentication, storage

---

## Cost Breakdown

### With AWS Free Tier (First 12 months)
| Service | Free Tier | Monthly Cost |
|---------|-----------|--------------|
| S3 | 5GB storage | **$0** |
| CloudFront | 50GB transfer | **$0** |
| ECS Fargate | None | **$15-20** |
| ECR | 500MB (always free) | **$0** |
| Route 53 | None | $0.50 |
| **Total** | | **~$15-20** |

### After Free Tier
| Service | Monthly Cost |
|---------|--------------|
| S3 | $0.50-1 |
| CloudFront | $5-10 |
| ECS Fargate | $15-20 |
| ECR | $0 |
| Route 53 | $0.50 |
| **Total** | **~$25-35** |

**Supabase:** Free tier (500MB DB, 2GB bandwidth) - $0/month

---

## Environment Variables

### Required for Local Development (`.env.local`)
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_PDF_SERVICE_URL=http://localhost:3001
```

### Required for Production (`.env.production`)
```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# PDF Service
VITE_PDF_SERVICE_URL=https://dxxxxx.cloudfront.net/api/pdf

# AWS Deployment
AWS_REGION=ap-southeast-1
BUCKET_NAME=wif-finance-frontend-xxxxx
DISTRIBUTION_ID=EXXXXXXXXXXXXX
```

**Get Supabase credentials:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy Project URL and anon public key

---

## Common Commands

### Deploy Updates
```bash
# Full deployment
./deploy-aws.sh

# Frontend only
npm run build
aws s3 sync dist/ s3://$BUCKET_NAME/ --delete
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

# Backend only (PDF service)
cd pdf-service
docker build -t wif-pdf-service .
docker tag wif-pdf-service:latest $ECR_URI:latest
docker push $ECR_URI:latest
aws ecs update-service --cluster wif-finance-cluster --service wif-pdf-service --force-new-deployment
```

### Monitor Logs
```bash
# Follow PDF service logs
aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1

# View specific time range
aws logs tail /ecs/wif-pdf-service --since 1h --region ap-southeast-1
```

### Check Status
```bash
# ECS service status
aws ecs describe-services \
  --cluster wif-finance-cluster \
  --services wif-pdf-service \
  --region ap-southeast-1

# ECS task status
aws ecs list-tasks \
  --cluster wif-finance-cluster \
  --service-name wif-pdf-service \
  --region ap-southeast-1

# CloudFront distribution status
aws cloudfront list-distributions \
  --query "DistributionList.Items[0].{Domain:DomainName,Status:Status}"
```

### Cost Management (Development)
```bash
# Stop ECS service to save money
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --desired-count 0 \
  --region ap-southeast-1

# Start ECS service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --desired-count 1 \
  --region ap-southeast-1
```

---

## Troubleshooting

### Frontend not loading (403/404)
**Check:**
1. S3 bucket policy allows public read
2. CloudFront origin points to correct bucket
3. Files uploaded to S3: `aws s3 ls s3://$BUCKET_NAME/`

**Fix:**
```bash
./deploy-aws.sh  # Re-deploy
```

### PDF service not responding (502)
**Check:**
1. ECS task is running: `aws ecs list-tasks --cluster wif-finance-cluster`
2. Security group allows port 3001
3. CloudFront behavior for `/api/pdf/*` exists

**Fix:**
```bash
# Restart ECS service
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --force-new-deployment \
  --region ap-southeast-1

# Check logs
aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1
```

### Supabase connection error
**Check:**
1. Environment variables set correctly
2. Supabase project is active
3. RLS policies allow access

**Fix:**
```bash
# Verify environment
cat .env.production | grep SUPABASE

# Test in browser console
console.log(import.meta.env.VITE_SUPABASE_URL);
```

### Build errors
**Check:**
1. Node version >= 18
2. All dependencies installed
3. TypeScript errors: `npm run build`

**Fix:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## Rollback Procedure

### Frontend Rollback
```bash
# If you have backup
aws s3 sync s3://backup-bucket/ s3://$BUCKET_NAME/
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

### Backend Rollback
```bash
# Rollback to previous task definition revision
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --task-definition wif-pdf-service:PREVIOUS_REVISION \
  --region ap-southeast-1
```

---

## Security Best Practices

### Before Production
- [ ] Enable RLS in Supabase
- [ ] Set up authentication
- [ ] Restrict CORS origins
- [ ] Use AWS Secrets Manager for sensitive env vars
- [ ] Enable CloudTrail for audit logs
- [ ] Set up AWS WAF on CloudFront
- [ ] Enable MFA on AWS account

### Environment Variables
- [ ] Never commit `.env.local` or `.env.production`
- [ ] Use AWS Secrets Manager for production
- [ ] Rotate Supabase keys regularly

---

## Next Steps

### Immediate
1. Complete deployment using `AWS_QUICKSTART.md`
2. Test all features thoroughly
3. Set up monitoring and alerts

### Short-term (1-2 weeks)
1. Add custom domain to CloudFront
2. Set up SSL certificate (AWS Certificate Manager)
3. Configure automated backups
4. Implement proper authentication

### Long-term (1-2 months)
1. Set up CI/CD pipeline (GitHub Actions)
2. Implement auto-scaling for ECS
3. Add CloudWatch dashboards
4. Set up multi-region deployment (optional)
5. Implement caching strategies

---

## Support & Resources

### Documentation
- AWS CLI: https://docs.aws.amazon.com/cli/
- ECS Fargate: https://docs.aws.amazon.com/ecs/
- CloudFront: https://docs.aws.amazon.com/cloudfront/
- Supabase: https://supabase.com/docs

### Cost Optimization
- AWS Free Tier: https://aws.amazon.com/free/
- AWS Pricing Calculator: https://calculator.aws/
- Supabase Pricing: https://supabase.com/pricing

### Monitoring
- CloudWatch: https://console.aws.amazon.com/cloudwatch/
- ECS Dashboard: https://console.aws.amazon.com/ecs/
- Supabase Dashboard: https://supabase.com/dashboard

---

## File Structure

```
wif-fin/
├── lib/
│   └── supabase.ts              # Supabase client configuration
├── types/
│   └── database.ts              # TypeScript types for database
├── aws-setup.sh                 # Initial AWS infrastructure setup
├── deploy-aws.sh                # Deployment script for updates
├── .env.example                 # Environment variable template
├── .env.local                   # Local development (not committed)
├── .env.production              # Production config (not committed)
├── AWS_QUICKSTART.md            # 30-minute quick start
├── AWS_DEPLOYMENT_GUIDE.md      # Complete deployment guide
├── DEPLOYMENT_CHECKLIST.md      # Interactive checklist
├── DATABASE_SCHEMA.md           # Supabase schema definition
└── README_DEPLOYMENT.md         # This file
```

---

## Summary

You have everything needed to deploy WIF Finance to AWS:

✅ **Automated setup scripts**
✅ **Complete documentation**
✅ **Supabase integration**
✅ **Cost-optimized architecture**
✅ **Production-ready configuration**

**Start here:** `AWS_QUICKSTART.md`

**Questions?** Check `AWS_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

**Deployment Status:**
- [ ] Not started
- [ ] In progress
- [ ] Deployed to development
- [ ] Deployed to production
- [ ] Verified and tested

**Last Updated:** 2025-11-20
