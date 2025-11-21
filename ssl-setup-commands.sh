#!/bin/bash
# SSL Setup Commands for PDF Server
# Run these commands on the EC2 instance at 18.141.140.2
# Access via: AWS Console → EC2 → Instance Connect

set -e

echo "========================================="
echo "PDF Service HTTPS Setup"
echo "pdf.wifjapan.com:3001"
echo "========================================="
echo ""

# Install nginx and certbot
echo "📦 Installing nginx and certbot..."
sudo yum update -y
sudo yum install -y nginx certbot python3-certbot-nginx

# Verify PDF service is running
echo "🔍 Checking if PDF service is running..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ PDF service is running on port 3001"
else
    echo "❌ PDF service not found on port 3001"
    echo "   Please start the PDF service first"
    exit 1
fi

# Configure nginx
echo "📝 Configuring nginx reverse proxy..."
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

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
sudo nginx -t

# Start nginx
echo "🚀 Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Get SSL certificate
echo "🔐 Obtaining SSL certificate from Let's Encrypt..."
echo "   Domain: pdf.wifjapan.com"
echo "   Email: admin@wifjapan.com"
echo ""
sudo certbot --nginx -d pdf.wifjapan.com --non-interactive --agree-tos --email admin@wifjapan.com

# Test HTTPS
echo ""
echo "🧪 Testing HTTPS..."
sleep 2

if curl -s https://pdf.wifjapan.com:3001/health > /dev/null; then
    echo "✅ HTTPS is working!"
    curl -s https://pdf.wifjapan.com:3001/health | head -5
else
    echo "⚠️  HTTPS test failed. Checking HTTP..."
    curl -s http://pdf.wifjapan.com:3001/health | head -5
fi

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "Your PDF service is now available at:"
echo "   https://pdf.wifjapan.com:3001"
echo ""
echo "Next: Update your frontend .env.production and redeploy"
echo ""
