#!/bin/bash
# ============================================================================
# Automated PDF Service CloudFront Setup
# This creates an HTTPS CloudFront distribution for the PDF service
# ============================================================================

set -e

echo "========================================="
echo "PDF Service CloudFront HTTPS Setup"
echo "========================================="
echo ""

# Configuration
PDF_SERVICE_IP="18.141.140.2"
PDF_SERVICE_PORT="3001"
AWS_REGION="ap-southeast-1"

echo "📋 Configuration:"
echo "   PDF Service: http://$PDF_SERVICE_IP:$PDF_SERVICE_PORT"
echo "   AWS Region: $AWS_REGION"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli"
    exit 1
fi

# Create CloudFront distribution
echo "🚀 Creating CloudFront distribution..."
echo "   This will take 5-15 minutes to deploy globally..."
echo ""

DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution \
    --region us-east-1 \
    --distribution-config '{
      "CallerReference": "pdf-service-'$(date +%s)'",
      "Comment": "WIF Finance PDF Service HTTPS",
      "Enabled": true,
      "Origins": {
        "Quantity": 1,
        "Items": [{
          "Id": "pdf-service-origin",
          "DomainName": "'$PDF_SERVICE_IP'",
          "CustomOriginConfig": {
            "HTTPPort": '$PDF_SERVICE_PORT',
            "HTTPSPort": 443,
            "OriginProtocolPolicy": "http-only",
            "OriginSslProtocols": {
              "Quantity": 1,
              "Items": ["TLSv1.2"]
            }
          },
          "ConnectionAttempts": 3,
          "ConnectionTimeout": 10,
          "OriginShield": {
            "Enabled": false
          }
        }]
      },
      "DefaultCacheBehavior": {
        "TargetOriginId": "pdf-service-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
          }
        },
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
        "Compress": true,
        "DefaultTTL": 0,
        "MinTTL": 0,
        "MaxTTL": 31536000
      },
      "PriceClass": "PriceClass_All",
      "HttpVersion": "http2"
    }' \
    --output json 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Failed to create CloudFront distribution:"
    echo "$DISTRIBUTION_OUTPUT"
    exit 1
fi

# Extract CloudFront domain
CLOUDFRONT_DOMAIN=$(echo "$DISTRIBUTION_OUTPUT" | grep -o '"DomainName": "[^"]*"' | head -1 | cut -d'"' -f4)
DISTRIBUTION_ID=$(echo "$DISTRIBUTION_OUTPUT" | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
    echo "❌ Failed to extract CloudFront domain"
    echo "$DISTRIBUTION_OUTPUT"
    exit 1
fi

echo "✅ CloudFront distribution created successfully!"
echo ""
echo "📝 Details:"
echo "   Distribution ID: $DISTRIBUTION_ID"
echo "   CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "   HTTPS URL: https://$CLOUDFRONT_DOMAIN"
echo ""

# Update .env.production
echo "📝 Updating .env.production..."
if grep -q "^VITE_PDF_SERVICE_URL=" .env.production 2>/dev/null; then
    # Backup original
    cp .env.production .env.production.backup

    # Update the URL
    sed -i.bak "s|^VITE_PDF_SERVICE_URL=.*|VITE_PDF_SERVICE_URL=https://$CLOUDFRONT_DOMAIN|" .env.production
    rm .env.production.bak

    echo "✅ Updated .env.production"
else
    echo "⚠️  .env.production not found or doesn't contain VITE_PDF_SERVICE_URL"
    echo "   Please manually add:"
    echo "   VITE_PDF_SERVICE_URL=https://$CLOUDFRONT_DOMAIN"
fi

echo ""
echo "⏳ CloudFront is deploying (5-15 minutes)..."
echo "   Status: Deploying..."
echo ""
echo "   Check status with:"
echo "   aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""

# Wait for deployment (optional)
read -p "Wait for deployment to complete? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⏳ Waiting for CloudFront deployment..."
    aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID
    echo "✅ Deployment complete!"
fi

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Wait for CloudFront deployment (if you didn't wait above):"
echo "   aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
echo "2. Test the HTTPS endpoint:"
echo "   curl https://$CLOUDFRONT_DOMAIN/health"
echo ""
echo "3. Update your frontend build:"
echo "   npm run build"
echo ""
echo "4. Deploy the updated frontend:"
echo "   npm run deploy"
echo ""
echo "5. Test PDF download at:"
echo "   https://finance.wifjapan.com"
echo ""
echo "Your PDF service is now available at:"
echo "   https://$CLOUDFRONT_DOMAIN"
echo ""
