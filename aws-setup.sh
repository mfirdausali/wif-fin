#!/bin/bash
set -e

# WIF Finance - AWS Initial Setup Script
# This script creates all AWS resources needed for deployment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🏗️  WIF Finance - AWS Infrastructure Setup${NC}"
echo "============================================="
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker not installed${NC}"
    echo "Install it from: https://www.docker.com/"
    exit 1
fi

# Get AWS configuration
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Error: AWS CLI not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

echo "AWS Configuration:"
echo "  Account ID: $AWS_ACCOUNT_ID"
echo "  Region: $AWS_REGION"
echo ""

# Generate unique bucket name
TIMESTAMP=$(date +%s)
BUCKET_NAME="wif-finance-frontend-$TIMESTAMP"

echo "Resources to be created:"
echo "  - S3 Bucket: $BUCKET_NAME"
echo "  - ECR Repository: wif-pdf-service"
echo "  - ECS Cluster: wif-finance-cluster"
echo "  - ECS Task Definition: wif-pdf-service"
echo "  - ECS Service: wif-pdf-service"
echo "  - CloudFront Distribution"
echo "  - Security Group: wif-pdf-service-sg"
echo "  - IAM Role: ecsTaskExecutionRole"
echo "  - CloudWatch Log Group: /ecs/wif-pdf-service"
echo ""

# Prompt for Supabase credentials
echo -e "${BLUE}📋 Please provide your Supabase credentials:${NC}"
read -p "Supabase URL: " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Error: Supabase credentials are required${NC}"
    exit 1
fi

echo ""
read -p "Continue with setup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled"
    exit 0
fi

# Step 1: Create S3 Bucket
echo ""
echo -e "${GREEN}📦 Step 1: Creating S3 bucket...${NC}"

aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION

# Configure for static website hosting
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html

# Disable block public access FIRST (must be done before applying public policy)
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Create bucket policy
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

echo -e "${GREEN}✅ S3 bucket created: $BUCKET_NAME${NC}"

# Step 2: Create ECR Repository
echo ""
echo -e "${GREEN}🐳 Step 2: Creating ECR repository...${NC}"

aws ecr create-repository \
  --repository-name wif-pdf-service \
  --region $AWS_REGION \
  --output text > /dev/null || echo "Repository may already exist"

ECR_URI=$(aws ecr describe-repositories \
  --repository-names wif-pdf-service \
  --region $AWS_REGION \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo -e "${GREEN}✅ ECR repository ready: $ECR_URI${NC}"

# Step 3: Create ECS Cluster
echo ""
echo -e "${GREEN}🖥️  Step 3: Creating ECS cluster...${NC}"

aws ecs create-cluster \
  --cluster-name wif-finance-cluster \
  --region $AWS_REGION \
  --output text > /dev/null || echo "Cluster may already exist"

echo -e "${GREEN}✅ ECS cluster created${NC}"

# Step 4: Create IAM Role for ECS
echo ""
echo -e "${GREEN}🔐 Step 4: Creating IAM execution role...${NC}"

# Create role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null || echo "Role may already exist"

# Attach policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  2>/dev/null || true

echo -e "${GREEN}✅ IAM role configured${NC}"

# Step 5: Create CloudWatch Log Group
echo ""
echo -e "${GREEN}📊 Step 5: Creating CloudWatch log group...${NC}"

aws logs create-log-group \
  --log-group-name /ecs/wif-pdf-service \
  --region $AWS_REGION 2>/dev/null || echo "Log group may already exist"

echo -e "${GREEN}✅ CloudWatch log group created${NC}"

# Step 6: Build and Push Docker Image
echo ""
echo -e "${GREEN}🏗️  Step 6: Building and pushing PDF service image...${NC}"

cd pdf-service

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build
docker build -t wif-pdf-service .

# Tag
docker tag wif-pdf-service:latest $ECR_URI:latest

# Push
docker push $ECR_URI:latest

cd ..

echo -e "${GREEN}✅ Docker image pushed to ECR${NC}"

# Step 7: Create Security Group
echo ""
echo -e "${GREEN}🔒 Step 7: Creating security group...${NC}"

# Get default VPC
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
  --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=wif-pdf-service-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $AWS_REGION)

# Allow inbound on port 3001
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3001 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION 2>/dev/null || echo "Rule may already exist"

echo -e "${GREEN}✅ Security group created: $SG_ID${NC}"

# Step 8: Create placeholder CloudFront distribution (will be updated later)
echo ""
echo -e "${GREEN}🌐 Step 8: Creating CloudFront distribution...${NC}"
echo "   This will take 5-10 minutes..."

