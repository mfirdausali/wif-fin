#!/bin/bash
# Simple CloudFront setup for PDF service

set -e

echo "Creating CloudFront distribution for PDF service..."
echo ""

# Create distribution using JSON file
RESULT=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json \
  --output json 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Error creating distribution:"
  echo "$RESULT"
  exit 1
fi

# Extract domain and ID
CLOUDFRONT_DOMAIN=$(echo "$RESULT" | jq -r '.Distribution.DomainName')
DISTRIBUTION_ID=$(echo "$RESULT" | jq -r '.Distribution.Id')

echo "✅ CloudFront distribution created!"
echo ""
echo "Distribution ID: $DISTRIBUTION_ID"
echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "HTTPS URL: https://$CLOUDFRONT_DOMAIN"
echo ""
echo "Status: Deploying (this takes 10-15 minutes)"
echo ""

# Update .env.production
if [ -f ".env.production" ]; then
  cp .env.production .env.production.backup
  sed -i.bak "s|^VITE_PDF_SERVICE_URL=.*|VITE_PDF_SERVICE_URL=https://$CLOUDFRONT_DOMAIN|" .env.production
  rm .env.production.bak
  echo "✅ Updated .env.production"
  echo "   Old: VITE_PDF_SERVICE_URL=http://18.141.140.2:3001"
  echo "   New: VITE_PDF_SERVICE_URL=https://$CLOUDFRONT_DOMAIN"
fi

echo ""
echo "Next steps:"
echo "1. Wait for deployment (~10 min): aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo "2. Test: curl https://$CLOUDFRONT_DOMAIN/health"
echo "3. Build: npm run build"
echo "4. Deploy: npm run deploy"
echo ""
