# WIF Finance - Linode Quick Start (30-Minute Version)

This is the express version for experienced developers who want to get the app running quickly.

**Full details**: See `LINODE_DEPLOYMENT_GUIDE.md`

---

## Prerequisites (5 minutes)

1. **Linode account** with payment method
2. **Supabase account** (free tier)
3. **Domain name** with DNS access
4. **SSH key** generated locally

---

## 1. Linode Setup (10 minutes)

```bash
# Create Linode instance:
# - Ubuntu 22.04 LTS
# - Shared 4GB or Dedicated 4GB
# - Region: Singapore/Tokyo
# - Add your SSH key

# SSH in
ssh root@YOUR_LINODE_IP

# Quick setup script
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs nginx git certbot python3-certbot-nginx chromium-browser \
  fonts-liberation libnss3 libatk-bridge2.0-0 libx11-xcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxi6 libxtst6 libappindicator3-1 libgbm1 \
  libpango-1.0-0 libpangocairo-1.0-0 libasound2

npm install -g pm2

# Create non-root user
adduser wifadmin  # Set password when prompted
usermod -aG sudo wifadmin
mkdir -p /home/wifadmin/.ssh
cp /root/.ssh/authorized_keys /home/wifadmin/.ssh/
chown -R wifadmin:wifadmin /home/wifadmin/.ssh
chmod 700 /home/wifadmin/.ssh
chmod 600 /home/wifadmin/.ssh/authorized_keys

# Reconnect as wifadmin
exit
ssh wifadmin@YOUR_LINODE_IP
```

---

## 2. Supabase Setup (15 minutes)

1. Go to https://supabase.com
2. New Project → Name: `wif-finance` → Region: `Southeast Asia (Singapore)`
3. Save database password
4. Wait 2 minutes for provisioning
5. Go to SQL Editor → New Query
6. Copy ALL SQL from `DATABASE_SCHEMA.md` → Paste → Run
7. Verify 10 tables created in Table Editor
8. Go to Settings → API → Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon key**: `eyJhbGc...`

---

## 3. Deploy Application (10 minutes)

```bash
# Clone repo
cd ~
git clone https://github.com/mfirdausali/wif-fin.git
cd wif-fin

# Configure frontend
cat > .env.production << 'EOF'
VITE_PDF_SERVICE_URL=https://YOUR_DOMAIN.com/api/pdf
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF

# Build frontend
npm install
npm run build

# Deploy to Nginx
sudo mkdir -p /var/www/wif-fin
sudo cp -r dist/* /var/www/wif-fin/
sudo chown -R www-data:www-data /var/www/wif-fin

# Configure PDF service
cd pdf-service
cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://YOUR_DOMAIN.com
CHROMIUM_PATH=/usr/bin/chromium-browser
EOF

npm install --production

# Start with PM2
pm2 start src/index.js --name wif-pdf-service --instances 2 --exec-mode cluster
pm2 save
pm2 startup systemd  # Run the command it outputs
```

---

## 4. Configure Nginx (10 minutes)

```bash
# Add DNS A record first:
# Type: A, Name: @, Value: YOUR_LINODE_IP

# Wait for DNS propagation (check with: dig YOUR_DOMAIN.com)

# Create Nginx config
sudo nano /etc/nginx/sites-available/wif-fin
```

Paste this (replace `YOUR_DOMAIN.com`):

```nginx
upstream pdf_service {
    server localhost:3001;
}

server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;
    root /var/www/wif-fin;
    index index.html;

    client_max_body_size 10M;

    location /api/pdf {
        proxy_pass http://pdf_service;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/wif-fin /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com --email YOUR_EMAIL --agree-tos

# Setup firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 5. Test Deployment (5 minutes)

```bash
# Test frontend
curl -I https://YOUR_DOMAIN.com
# Should return: HTTP/2 200

# Test PDF service
curl https://YOUR_DOMAIN.com/api/pdf/health
# Should return: {"status":"ok","message":"PDF service is running"}

# Check PM2
pm2 status
pm2 logs wif-pdf-service --lines 20
```

Open browser: `https://YOUR_DOMAIN.com`

---

## Quick Deployment Script

Save this as `deploy.sh`:

```bash
#!/bin/bash
cd ~/wif-fin
git pull origin main
npm install
npm run build
sudo rm -rf /var/www/wif-fin/*
sudo cp -r dist/* /var/www/wif-fin/
sudo chown -R www-data:www-data /var/www/wif-fin
cd pdf-service
npm install --production
pm2 restart wif-pdf-service
sudo systemctl reload nginx
echo "✅ Deployed!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Costs

- **Linode 4GB**: $24/month
- **Supabase Free**: $0/month
- **Domain**: ~$12/year
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$25-30/month

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | `pm2 restart wif-pdf-service` |
| SSL not working | `sudo certbot renew --force-renewal` |
| Changes not showing | `./deploy.sh` |

---

## Next Steps

1. Setup automated backups (see full guide)
2. Configure monitoring (UptimeRobot)
3. Migrate data from localStorage to Supabase
4. Add GitHub Actions for CI/CD

**Full documentation**: `LINODE_DEPLOYMENT_GUIDE.md`
