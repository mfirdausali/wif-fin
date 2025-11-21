#!/bin/bash
set -e

# WIF Finance - Custom Domain Setup Script
# Automates CloudFront + SSL setup for custom domain

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🌐 WIF Finance - Custom Domain Setup${NC}"
echo "=========================================="
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI not installed${NC}"
    exit 1
fi

# Get AWS configuration
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Error: AWS CLI not configured${NC}"
    exit 1
fi

BUCKET_NAME="wif-finance-frontend-1763680224"
S3_WEBSITE="wif-finance-frontend-1763680224.s3-website-ap-southeast-1.amazonaws.com"

echo "AWS Account: $AWS_ACCOUNT_ID"
echo "S3 Bucket: $BUCKET_NAME"
echo ""

# Prompt for domain
echo -e "${BLUE}📋 Enter your custom domain details:${NC}"
read -p "Domain name (e.g., app.yourdomain.com): " CUSTOM_DOMAIN

if [ -z "$CUSTOM_DOMAIN" ]; then
    echo -e "${RED}❌ Error: Domain name is required${NC}"
    exit 1
fi

echo ""
read -p "Do you use Route 53 for DNS? (y/n): " -n 1 -r
echo
USE_ROUTE53=$REPLY

echo ""
echo "Configuration:"
echo "  Custom Domain: $CUSTOM_DOMAIN"
echo "  DNS Provider: $([ $USE_ROUTE53 =~ ^[Yy]$ ] && echo 'Route 53' || echo 'External')"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled"
    exit 0
fi

# Step 1: Request SSL Certificate
echo ""
echo -e "${GREEN}📜 Step 1: Requesting SSL certificate...${NC}"
echo "Note: Certificate must be in us-east-1 for CloudFront"

CERT_ARN=$(aws acm request-certificate \
  --domain-name $CUSTOM_DOMAIN \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' \
  --output text)

echo -e "${GREEN}✅ Certificate requested: $CERT_ARN${NC}"

# Wait a moment for validation records to be available
sleep 5

# Get validation record
VALIDATION_RECORD=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output json)

VALIDATION_NAME=$(echo $VALIDATION_RECORD | jq -r '.Name')
VALIDATION_VALUE=$(echo $VALIDATION_RECORD | jq -r '.Value')

echo ""
echo -e "${YELLOW}📋 DNS Validation Required${NC}"
echo "Please add this CNAME record to your DNS:"
echo ""
echo "  Name:  $VALIDATION_NAME"
echo "  Type:  CNAME"
echo "  Value: $VALIDATION_VALUE"
echo "  TTL:   300"
echo ""

if [[ $USE_ROUTE53 =~ ^[Yy]$ ]]; then
    # Auto-create validation record in Route 53
    read -p "Create validation record in Route 53 automatically? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Extract base domain (e.g., yourdomain.com from app.yourdomain.com)
        BASE_DOMAIN=$(echo $CUSTOM_DOMAIN | awk -F. '{print $(NF-1)"."$NF}')

        HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
          --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" \
          --output text | cut -d'/' -f3)

        if [ -z "$HOSTED_ZONE_ID" ]; then
            echo -e "${RED}❌ Hosted zone for $BASE_DOMAIN not found${NC}"
            echo "Please create the record manually"
        else
            cat > /tmp/cert-validation.json << EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$VALIDATION_NAME",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$VALIDATION_VALUE"}]
    }
  }]
}
EOF
            aws route53 change-resource-record-sets \
              --hosted-zone-id $HOSTED_ZONE_ID \
              --change-batch file:///tmp/cert-validation.json > /dev/null

            echo -e "${GREEN}✅ Validation record created in Route 53${NC}"
        fi
    fi
else
    echo "Please add this record to your DNS provider and press Enter when done..."
    read
fi

# Wait for certificate validation
echo ""
echo -e "${YELLOW}⏳ Waiting for certificate validation...${NC}"
echo "This may take 5-30 minutes..."

TIMEOUT=1800  # 30 minutes
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS=$(aws acm describe-certificate \
      --certificate-arn $CERT_ARN \
      --region us-east-1 \
      --query 'Certificate.Status' \
      --output text)

    if [ "$STATUS" = "ISSUED" ]; then
        echo -e "${GREEN}✅ Certificate validated and issued!${NC}"
        break
    elif [ "$STATUS" = "FAILED" ]; then
        echo -e "${RED}❌ Certificate validation failed${NC}"
        exit 1
    fi

    echo "Status: $STATUS (${ELAPSED}s elapsed)"
    sleep 30
    ELAPSED=$((ELAPSED + 30))
done

if [ "$STATUS" != "ISSUED" ]; then
    echo -e "${RED}❌ Timeout waiting for certificate validation${NC}"
    echo "You can continue this setup later when the certificate is validated"
    exit 1
