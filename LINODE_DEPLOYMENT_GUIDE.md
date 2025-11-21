# WIF Finance - Linode Deployment Guide (Best Practices)

## Executive Summary

This guide provides a production-ready deployment architecture for the WIF Finance application on Linode infrastructure, combining cloud-managed database (Supabase) with self-hosted application servers for optimal cost, performance, and security.

---

## 🏗️ Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNET (HTTPS)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Linode Cloud Firewall                          │
│         (Ports: 80, 443, 22 [restricted])                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Linode Compute Instance (4GB RAM)                   │
│              Ubuntu 22.04 LTS                               │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Nginx Reverse Proxy                      │    │
│  │     SSL/TLS (Let's Encrypt Auto-Renewal)           │    │
│  │                                                    │    │
│  │   / → Frontend SPA (Static Files)                  │    │
│  │   /api/pdf → PDF Service (Port 3001)               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │     React SPA (Nginx Static Serving)               │    │
│  │     /var/www/wif-fin/dist/                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │   Node.js PDF Service (PM2 Managed)                │    │
│  │   - Express.js API                                 │    │
│  │   - Puppeteer (Headless Chrome)                    │    │
│  │   - Port 3001 (internal only)                      │    │
│  │   - 2 instances (cluster mode)                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │   Monitoring Stack (Optional)                      │    │
│  │   - PM2 Monitoring                                 │    │
│  │   - Nginx Access Logs                              │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ (Secure API calls via HTTPS)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase (Cloud Database)                      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │   PostgreSQL 15 Database                           │    │
│  │   - 10 Tables (companies, accounts, documents...)  │    │
│  │   - Row-Level Security (RLS) Enabled               │    │
│  │   - Automatic Backups (Point-in-time Recovery)     │    │
│  │   - Connection Pooling                             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │   Supabase Auth (Optional Future)                  │    │
│  │   - JWT token generation                           │    │
│  │   - OAuth providers                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │   Supabase Storage (Future)                        │    │
│  │   - PDF file storage                               │    │
│  │   - Transfer proof uploads                         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Strategy: Why Supabase Cloud?

### ✅ Recommended: Supabase (Cloud-Managed)

**Reasons:**
1. **Zero Database Administration** - No PostgreSQL maintenance, updates, or backups to manage
2. **Built-in Features** - Row-Level Security, real-time subscriptions, automatic backups
3. **Scalability** - Automatic scaling, connection pooling included
4. **Cost-Effective** - Free tier includes 500MB database, 1GB file storage, 50,000 monthly active users
5. **Security** - Industry-standard encryption, automated security patches
6. **Disaster Recovery** - Point-in-time recovery, automated daily backups
7. **Developer Experience** - Auto-generated APIs, TypeScript types, admin dashboard

**Pricing (as of 2025):**
- **Free Tier**: Perfect for development and small deployments
- **Pro Plan ($25/month)**: 8GB database, 100GB file storage, daily backups
- **Team Plan ($599/month)**: For larger organizations

**Your Database Schema is Already Designed for Supabase** ✓
- All migrations ready in `DATABASE_SCHEMA.md`
- RLS policies pre-defined
- Compatible with your TypeScript types

### ❌ NOT Recommended: Self-Hosted PostgreSQL on Linode

**Why NOT self-host:**
1. **Maintenance Burden** - OS updates, PostgreSQL upgrades, security patches
2. **Backup Complexity** - Manual backup scripts, testing restore procedures
3. **No High Availability** - Single point of failure without complex clustering
4. **Resource Consumption** - Database competes with app for CPU/RAM
5. **Security Risks** - You're responsible for database hardening
6. **Higher Total Cost** - Need larger Linode instance + backup storage + time

**Only Consider Self-Hosting If:**
- You have strict data sovereignty requirements (e.g., government regulations)
- You need air-gapped deployment (no internet connectivity)
- You have experienced PostgreSQL DBAs on staff

---

## 🚀 Step-by-Step Deployment Guide

### Phase 1: Linode Server Setup (30 minutes)

#### 1.1 Create Linode Instance

```bash
# Recommended Specs:
- Distribution: Ubuntu 22.04 LTS
- Plan: Dedicated 4GB (or Shared 4GB for lower cost)
- Region: Singapore/Tokyo (closest to Malaysia/Japan)
- SSH Key: Upload your public key for secure access
```

**Cost:** ~$24-36/month (Shared) or ~$36-48/month (Dedicated)

#### 1.2 Initial Server Configuration

```bash
# SSH into your Linode
ssh root@your-linode-ip

# Update system packages
apt update && apt upgrade -y

# Create a non-root user with sudo privileges
adduser wifadmin
usermod -aG sudo wifadmin

# Setup SSH key for wifadmin
mkdir -p /home/wifadmin/.ssh
cp /root/.ssh/authorized_keys /home/wifadmin/.ssh/
chown -R wifadmin:wifadmin /home/wifadmin/.ssh
chmod 700 /home/wifadmin/.ssh
chmod 600 /home/wifadmin/.ssh/authorized_keys

# Disable root login for security
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Exit and reconnect as wifadmin
exit
ssh wifadmin@your-linode-ip
```

#### 1.3 Install Required Software

```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version  # Should show v18.x.x
npm --version

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Install PM2 globally (process manager)
sudo npm install -g pm2

# Install Certbot for Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx

# Install build tools for Puppeteer
sudo apt install -y \
  chromium-browser \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libappindicator3-1 \
  libgbm1 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libasound2
```

---

### Phase 2: Supabase Database Setup (45 minutes)

#### 2.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign up with GitHub account
3. Click "New Project"
   - **Project Name**: `wif-finance-production`
   - **Database Password**: Generate strong password (save in password manager)
   - **Region**: `Southeast Asia (Singapore)` (closest to Malaysia/Japan)
   - **Pricing Plan**: Start with Free tier

4. Wait 2-3 minutes for provisioning

#### 2.2 Run Database Migrations

```bash
# On your local machine (not Linode yet)

# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Create migration file
supabase migration new initial_schema

# Copy your database schema from DATABASE_SCHEMA.md to the migration file
```

**Or use Supabase SQL Editor (easier):**

1. Go to Supabase Dashboard → SQL Editor
2. Open `DATABASE_SCHEMA.md` in your project
3. Copy all SQL CREATE TABLE statements
4. Paste into SQL Editor
5. Click "Run"
6. Verify all 10 tables created in Table Editor

#### 2.3 Configure Row-Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements_of_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (we'll restrict later when you add Supabase Auth)
-- This is a temporary policy for initial deployment

CREATE POLICY "Allow all for authenticated users" ON companies
  FOR ALL USING (true);

-- Repeat for all tables (or create a function to do this)
```

#### 2.4 Get API Credentials

In Supabase Dashboard → Settings → API:

- **Project URL**: `https://xxxxx.supabase.co`
- **anon (public) key**: `eyJhbGc...` (safe to expose in frontend)
- **service_role key**: `eyJhbGc...` (NEVER expose, backend only)

**Save these for later!**

---

### Phase 3: Deploy Frontend to Linode (30 minutes)

#### 3.1 Clone Repository on Linode

```bash
# SSH into Linode as wifadmin
ssh wifadmin@your-linode-ip

# Clone your repository
cd ~
git clone https://github.com/mfirdausali/wif-fin.git
cd wif-fin
```

#### 3.2 Configure Environment Variables

```bash
# Create production environment file
nano .env.production

# Add the following:
VITE_PDF_SERVICE_URL=https://yourdomain.com/api/pdf
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### 3.3 Build Frontend

```bash
# Install dependencies
npm install

# Build for production
npm run build

# This creates the /dist folder with optimized static files
```

#### 3.4 Deploy to Nginx

```bash
# Create web root directory
sudo mkdir -p /var/www/wif-fin

# Copy built files
sudo cp -r dist/* /var/www/wif-fin/

# Set permissions
sudo chown -R www-data:www-data /var/www/wif-fin
sudo chmod -R 755 /var/www/wif-fin
```

---

### Phase 4: Deploy PDF Service (30 minutes)

#### 4.1 Configure PDF Service Environment

```bash
# Navigate to PDF service directory
cd ~/wif-fin/pdf-service

# Create .env file
nano .env

# Add:
PORT=3001
NODE_ENV=production
RATE_LIMIT=100
CORS_ORIGIN=https://yourdomain.com
CHROMIUM_PATH=/usr/bin/chromium-browser
```

#### 4.2 Install Dependencies

```bash
# Install PDF service dependencies
npm install --production

# Verify Puppeteer can find Chromium
node -e "const puppeteer = require('puppeteer'); console.log(puppeteer.executablePath());"
```

#### 4.3 Start with PM2

```bash
# Start PDF service with PM2 in cluster mode (2 instances)
pm2 start src/index.js \
  --name wif-pdf-service \
  --instances 2 \
  --exec-mode cluster \
  --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd
# Follow the command it outputs (copy-paste and run)

# Check status
pm2 status
pm2 logs wif-pdf-service
```

#### 4.4 Test PDF Service

```bash
# Test health endpoint
curl http://localhost:3001/health

# Should return: {"status":"ok","message":"PDF service is running"}
```

---

### Phase 5: Nginx Configuration (45 minutes)

#### 5.1 Configure Domain DNS

Before configuring Nginx, you need a domain name:

1. **Purchase a domain** (if you don't have one):
   - Namecheap, Cloudflare, GoDaddy, etc.
   - Example: `wif-finance.com`

2. **Add DNS A Record**:
   - Type: `A`
   - Name: `@` (or `app` for subdomain)
   - Value: `your-linode-ip`
   - TTL: `300` (5 minutes)

3. **Wait for DNS propagation** (5-30 minutes):
   ```bash
   # Check if DNS is propagated
   dig yourdomain.com +short
   # Should return your Linode IP
   ```

#### 5.2 Create Nginx Configuration

```bash
# Create Nginx site configuration
sudo nano /etc/nginx/sites-available/wif-fin

# Paste the following configuration:
```

```nginx
# /etc/nginx/sites-available/wif-fin

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

# Upstream for PDF service
upstream pdf_service {
    least_conn;
    server localhost:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Redirect HTTP to HTTPS (will be configured after SSL)
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Allow Certbot verification
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/wif-fin;
        allow all;
    }

    # Redirect to HTTPS (uncomment after SSL setup)
    # return 301 https://$server_name$request_uri;
}

# Main HTTPS server (will be configured after SSL)
server {
    # Uncomment these after SSL certificates are obtained
    # listen 443 ssl http2;
    # listen [::]:443 ssl http2;

    listen 80;  # Temporary for initial setup
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    # ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;

    # SSL Security Headers
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    # ssl_prefer_server_ciphers on;
    # ssl_session_cache shared:SSL:10m;
    # ssl_session_timeout 10m;
    # ssl_stapling on;
    # ssl_stapling_verify on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    # Uncomment after HTTPS is working:
    # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Document root
    root /var/www/wif-fin;
    index index.html;

    # Max upload size for transfer proofs
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/wif-fin-access.log;
    error_log /var/log/nginx/wif-fin-error.log warn;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss image/svg+xml;

    # PDF Service API Proxy
    location /api/pdf {
        limit_req zone=api_limit burst=20 nodelay;

        # Remove /api/pdf prefix before forwarding
        rewrite ^/api/pdf/(.*) /api/pdf/$1 break;

        proxy_pass http://pdf_service;
        proxy_http_version 1.1;

        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Timeouts for PDF generation (can take 10-30 seconds)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Health check endpoint (no rate limit)
    location /api/pdf/health {
        proxy_pass http://pdf_service/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Frontend SPA - serve index.html for all routes (React Router)
    location / {
        limit_req zone=general_limit burst=50 nodelay;
        try_files $uri $uri/ /index.html;

        # No caching for HTML files
        location ~ \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

**Important:** Replace `yourdomain.com` with your actual domain!

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/wif-fin /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If successful, reload Nginx
sudo systemctl reload nginx
```

#### 5.3 Setup SSL/TLS with Let's Encrypt

```bash
# Obtain SSL certificate (replace with your domain and email)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --email your@email.com --agree-tos --no-eff-email

# Certbot will automatically modify your Nginx config to add SSL

# Test auto-renewal
sudo certbot renew --dry-run

# Certificate will auto-renew every 60 days
```

#### 5.4 Enable HTTPS Redirect

After SSL is working, edit Nginx config to uncomment HTTPS settings:

```bash
sudo nano /etc/nginx/sites-available/wif-fin

# Uncomment all SSL-related lines marked with #
# Uncomment the "return 301 https://..." line in the HTTP server block

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

### Phase 6: Firewall Configuration (15 minutes)

#### 6.1 Configure UFW (Uncomplicated Firewall)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Deny access to PDF service port from outside
sudo ufw deny 3001/tcp comment 'PDF Service - Internal Only'

# Check status
sudo ufw status verbose
```

#### 6.2 Linode Cloud Firewall (Recommended)

In Linode Cloud Manager:

1. Create Firewall → "WIF-Finance-Firewall"
2. Inbound Rules:
   - **SSH**: TCP 22, Accept (restrict to your IP if possible)
   - **HTTP**: TCP 80, Accept
   - **HTTPS**: TCP 443, Accept
3. Outbound Rules:
   - **Allow all** (for Supabase, npm, system updates)
4. Assign to your Linode instance

---

### Phase 7: Monitoring & Maintenance (30 minutes)

#### 7.1 PM2 Monitoring

```bash
# Install PM2 monitoring (optional, but recommended)
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# View real-time logs
pm2 logs

# View process metrics
pm2 monit
```

#### 7.2 Nginx Log Monitoring

```bash
# View access logs
sudo tail -f /var/log/nginx/wif-fin-access.log

# View error logs
sudo tail -f /var/log/nginx/wif-fin-error.log

# Analyze top IPs (detect attacks)
sudo cat /var/log/nginx/wif-fin-access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
```

#### 7.3 Setup Automated Backups

**Database Backups (Supabase):**
- Already handled by Supabase automatically
- Free tier: Daily backups (7-day retention)
- Pro tier: Point-in-time recovery

**Application Code Backup:**
```bash
# Create backup script
nano ~/backup-wif-fin.sh

# Add:
#!/bin/bash
BACKUP_DIR="/home/wifadmin/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/wif-fin-$DATE.tar.gz /var/www/wif-fin ~/wif-fin

# Keep only last 7 backups
ls -t $BACKUP_DIR/wif-fin-*.tar.gz | tail -n +8 | xargs rm -f

# Make executable
chmod +x ~/backup-wif-fin.sh

# Schedule daily backups with cron
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * /home/wifadmin/backup-wif-fin.sh
```

#### 7.4 Setup Uptime Monitoring

**Recommended Free Services:**
1. **UptimeRobot** (https://uptimerobot.com)
   - Free: 50 monitors, 5-minute checks
   - Monitor: `https://yourdomain.com`
   - Alert via email/SMS when down

2. **Healthchecks.io** (https://healthchecks.io)
   - Monitor cron jobs and background tasks

3. **PM2.io** (https://pm2.io)
   - Free monitoring for PM2 processes
   - Real-time metrics dashboard

---

### Phase 8: Deployment Automation (Optional, 30 minutes)

#### 8.1 Create Deployment Script

```bash
# Create deployment script
nano ~/deploy-wif-fin.sh

# Add:
```

```bash
#!/bin/bash

set -e  # Exit on error

echo "🚀 Starting WIF Finance Deployment..."

# Navigate to project directory
cd ~/wif-fin

# Pull latest changes from GitHub
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Deploy to Nginx
echo "📂 Deploying to Nginx..."
sudo rm -rf /var/www/wif-fin/*
sudo cp -r dist/* /var/www/wif-fin/
sudo chown -R www-data:www-data /var/www/wif-fin

# Update PDF service
echo "🔄 Updating PDF service..."
cd pdf-service
npm install --production

# Restart PDF service with PM2
echo "♻️ Restarting PDF service..."
pm2 restart wif-pdf-service

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "🌐 Visit: https://yourdomain.com"
```

```bash
# Make executable
chmod +x ~/deploy-wif-fin.sh

# Run deployment
~/deploy-wif-fin.sh
```

---

## 🔒 Security Checklist

### Pre-Deployment Security

- [ ] Change all default passwords
- [ ] Generate strong Supabase database password
- [ ] Use SSH keys (disable password authentication)
- [ ] Configure UFW firewall
- [ ] Setup Linode Cloud Firewall
- [ ] Obtain SSL/TLS certificates (Let's Encrypt)
- [ ] Enable HTTPS redirect
- [ ] Configure security headers in Nginx
- [ ] Set proper file permissions (755 for directories, 644 for files)
- [ ] Review Nginx rate limiting configuration

### Post-Deployment Security

- [ ] Enable fail2ban for SSH brute-force protection
- [ ] Setup automatic security updates
- [ ] Configure log monitoring and alerting
- [ ] Review Supabase RLS policies
- [ ] Implement CORS properly in PDF service
- [ ] Setup backup verification (test restore)
- [ ] Document incident response procedures
- [ ] Schedule regular security audits

### Additional Security Measures

```bash
# Install fail2ban (SSH brute-force protection)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Enable automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 💰 Cost Breakdown

### Monthly Costs (USD)

| Service | Plan | Cost |
|---------|------|------|
| **Linode Compute** | Shared 4GB | $24/mo |
| **Supabase** | Free Tier | $0/mo |
| **Domain** | .com domain | $12/year ($1/mo) |
| **SSL Certificate** | Let's Encrypt | $0/mo |
| **Backups** | Linode Backups (optional) | $5/mo |
| **Monitoring** | UptimeRobot Free | $0/mo |
| **Total** | | **~$25-30/mo** |

### Scaling Costs

**When you need to scale (500+ users):**

| Service | Plan | Cost |
|---------|------|------|
| Linode Compute | Dedicated 8GB | $60/mo |
| Supabase | Pro Plan | $25/mo |
| Linode Load Balancer | (optional) | $10/mo |
| **Total** | | **$95/mo** |

---

## 🧪 Testing Your Deployment

### 1. Frontend Tests

```bash
# Test homepage
curl -I https://yourdomain.com

# Should return:
# HTTP/2 200
# content-type: text/html

# Test HTTPS redirect
curl -I http://yourdomain.com
# Should return: HTTP/1.1 301 Moved Permanently
```

### 2. PDF Service Tests

```bash
# Test health endpoint
curl https://yourdomain.com/api/pdf/health

# Should return: {"status":"ok","message":"PDF service is running"}

# Test PDF generation (from your local machine)
curl -X POST https://yourdomain.com/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -d @test-invoice.json \
  --output test.pdf
```

### 3. Database Connection Test

Create a test file on Linode:

```bash
nano ~/test-supabase.js

# Add:
```

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xxxxx.supabase.co',
  'your-anon-key'
);

async function testConnection() {
  const { data, error } = await supabase
    .from('companies')
    .select('count');

  if (error) {
    console.error('❌ Connection failed:', error);
  } else {
    console.log('✅ Database connected successfully!');
  }
}

testConnection();
```

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Run test
node ~/test-supabase.js
```

### 4. Performance Tests

```bash
# Install Apache Bench (if not already installed)
sudo apt install -y apache2-utils

# Test homepage performance
ab -n 1000 -c 10 https://yourdomain.com/

# Test PDF API performance
ab -n 100 -c 5 -p test-invoice.json -T application/json https://yourdomain.com/api/pdf/invoice
```

---

## 🚨 Troubleshooting Guide

### Issue: 502 Bad Gateway

**Cause:** PDF service is not running

**Fix:**
```bash
pm2 status
pm2 restart wif-pdf-service
pm2 logs wif-pdf-service --lines 50
```

### Issue: SSL Certificate Errors

**Cause:** Certificate not properly installed or expired

**Fix:**
```bash
# Renew certificate
sudo certbot renew --force-renewal

# Reload Nginx
sudo systemctl reload nginx
```

### Issue: PDF Generation Timeout

**Cause:** Puppeteer taking too long or crashed

**Fix:**
```bash
# Check PDF service logs
pm2 logs wif-pdf-service

# Increase timeout in Nginx config
# proxy_read_timeout 120s;  (change from 60s to 120s)

# Check Chromium installation
dpkg -l | grep chromium
```

### Issue: Database Connection Refused

**Cause:** Supabase credentials incorrect or network issue

**Fix:**
```bash
# Verify environment variables
cat ~/wif-fin/.env.production | grep SUPABASE

# Test network connectivity to Supabase
ping xxxxx.supabase.co

# Check Supabase project status in dashboard
```

### Issue: High Memory Usage

**Cause:** PDF service spawning too many Chromium instances

**Fix:**
```bash
# Reduce PM2 instances
pm2 delete wif-pdf-service
pm2 start src/index.js --name wif-pdf-service --instances 1

# Monitor memory
pm2 monit

# Check system resources
htop
```

---

## 📈 Performance Optimization

### 1. Enable Nginx Caching

Add to Nginx config:

```nginx
# Add to http block in /etc/nginx/nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=pdf_cache:10m max_size=100m inactive=60m;

# Add to location /api/pdf block
proxy_cache pdf_cache;
proxy_cache_valid 200 10m;
proxy_cache_key "$scheme$request_method$host$request_uri$request_body";
```

### 2. Enable HTTP/2

Already enabled in the Nginx config (`listen 443 ssl http2`)

### 3. Optimize Puppeteer

Edit `pdf-service/src/index.js`:

```javascript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // Reduce memory usage
    '--disable-gpu',
    '--single-process',  // Use single process mode
  ],
  executablePath: '/usr/bin/chromium-browser',
});
```

### 4. Database Query Optimization

In your future Supabase queries, add indexes:

```sql
-- Add indexes for common queries
CREATE INDEX idx_documents_company_date ON documents(company_id, document_date DESC);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date DESC);
```

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Linode

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Deploy via SSH
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.LINODE_IP }}
        username: wifadmin
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd ~/wif-fin
          ~/deploy-wif-fin.sh
```

Add secrets in GitHub:
- `LINODE_IP`: Your Linode IP address
- `SSH_PRIVATE_KEY`: Your SSH private key

---

## 📚 Next Steps After Deployment

1. **Migrate Data from localStorage to Supabase**
   - Create data export script
   - Transform to Supabase format
   - Bulk insert via Supabase API

2. **Implement Supabase Auth**
   - Replace localStorage auth with Supabase Auth
   - Enable JWT token authentication
   - Add OAuth providers (Google, Microsoft)

3. **Add Backend API Layer** (Optional)
   - Create Express.js backend on Linode
   - Move business logic from frontend to backend
   - Implement server-side validation

4. **Setup Email Notifications**
   - Use SendGrid, Mailgun, or AWS SES
   - Password reset emails
   - Document approval notifications

5. **Add Real-time Features**
   - Use Supabase Realtime
   - Live document updates
   - Multi-user collaboration

6. **Implement Advanced Monitoring**
   - Sentry for error tracking
   - LogRocket for session replay
   - Google Analytics for usage tracking

---

## 🎯 Summary

You now have a **production-ready deployment architecture** with:

✅ **Scalable Infrastructure**: Linode compute + Supabase cloud database
✅ **High Security**: SSL/TLS, firewall, security headers, RLS
✅ **High Performance**: Nginx caching, HTTP/2, Gzip compression
✅ **High Availability**: PM2 cluster mode, health monitoring
✅ **Cost-Effective**: ~$25-30/month for small-medium deployments
✅ **Easy Maintenance**: Automated backups, log rotation, deployment script
✅ **Future-Proof**: Ready to scale to thousands of users

**Total Setup Time**: ~4-6 hours (including testing)

**Your application architecture is excellent** - well-designed, type-safe, and ready for production. The combination of Linode (compute) + Supabase (database) gives you the best of both worlds: control over your application layer and managed database infrastructure.

---

## 📞 Support Resources

- **Linode Support**: https://www.linode.com/support
- **Supabase Documentation**: https://supabase.com/docs
- **Let's Encrypt Community**: https://community.letsencrypt.org
- **Nginx Documentation**: https://nginx.org/en/docs
- **PM2 Documentation**: https://pm2.keymetrics.io/docs

---

**Document Version**: 1.0
**Last Updated**: 2025-01-20
**Author**: Claude (Anthropic)
**License**: MIT
