#!/bin/bash
set -e

# WIF Finance - AWS Setup Continuation Script
# Continues from Step 6 after Docker is running

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 WIF Finance - Continuing AWS Setup${NC}"
echo "============================================="
echo ""

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

# Use existing bucket name
BUCKET_NAME="wif-finance-frontend-1763680224"
TIMESTAMP=$(date +%s)

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

# Get ECR URI
ECR_URI=$(aws ecr describe-repositories \
  --repository-names wif-pdf-service \
  --region $AWS_REGION \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo ""
echo "Using existing resources:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  ECR Repository: $ECR_URI"
echo ""

# Step 6: Build and Push Docker Image
echo ""
echo -e "${GREEN}🏗️  Step 6: Building and pushing PDF service image...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

cd pdf-service

# Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build
echo "Building Docker image..."
docker build -t wif-pdf-service .

# Tag
echo "Tagging image..."
docker tag wif-pdf-service:latest $ECR_URI:latest

# Push
echo "Pushing to ECR..."
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

# Create security group (or get existing)
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
  --region $AWS_REGION 2>/dev/null || echo "Security group rule already exists"

echo -e "${GREEN}✅ Security group configured: $SG_ID${NC}"

# Step 8: Skip CloudFront for now
echo ""
echo -e "${YELLOW}⚠️  Step 8: CloudFront distribution (manual step)${NC}"
echo "   CloudFront will need to be created manually or in the next deployment"
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

# Step 10: Create or Update ECS Service
echo ""
echo -e "${GREEN}🚀 Step 10: Creating/updating ECS service...${NC}"

# Get subnets
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
  --query 'Subnets[*].SubnetId' \
  --output text \
  --region $AWS_REGION)

SUBNET_LIST=$(echo $SUBNET_IDS | tr ' ' ',')

# Try to create service (it might already exist)
aws ecs create-service \
  --cluster wif-finance-cluster \
  --service-name wif-pdf-service \
  --task-definition wif-pdf-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
  --region $AWS_REGION \
  --output text > /dev/null 2>&1 && echo "Service created" || {
    echo "Service exists, updating..."
    aws ecs update-service \
      --cluster wif-finance-cluster \
      --service wif-pdf-service \
      --task-definition wif-pdf-service \
      --force-new-deployment \
      --region $AWS_REGION \
      --output text > /dev/null
  }

echo -e "${GREEN}✅ ECS service configured${NC}"

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
echo "Resources Configured:"
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
echo "  1. Test the PDF service endpoint"
echo "  2. Create CloudFront distribution (optional, for custom domain)"
echo "  3. Update .env.production with CloudFront domain (if using)"
echo "  4. Run: ./deploy-aws.sh to deploy the frontend"
echo ""
echo "For detailed instructions, see: AWS_DEPLOYMENT_GUIDE.md"
echo ""
