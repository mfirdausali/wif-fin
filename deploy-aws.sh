#!/bin/bash
set -e

# WIF Finance - AWS Deployment Script
# This script deploys the frontend to S3 and PDF service to ECS

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 WIF Finance - AWS Deployment${NC}"
echo "=================================="

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ Error: .env.production not found${NC}"
    echo "Please create .env.production with required variables"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Configuration
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Error: AWS CLI not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

# Required variables
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}❌ Error: BUCKET_NAME not set in .env.production${NC}"
    exit 1
fi

if [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}⚠️  Warning: DISTRIBUTION_ID not set${NC}"
    echo "CloudFront cache invalidation will be skipped"
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wif-pdf-service"

echo ""
echo "Configuration:"
echo "  AWS Region: $AWS_REGION"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  ECR URI: $ECR_URI"
echo "  CloudFront Distribution: ${DISTRIBUTION_ID:-Not set}"
echo ""

# Prompt for confirmation
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Build frontend
echo ""
echo -e "${GREEN}📦 Step 1: Building frontend...${NC}"
npm install
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend build complete${NC}"

# Step 2: Upload to S3
echo ""
echo -e "${GREEN}☁️  Step 2: Uploading to S3...${NC}"

# Sync all files except index.html with long cache
aws s3 sync dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html" \
  --region $AWS_REGION

# Upload index.html with no cache
aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate" \
  --region $AWS_REGION

echo -e "${GREEN}✅ Frontend uploaded to S3${NC}"

# Step 3: Build and push PDF service Docker image
echo ""
echo -e "${GREEN}🐳 Step 3: Building PDF service Docker image...${NC}"

cd pdf-service

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build Docker image
echo "Building Docker image..."
docker build -t wif-pdf-service .

# Tag image
docker tag wif-pdf-service:latest $ECR_URI:latest

# Push to ECR
echo "Pushing to ECR..."
docker push $ECR_URI:latest

cd ..

echo -e "${GREEN}✅ PDF service image pushed to ECR${NC}"

# Step 4: Update ECS service
echo ""
echo -e "${GREEN}🔄 Step 4: Updating ECS service...${NC}"

aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --force-new-deployment \
  --region $AWS_REGION \
  --output text > /dev/null

echo -e "${GREEN}✅ ECS service update initiated${NC}"
echo "   New tasks will be deployed in 2-3 minutes"

# Step 5: Invalidate CloudFront cache
if [ ! -z "$DISTRIBUTION_ID" ]; then
    echo ""
    echo -e "${GREEN}🌐 Step 5: Invalidating CloudFront cache...${NC}"

    INVALIDATION_ID=$(aws cloudfront create-invalidation \
      --distribution-id $DISTRIBUTION_ID \
      --paths "/*" \
      --query 'Invalidation.Id' \
      --output text)

    echo -e "${GREEN}✅ CloudFront invalidation created: $INVALIDATION_ID${NC}"
    echo "   Cache will be cleared in 1-2 minutes"
else
    echo ""
    echo -e "${YELLOW}⚠️  Step 5: Skipping CloudFront invalidation (DISTRIBUTION_ID not set)${NC}"
fi

# Summary
echo ""
echo "=================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "Frontend: https://$(aws cloudfront list-distributions --query "DistributionList.Items[0].DomainName" --output text 2>/dev/null || echo $BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com)"
echo "PDF Service Health: https://$(aws cloudfront list-distributions --query "DistributionList.Items[0].DomainName" --output text 2>/dev/null)/api/pdf/health"
echo ""
echo "Next steps:"
echo "  1. Wait 2-3 minutes for ECS deployment"
echo "  2. Test PDF generation in your app"
echo "  3. Check logs: aws logs tail /ecs/wif-pdf-service --follow --region $AWS_REGION"
echo ""
