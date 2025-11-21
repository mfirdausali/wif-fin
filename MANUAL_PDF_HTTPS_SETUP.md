# Manual PDF HTTPS Setup Guide

## Issue
SSH to the PDF EC2 instance is currently blocked (likely security group restriction).

## Quick Fix Option 1: Update Security Group (5 minutes)

### Step 1: Find Your Current IP
```bash
curl ifconfig.me
# Example output: 123.45.67.89
```

### Step 2: Update EC2 Security Group
1. Go to AWS Console: https://console.aws.amazon.com/ec2
2. Click **Instances** → Find instance with IP `18.141.140.2`
3. Click on the **Security** tab
4. Click on the Security Group link
5. Click **Edit inbound rules**
6. Check if port 22 (SSH) is allowed from your IP
7. If not, add rule:
   - Type: SSH
   - Port: 22
   - Source: My IP (or your IP from Step 1)
8. **Save rules**

### Step 3: Try SSH Again
```bash
ssh -i /Users/firdaus/Downloads/wif-pdf.pem ec2-user@18.141.140.2
```

If successful, continue with **Setup Commands** below.

---

## Quick Fix Option 2: Use EC2 Instance Connect (No SSH needed!)

### Via AWS Console
1. Go to: https://console.aws.amazon.com/ec2
2. Find instance with IP `18.141.140.2`
3. Select it → Click **Connect** button
4. Choose **EC2 Instance Connect** tab
5. Click **Connect** button
6. A browser terminal will open
7. Run the **Setup Commands** below

---

## Setup Commands (Run on EC2 Instance)

Once you're connected to the EC2 instance (via SSH or Instance Connect), run these commands:

### 1. Install nginx and certbot
```bash
sudo yum update -y
sudo yum install -y nginx certbot python3-certbot-nginx
```

### 2. Verify PDF service is running
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","service":"pdf-generator",...}
```

### 3. Configure nginx
```bash
sudo tee /etc/nginx/conf.d/pdf-service.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name pdf.wifjapan.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # PDF generation timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
```

### 4. Test nginx configuration
```bash
sudo nginx -t
# Should say: syntax is ok
```

### 5. Start nginx
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6. Update security group for HTTP/HTTPS
**In AWS Console:**
1. Go to EC2 → Security Groups → Find your instance's SG
2. Add inbound rules:
   - Port 80 (HTTP): 0.0.0.0/0
   - Port 443 (HTTPS): 0.0.0.0/0

### 7. Test HTTP access
```bash
# From your local machine
curl http://18.141.140.2/health
# Should return PDF service response
```

---

## Before Getting SSL: DNS Setup Required!

### Add DNS A Record
In your DNS provider (Route53, Cloudflare, etc.):

```
Type: A
Name: pdf
Value: 18.141.140.2
TTL: 300
```

This creates: `pdf.wifjapan.com` → `18.141.140.2`

### Verify DNS
Wait 5 minutes, then check:
```bash
nslookup pdf.wifjapan.com
# Should return: 18.141.140.2
```

---

## Get SSL Certificate (After DNS is Ready)

### On the EC2 instance:
```bash
sudo certbot --nginx -d pdf.wifjapan.com --non-interactive --agree-tos --email admin@wifjapan.com
```

This will:
- Get SSL certificate from Let's Encrypt
- Auto-configure nginx for HTTPS
- Set up auto-renewal

### Test HTTPS
```bash
curl https://pdf.wifjapan.com/health
# Should return: {"status":"ok","service":"pdf-generator",...}
```

---

## Update Frontend (On Your Local Machine)

### 1. Update environment file
```bash
cd /Users/firdaus/Documents/2025/code/wif-fin

# Update .env.production
echo 'VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com' > .env.production.new
cat .env.production | grep -v VITE_PDF_SERVICE_URL >> .env.production.new
mv .env.production.new .env.production
```

Or manually edit `.env.production`:
```
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com
```

### 2. Rebuild and deploy
```bash
npm run build
npm run deploy
```

### 3. Test on live site
Visit: https://finance.wifjapan.com

Try downloading a PDF - should work now!

---

## Troubleshooting

### SSH Still Not Working?
**Option A**: Use EC2 Instance Connect (browser-based, no SSH key needed)
- AWS Console → EC2 → Select instance → Connect → EC2 Instance Connect

**Option B**: Use AWS Systems Manager Session Manager
```bash
aws ssm start-session --target INSTANCE_ID
```

### DNS Not Resolving?
- Check DNS provider has the A record
- Wait 5-10 minutes for propagation
- Try `dig pdf.wifjapan.com` or `nslookup pdf.wifjapan.com`

### Certificate Failed?
- Ensure DNS is working first
- Check security group allows port 80 from 0.0.0.0/0
- Check nginx is running: `sudo systemctl status nginx`

### Still Getting Mixed Content Error?
- Verify frontend .env.production has HTTPS URL
- Clear browser cache
- Check browser console for the actual URL being called

---

## Alternative: Use AWS Systems Manager

If SSH continues to fail, you can use SSM:

1. Go to AWS Console → EC2 → Instance
2. Actions → Connect → Session Manager
3. Or install SSM plugin and run:
   ```bash
   aws ssm start-session --target i-xxxxx
   ```

---

## Summary Checklist

- [ ] Update EC2 security group (allow ports 22, 80, 443)
- [ ] SSH or connect to EC2 instance
- [ ] Install nginx and certbot
- [ ] Configure nginx reverse proxy
- [ ] Start nginx
- [ ] Add DNS A record: pdf.wifjapan.com → 18.141.140.2
- [ ] Wait for DNS propagation (5-10 min)
- [ ] Get SSL certificate with certbot
- [ ] Test HTTPS: `curl https://pdf.wifjapan.com/health`
- [ ] Update .env.production locally
- [ ] Rebuild and deploy frontend
- [ ] Test PDF download on live site

Once complete, your PDFs will download successfully! 🎉