CLOUDFRONT_URL="https://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"

# Create temporary distribution config
cat > /tmp/cloudfront-config.json << EOF
{
  "CallerReference": "wif-finance-$TIMESTAMP",
  "Comment": "WIF Finance Frontend",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "wif-s3-origin",
        "DomainName": "$BUCKET_NAME.s3.$AWS_REGION.amazonaws.com",
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

# Note: CloudFormation would be better for this, but using CLI for simplicity
echo -e "${YELLOW}⚠️  Please create CloudFront distribution manually in AWS Console${NC}"
echo "   Or wait for automated creation (coming soon)"

# For now, skip CloudFront automated creation
DISTRIBUTION_ID=""
CLOUDFRONT_DOMAIN=""

# Step 9: Create ECS Task Definition
echo ""
echo -e "${GREEN}📝 Step 9: Creating ECS task definition...${NC}"

cat > /tmp/task-definition.json << EOF
{
  "family": "wif-pdf-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
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
          "value": "*"
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

aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json \
  --region $AWS_REGION \
  --output text > /dev/null

echo -e "${GREEN}✅ Task definition registered${NC}"

# Step 10: Create ECS Service
echo ""
echo -e "${GREEN}🚀 Step 10: Creating ECS service...${NC}"

# Get subnets
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
  --query 'Subnets[*].SubnetId' \
  --output text \
  --region $AWS_REGION)

SUBNET_LIST=$(echo $SUBNET_IDS | tr ' ' ',')

# Create service
aws ecs create-service \
  --cluster wif-finance-cluster \
  --service-name wif-pdf-service \
  --task-definition wif-pdf-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
  --region $AWS_REGION \
  --output text > /dev/null || echo "Service may already exist"

echo -e "${GREEN}✅ ECS service created${NC}"

# Wait for task to start
echo ""
echo -e "${YELLOW}⏳ Waiting for ECS task to start (this may take 2-3 minutes)...${NC}"
sleep 60

# Get task public IP
TASK_ARN=$(aws ecs list-tasks \
  --cluster wif-finance-cluster \
  --service-name wif-pdf-service \
  --region $AWS_REGION \
  --query 'taskArns[0]' \
  --output text)

if [ "$TASK_ARN" != "None" ] && [ ! -z "$TASK_ARN" ]; then
    ENI_ID=$(aws ecs describe-tasks \
      --cluster wif-finance-cluster \
      --tasks $TASK_ARN \
      --region $AWS_REGION \
      --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
      --output text)

    PDF_SERVICE_IP=$(aws ec2 describe-network-interfaces \
      --network-interface-ids $ENI_ID \
      --region $AWS_REGION \
      --query 'NetworkInterfaces[0].Association.PublicIp' \
      --output text 2>/dev/null || echo "")
else
    PDF_SERVICE_IP=""
fi

# Step 11: Create .env.production file
echo ""
echo -e "${GREEN}📝 Step 11: Creating .env.production file...${NC}"

cat > .env.production << EOF
# AWS Configuration
AWS_REGION=$AWS_REGION
BUCKET_NAME=$BUCKET_NAME
DISTRIBUTION_ID=$DISTRIBUTION_ID

# Supabase
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# PDF Service
VITE_PDF_SERVICE_URL=https://CLOUDFRONT_DOMAIN/api/pdf
EOF

echo -e "${GREEN}✅ .env.production created${NC}"

# Summary
echo ""
echo "============================================="
echo -e "${GREEN}✅ AWS Setup Complete!${NC}"
echo "============================================="
echo ""
echo "Resources Created:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  ECR Repository: $ECR_URI"
echo "  ECS Cluster: wif-finance-cluster"
echo "  ECS Service: wif-pdf-service"
echo "  Security Group: $SG_ID"
echo ""

if [ ! -z "$PDF_SERVICE_IP" ]; then
    echo "PDF Service:"
    echo "  Public IP: $PDF_SERVICE_IP"
    echo "  Health Check: http://$PDF_SERVICE_IP:3001/health"
    echo ""
    echo "Test with: curl http://$PDF_SERVICE_IP:3001/health"
    echo ""
fi

echo "Next Steps:"
echo "  1. Create CloudFront distribution in AWS Console"
echo "  2. Add PDF service as origin to CloudFront"
echo "  3. Update .env.production with CloudFront domain"
echo "  4. Run: ./deploy-aws.sh"
echo ""
echo "For detailed instructions, see: AWS_DEPLOYMENT_GUIDE.md"
echo ""
