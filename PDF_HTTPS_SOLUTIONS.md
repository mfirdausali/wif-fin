# PDF HTTPS Solutions - Working Options

## Problem
CloudFront requires a domain name, not an IP address. We found:
```
The parameter origin name cannot be an IP address.
```

## Solution 1: Use Subdomain + nginx (RECOMMENDED) ⭐

**Time**: 30 minutes
**Requirements**: Access to DNS for wifjapan.com
**Cost**: Free (Let's Encrypt SSL)

### Steps:

#### 1. Create DNS Record
Add an A record in your DNS:
```
pdf.wifjapan.com  →  18.141.140.2
```

Wait 5 minutes for DNS propagation, then verify:
```bash
nslookup pdf.wifjapan.com
# Should return: 18.141.140.2
```

#### 2. SSH to PDF Server
```bash
ssh -i your-key.pem ec2-user@18.141.140.2
```

#### 3. Install nginx and certbot
```bash
sudo yum update -y
sudo yum install -y nginx certbot python3-certbot-nginx
```

#### 4. Configure nginx
```bash
sudo tee /etc/nginx/conf.d/pdf-service.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name pdf.wifjapan.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # PDF generation timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
```

#### 5. Start nginx
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 6. Get SSL Certificate
```bash
sudo certbot --nginx -d pdf.wifjapan.com --non-interactive --agree-tos --email admin@wifjapan.com
```

#### 7. Test
```bash
curl https://pdf.wifjapan.com/health
# Should return: {"status":"ok","service":"pdf-generator",...}
```

#### 8. Update Frontend
On your local machine:
```bash
# Update .env.production
echo 'VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com' >> .env.production

# Rebuild and deploy
npm run build
npm run deploy
```

**Done!** ✅

---

## Solution 2: Use Application Load Balancer (AWS-Native)

**Time**: 45 minutes
**Cost**: ~$16/month for ALB
**Requirements**: AWS account

### Steps:

1. **Create Target Group**
```bash
aws elbv2 create-target-group \
  --name pdf-service-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id YOUR_VPC_ID \
  --health-check-path /health
```

2. **Register PDF EC2 Instance**
```bash
aws elbv2 register-targets \
  --target-group-arn TARGET_GROUP_ARN \
  --targets Id=PDF_EC2_INSTANCE_ID
```

3. **Create Application Load Balancer**
```bash
aws elbv2 create-load-balancer \
  --name pdf-service-alb \
  --subnets SUBNET_1 SUBNET_2 \
  --security-groups SG_ID \
  --scheme internet-facing
```

4. **Request SSL Certificate**
```bash
aws acm request-certificate \
  --domain-name pdf.wifjapan.com \
  --validation-method DNS
```

5. **Create HTTPS Listener**
```bash
aws elbv2 create-listener \
  --load-balancer-arn ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=TARGET_GROUP_ARN
```

6. **Update DNS**
Create CNAME: `pdf.wifjapan.com` → ALB DNS name

7. **Update Frontend**
```bash
echo 'VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com' >> .env.production
npm run build && npm run deploy
```

---

## Solution 3: Quick Test - Temporary CORS Proxy (NOT FOR PRODUCTION)

**Time**: 5 minutes
**Only for testing!**

Use a CORS proxy temporarily:

```javascript
// In pdfService.ts, temporarily use:
const PDF_SERVICE_URL = 'https://cors-anywhere.herokuapp.com/http://18.141.140.2:3001';
```

⚠️ **DO NOT USE IN PRODUCTION** - This is only for testing!

---

## Recommended Solution

**Use Solution 1** (nginx + Let's Encrypt) because:
- ✅ Free SSL certificate
- ✅ Simple setup
- ✅ No ongoing costs
- ✅ Auto-renewal
- ✅ Fast
- ✅ No AWS infrastructure needed

## After Choosing a Solution

Once HTTPS is working:
1. Test PDF download: https://finance.wifjapan.com
2. Check browser console (no more mixed content errors)
3. Then we can tackle the Supabase migration

## Need Help?

Let me know which solution you want to use and I can provide more detailed steps or help you execute it!
