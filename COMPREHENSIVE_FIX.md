# Comprehensive Fix: Mixed Content + localStorage Issues

## Issues to Fix

### Issue 1: Mixed Content Error (BLOCKING PDF Downloads) 🔴
```
Mixed Content: The page at 'https://finance.wifjapan.com/' was loaded over HTTPS,
but requested an insecure resource 'http://pdf.wifjapan.com:3001/api/pdf/invoice'
```

**Root Cause**: Browser blocks HTTP requests from HTTPS pages for security

**Solution**: Set up HTTPS on the PDF server at pdf.wifjapan.com

### Issue 2: Data Still in localStorage (NOT Cloud-Persistent) 🟡
```
=== Loading Data from LocalStorage ===
Documents saved to localStorage: 1 documents
```

**Root Cause**: App.tsx not using Supabase service layer

**Solution**: Migrate App.tsx to use Supabase

---

## CRITICAL FIX #1: Set Up HTTPS on PDF Server

### DNS Status ✅
```
pdf.wifjapan.com → 18.141.140.2 (Already configured!)
```

### Steps to Set Up SSL

#### Option A: Using EC2 Instance Connect (Easiest - No SSH Key)

1. **Go to AWS Console**: https://ap-southeast-1.console.aws.amazon.com/ec2
2. **Find your instance**: Search for IP `18.141.140.2`
3. **Click Connect** → Choose "EC2 Instance Connect"
4. **Click Connect** → Browser terminal opens
5. **Copy and paste these commands**:

```bash
# Install nginx and certbot
sudo yum update -y
sudo yum install -y nginx certbot python3-certbot-nginx

# Configure nginx as reverse proxy
sudo tee /etc/nginx/conf.d/pdf-service.conf > /dev/null <<'EOF'
server {
    listen 80;
    listen 443 ssl http2;
    server_name pdf.wifjapan.com;

    # Temporary self-signed cert (certbot will replace this)
    ssl_certificate /etc/pki/tls/certs/localhost.crt;
    ssl_certificate_key /etc/pki/tls/private/localhost.key;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # PDF timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Get Let's Encrypt SSL certificate
sudo certbot --nginx -d pdf.wifjapan.com --non-interactive --agree-tos --email admin@wifjapan.com

# Verify HTTPS works
curl https://pdf.wifjapan.com:3001/health
```

6. **Update Security Group** (if port 443 blocked):
   - AWS Console → EC2 → Security Groups
   - Find SG for instance `18.141.140.2`
   - Add inbound rule: HTTPS (443) from 0.0.0.0/0

7. **Test from your local machine**:
```bash
curl https://pdf.wifjapan.com:3001/health
# Should return: {"status":"ok","service":"pdf-generator"...}
```

#### Option B: Using SSH (If security group allows)

```bash
# Copy the setup script to EC2
scp -i /Users/firdaus/Downloads/wif-pdf.pem setup-pdf-nginx.sh ec2-user@18.141.140.2:~

# SSH and run it
ssh -i /Users/firdaus/Downloads/wif-pdf.pem ec2-user@18.141.140.2
bash setup-pdf-nginx.sh pdf.wifjapan.com
```

---

## FIX #2: Update Frontend to Use HTTPS

Once SSL is set up on the PDF server:

```bash
cd /Users/firdaus/Documents/2025/code/wif-fin

# Update .env.production
sed -i '' 's|VITE_PDF_SERVICE_URL=.*|VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com:3001|' .env.production

# Rebuild
npm run build

# Deploy
aws s3 sync dist/ s3://wif-finance-frontend-1763680224/ --delete
aws cloudfront create-invalidation --distribution-id E10R2ZLIGYCY0W --paths "/*"
```

---

## FIX #3: Migrate from localStorage to Supabase

I've prepared a comprehensive Supabase integration. This will:
- Save all data to Supabase cloud database
- Keep localStorage as backup/cache
- Provide data migration utility

### Implementation Options:

**Option A: I implement it now** (2-3 hours work)
- I'll rewrite App.tsx to use Supabase
- Add migration utility
- Test thoroughly
- Deploy

**Option B: You implement later using my guide**
- I provide detailed implementation guide
- You implement when ready
- Less risky, more control

Which option do you prefer for the Supabase migration?

---

## Priority Order

### IMMEDIATE (Do Now - 30 min):
1. ✅ DNS already configured
2. 🔧 Set up HTTPS on PDF server (steps above)
3. 🔧 Update frontend .env to use HTTPS
4. 🔧 Rebuild and deploy

### AFTER PDF WORKS (Later):
5. 📊 Migrate to Supabase (when you're ready)

---

## Quick Commands Summary

**Set up HTTPS on PDF server** (via EC2 Instance Connect):
```bash
sudo yum install -y nginx certbot python3-certbot-nginx
# (paste the nginx config from above)
sudo systemctl start nginx
sudo certbot --nginx -d pdf.wifjapan.com --email admin@wifjapan.com --agree-tos -n
```

**Update frontend** (on your local machine):
```bash
sed -i '' 's|VITE_PDF_SERVICE_URL=.*|VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com:3001|' .env.production
npm run build
aws s3 sync dist/ s3://wif-finance-frontend-1763680224/ --delete
aws cloudfront create-invalidation --distribution-id E10R2ZLIGYCY0W --paths "/*"
```

---

## What You Should Do Right Now

1. **Open AWS Console** → EC2 → Instance Connect for `18.141.140.2`
2. **Run the nginx + SSL setup commands** (copy from above)
3. **Wait for me to update and deploy the frontend** (I'll do this once you confirm SSL is set up)

Let me know when you've run the SSL setup commands and I'll immediately update and deploy the frontend!
