#!/bin/bash
# Setup HTTPS for Fargate PDF Service using Application Load Balancer
set -e

REGION="ap-southeast-1"
CLUSTER="wif-finance-cluster"
SERVICE="wif-pdf-service"
DOMAIN="pdf.wifjapan.com"
VPC_ID=$(aws ec2 describe-vpcs --region $REGION --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text)
SECURITY_GROUP="sg-067f9c3d9737bec7f"

echo "========================================="
echo "Setting up HTTPS for Fargate PDF Service"
echo "========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Region: $REGION"
echo "VPC: $VPC_ID"
echo ""

# Step 1: Get subnet IDs
echo "📍 Getting subnet IDs..."
SUBNET_IDS=$(aws ec2 describe-subnets --region $REGION \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' \
  --output text | tr '\t' ',')

echo "   Subnets: $SUBNET_IDS"

# Step 2: Create Target Group
echo ""
echo "🎯 Creating Target Group..."
TG_ARN=$(aws elbv2 create-target-group \
  --name pdf-service-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-enabled \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>&1)

if [ $? -eq 0 ]; then
    echo "   ✅ Target Group created: $TG_ARN"
else
    if echo "$TG_ARN" | grep -q "DuplicateTargetGroupName"; then
        echo "   ⚠️  Target Group already exists, getting ARN..."
        TG_ARN=$(aws elbv2 describe-target-groups --region $REGION --names pdf-service-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
        echo "   ✅ Using existing: $TG_ARN"
    else
        echo "   ❌ Error: $TG_ARN"
        exit 1
    fi
fi

# Step 3: Request SSL Certificate
echo ""
echo "🔐 Requesting SSL Certificate..."
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --validation-method DNS \
  --region $REGION \
  --query 'CertificateArn' \
  --output text 2>&1)

if [ $? -eq 0 ]; then
    echo "   ✅ Certificate requested: $CERT_ARN"
    echo ""
    echo "   ⚠️  IMPORTANT: You need to validate this certificate!"
    echo "   Run this command to get DNS validation record:"
    echo ""
    echo "   aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.DomainValidationOptions[0].ResourceRecord'"
    echo ""
    read -p "   Add the DNS record and press Enter when done..."
else
    echo "   ⚠️  Certificate request failed or already exists"
    # Try to find existing certificate
    CERT_ARN=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" --output text | head -1)
    if [ ! -z "$CERT_ARN" ]; then
        echo "   ✅ Using existing certificate: $CERT_ARN"
    else
        echo "   ❌ No certificate found"
        exit 1
    fi
fi

# Step 4: Create Application Load Balancer
echo ""
echo "⚖️  Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name pdf-service-alb \
  --subnets ${SUBNET_IDS//,/ } \
  --security-groups $SECURITY_GROUP \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --region $REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>&1)

if [ $? -eq 0 ]; then
    echo "   ✅ Load Balancer created: $ALB_ARN"
else
    if echo "$ALB_ARN" | grep -q "DuplicateLoadBalancerName"; then
        echo "   ⚠️  Load Balancer already exists, getting ARN..."
        ALB_ARN=$(aws elbv2 describe-load-balancers --region $REGION --names pdf-service-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)
        echo "   ✅ Using existing: $ALB_ARN"
    else
        echo "   ❌ Error: $ALB_ARN"
        exit 1
    fi
fi

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --region $REGION --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo "   ALB DNS: $ALB_DNS"

# Step 5: Create HTTPS Listener
echo ""
echo "🔊 Creating HTTPS Listener..."
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $REGION \
  --query 'Listeners[0].ListenerArn' \
  --output text 2>&1)

if [ $? -eq 0 ]; then
    echo "   ✅ HTTPS Listener created"
else
    echo "   ⚠️  Listener creation failed (might already exist)"
fi

# Step 6: Update ECS Service
echo ""
echo "🐳 Updating ECS Service to use Load Balancer..."
aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --load-balancers targetGroupArn=$TG_ARN,containerName=pdf-service,containerPort=3001 \
  --region $REGION \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ ECS Service updated"
else
    echo "   ⚠️  Service update failed (might need manual update)"
fi

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "Load Balancer DNS: $ALB_DNS"
echo ""
echo "Next Steps:"
echo "1. Update DNS: $DOMAIN → $ALB_DNS (CNAME record)"
echo "2. Wait for certificate validation"
echo "3. Update frontend .env.production:"
echo "   VITE_PDF_SERVICE_URL=https://$DOMAIN"
echo "4. Rebuild and deploy frontend"
echo ""
