# Custom Domain Setup for WIF Finance

This guide will help you configure your own domain (e.g., `app.yourdomain.com`) to access your WIF Finance application.

## Prerequisites

- Your own domain name (e.g., `yourdomain.com`)
- Access to your domain's DNS settings
- AWS CLI configured
- Your S3 bucket: `wif-finance-frontend-1763680224`

## Architecture Overview

```
User → Your Domain (app.yourdomain.com)
    → CloudFront (CDN + HTTPS)
        → S3 Bucket (Static Website)
```

---

## Option 1: Using AWS Route 53 (Recommended)

### Step 1: Request SSL Certificate (Required for HTTPS)

**IMPORTANT**: SSL certificates for CloudFront must be created in **us-east-1** region.

```bash
# Request certificate in us-east-1
aws acm request-certificate \
  --domain-name app.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Get certificate ARN (save this!)
CERT_ARN=$(aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[0].CertificateArn' --output text)

echo "Certificate ARN: $CERT_ARN"

# Get validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

### Step 2: Create DNS Validation Record

If using Route 53:

```bash
# Get your hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='yourdomain.com.'].Id" \
  --output text | cut -d'/' -f3)

# Create validation record (get values from Step 1)
cat > /tmp/cert-validation.json << EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "_xxx.app.yourdomain.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "yyy.acm-validations.aws."}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/cert-validation.json
```

**Wait 5-10 minutes for certificate validation to complete.**

Check status:
```bash
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.Status'
```

### Step 3: Create CloudFront Distribution

```bash
# Create distribution config
cat > /tmp/cloudfront-config.json << 'EOF'
{
  "CallerReference": "wif-finance-$(date +%s)",
  "Comment": "WIF Finance - Production",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Aliases": {
    "Quantity": 1,
    "Items": ["app.yourdomain.com"]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "YOUR_CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "wif-s3-origin",
      "DomainName": "wif-finance-frontend-1763680224.s3-website-ap-southeast-1.amazonaws.com",
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
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"},
      "Headers": {
        "Quantity": 0
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "Compress": true,
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

# Replace YOUR_CERT_ARN with actual ARN
sed -i '' "s|YOUR_CERT_ARN|$CERT_ARN|g" /tmp/cloudfront-config.json

# Create distribution
aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json \
  --query 'Distribution.[Id,DomainName]' \
  --output table

# Save the CloudFront domain name (e.g., d1234567890.cloudfront.net)
```

**Note**: CloudFront distribution creation takes 15-20 minutes.

### Step 4: Create Route 53 DNS Record

```bash
# Get CloudFront distribution domain
CF_DOMAIN=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='WIF Finance - Production'].DomainName" \
  --output text)

# Create A record for your custom domain
cat > /tmp/dns-record.json << EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "app.yourdomain.com",
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
  --change-batch file:///tmp/dns-record.json
```

---

## Option 2: Using External DNS Provider (e.g., GoDaddy, Namecheap)

### Step 1: Request SSL Certificate

Same as Option 1, Step 1 above.

### Step 2: Validate Certificate with Your DNS Provider

1. Get validation records from AWS:
```bash
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

2. Log into your DNS provider (GoDaddy, Namecheap, etc.)
3. Add a **CNAME record**:
   - **Name**: `_xxx.app` (from validation record)
   - **Value**: `yyy.acm-validations.aws.` (from validation record)
   - **TTL**: 300 or Auto

4. Wait for validation (5-30 minutes)

### Step 3: Create CloudFront Distribution

Same as Option 1, Step 3 above.

### Step 4: Update DNS with Your Provider

1. Get your CloudFront domain:
```bash
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='WIF Finance - Production'].DomainName" \
  --output text
```

2. Log into your DNS provider
3. Add a **CNAME record**:
   - **Name**: `app` (or your subdomain)
   - **Value**: `d1234567890.cloudfront.net` (your CloudFront domain)
   - **TTL**: 300 or Auto

---

## Step 5: Update Environment Configuration

After CloudFront is set up, update your application to use the new domain:

```bash
# Get CloudFront distribution ID
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='WIF Finance - Production'].Id" \
  --output text)

# Update .env.production
cat >> .env.production << EOF

# CloudFront
DISTRIBUTION_ID=$DIST_ID
VITE_APP_URL=https://app.yourdomain.com
EOF
```

---

## Step 6: Test Your Setup

```bash
# Test DNS resolution
nslookup app.yourdomain.com

# Test HTTPS
curl -I https://app.yourdomain.com

# Test in browser
open https://app.yourdomain.com
```

---

## Troubleshooting

### Certificate Validation Stuck
- **Check DNS**: Ensure CNAME record is correct
- **Wait**: Can take up to 30 minutes
- **Verify**: `dig _xxx.app.yourdomain.com CNAME`

### 403 Forbidden Error
- **Check S3 bucket policy**: Must allow public read
- **Check CloudFront origin**: Should be S3 website endpoint, not bucket endpoint

### CloudFront Shows Old Content
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### DNS Not Resolving
- **Check TTL**: Old DNS records may be cached
- **Use different DNS**: `nslookup app.yourdomain.com 8.8.8.8`
- **Clear browser cache**: Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

---

## Cost Estimate

- **CloudFront**: ~$0.085/GB (first 10 TB)
- **Route 53**: $0.50/hosted zone/month + $0.40/million queries
- **ACM Certificate**: FREE
- **Data transfer**: First 1GB/month free from CloudFront

Estimated monthly cost for low traffic: **$0.50 - $5**

---

## Quick Setup Script

I can create an automated script if you prefer. Let me know:
1. Your domain name (e.g., `app.yourdomain.com`)
2. Whether you use Route 53 or external DNS
3. Your AWS region preference for Route 53 (if applicable)

---

## Security Best Practices

1. **Enable WAF** (optional, extra cost):
```bash
# Add basic rate limiting
aws wafv2 create-web-acl --name wif-finance-waf \
  --scope CLOUDFRONT \
  --default-action Allow={} \
  --region us-east-1
```

2. **Enable CloudFront logging**:
   - Stores access logs in S3
   - Helps with debugging and security monitoring

3. **Set up CloudWatch alarms**:
   - Monitor 4xx/5xx errors
   - Track unusual traffic patterns

---

## Next Steps After Setup

1. Update `.env.production` with your custom domain
2. Rebuild and redeploy: `./deploy-aws.sh`
3. Test all features on your custom domain
4. Set up monitoring and alerts
5. Configure CDN caching rules for optimal performance

Need help with any of these steps? Let me know!
