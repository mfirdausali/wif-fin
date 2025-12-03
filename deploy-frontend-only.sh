#!/bin/bash
set -e

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

AWS_REGION="${AWS_REGION:-ap-southeast-1}"

echo "Uploading frontend to S3..."
aws s3 sync dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html" \
  --region $AWS_REGION

aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate" \
  --region $AWS_REGION

echo "✅ Frontend uploaded to S3"
echo ""
echo "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✅ CloudFront cache invalidation created: $INVALIDATION_ID"
echo ""
echo "Deployment complete! Changes will be live in 1-2 minutes."
echo "Frontend: https://finance.wifjapan.com"