fi

# Step 2: Create CloudFront Distribution
echo ""
echo -e "${GREEN}☁️  Step 2: Creating CloudFront distribution...${NC}"

CALLER_REF="wif-finance-$(date +%s)"

cat > /tmp/cloudfront-config.json << EOF
{
  "CallerReference": "$CALLER_REF",
  "Comment": "WIF Finance - Production",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Aliases": {
    "Quantity": 1,
    "Items": ["$CUSTOM_DOMAIN"]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "$CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "wif-s3-origin",
      "DomainName": "$S3_WEBSITE",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "http-only"
      }
    }]
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
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    }
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 404,
      "ResponsePagePath": "/index.html",
      "ResponseCode": "200",
      "ErrorCachingMinTTL": 300
    }]
  },
  "PriceClass": "PriceClass_100",
  "HttpVersion": "http2"
}
EOF

DIST_OUTPUT=$(aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json \
  --output json)

DIST_ID=$(echo $DIST_OUTPUT | jq -r '.Distribution.Id')
CF_DOMAIN=$(echo $DIST_OUTPUT | jq -r '.Distribution.DomainName')

echo -e "${GREEN}✅ CloudFront distribution created${NC}"
echo "  Distribution ID: $DIST_ID"
echo "  CloudFront Domain: $CF_DOMAIN"
echo ""
echo -e "${YELLOW}⏳ Distribution is deploying (15-20 minutes)${NC}"

# Step 3: Create DNS Record
echo ""
echo -e "${GREEN}🌐 Step 3: Setting up DNS...${NC}"

if [[ $USE_ROUTE53 =~ ^[Yy]$ ]]; then
    read -p "Create DNS record in Route 53 automatically? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BASE_DOMAIN=$(echo $CUSTOM_DOMAIN | awk -F. '{print $(NF-1)"."$NF}')
        HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
          --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" \
          --output text | cut -d'/' -f3)

        cat > /tmp/dns-record.json << EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$CUSTOM_DOMAIN",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "$CF_DOMAIN",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF
        aws route53 change-resource-record-sets \
          --hosted-zone-id $HOSTED_ZONE_ID \
          --change-batch file:///tmp/dns-record.json > /dev/null

        echo -e "${GREEN}✅ DNS record created in Route 53${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}📋 Manual DNS Configuration Required${NC}"
    echo "Please add this CNAME record to your DNS provider:"
    echo ""
    echo "  Name:  $(echo $CUSTOM_DOMAIN | sed 's/\.[^.]*\.[^.]*$//')"
    echo "  Type:  CNAME"
    echo "  Value: $CF_DOMAIN"
    echo "  TTL:   300"
    echo ""
    read -p "Press Enter when DNS is configured..."
fi

# Step 4: Update .env.production
echo ""
echo -e "${GREEN}⚙️  Step 4: Updating configuration...${NC}"

# Backup existing .env.production
cp .env.production .env.production.backup

# Update or add DISTRIBUTION_ID
if grep -q "^DISTRIBUTION_ID=" .env.production; then
    sed -i '' "s/^DISTRIBUTION_ID=.*/DISTRIBUTION_ID=$DIST_ID/" .env.production
else
    echo "" >> .env.production
    echo "# CloudFront" >> .env.production
    echo "DISTRIBUTION_ID=$DIST_ID" >> .env.production
fi

# Add custom domain URL
if ! grep -q "^VITE_APP_URL=" .env.production; then
    echo "VITE_APP_URL=https://$CUSTOM_DOMAIN" >> .env.production
fi

echo -e "${GREEN}✅ Configuration updated${NC}"

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  Custom Domain: https://$CUSTOM_DOMAIN"
echo "  CloudFront ID: $DIST_ID"
echo "  CloudFront Domain: $CF_DOMAIN"
echo "  Certificate ARN: $CERT_ARN"
echo ""
echo "Next Steps:"
echo "  1. Wait 15-20 minutes for CloudFront deployment"
echo "  2. Wait for DNS propagation (5-60 minutes)"
echo "  3. Test: curl -I https://$CUSTOM_DOMAIN"
echo "  4. Visit: https://$CUSTOM_DOMAIN"
echo ""
echo "Useful Commands:"
echo "  # Check CloudFront status"
echo "  aws cloudfront get-distribution --id $DIST_ID --query 'Distribution.Status'"
echo ""
echo "  # Invalidate cache after updates"
echo "  aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*'"
echo ""
echo "  # Check DNS propagation"
echo "  nslookup $CUSTOM_DOMAIN"
echo ""
echo "Configuration saved to .env.production"
echo "Backup saved to .env.production.backup"
echo ""
