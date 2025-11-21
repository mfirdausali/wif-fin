#!/bin/bash
# Setup nginx + Let's Encrypt on PDF Service Server
# Run this ON THE PDF SERVICE EC2 INSTANCE

set -e

DOMAIN=${1:-pdf.wifjapan.com}
EMAIL=${2:-admin@wifjapan.com}

echo "========================================="
echo "PDF Service HTTPS Setup (nginx + SSL)"
echo "========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Check if we're on the right server
if ! netstat -tuln | grep -q ":3001"; then
    echo "❌ Error: PDF service not running on port 3001"
    echo "   Make sure you're on the PDF service EC2 instance"
    exit 1
fi

echo "✅ PDF service detected on port 3001"
echo ""

# Install packages
echo "📦 Installing nginx and certbot..."
sudo yum update -y
sudo yum install -y nginx certbot python3-certbot-nginx

# Configure nginx
echo "📝 Configuring nginx..."
sudo tee /etc/nginx/conf.d/pdf-service.conf > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # PDF generation timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Test nginx config
echo "🔍 Testing nginx configuration..."
sudo nginx -t

# Start nginx
echo "🚀 Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

echo ""
echo "⚠️  IMPORTANT: Before continuing, make sure DNS is configured:"
echo "   Create an A record: $DOMAIN → $(curl -s ifconfig.me)"
echo ""
echo "   Check DNS propagation:"
echo "   nslookup $DOMAIN"
echo ""
read -p "Press Enter when DNS is ready, or Ctrl+C to abort..."

# Get SSL certificate
echo ""
echo "🔐 Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL

# Test SSL
echo ""
echo "🧪 Testing HTTPS..."
sleep 2
curl -s https://$DOMAIN/health | head -20

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "Your PDF service is now available at:"
echo "   https://$DOMAIN"
echo ""
echo "Next steps on your LOCAL machine:"
echo ""
echo "1. Update .env.production:"
echo "   VITE_PDF_SERVICE_URL=https://$DOMAIN"
echo ""
echo "2. Rebuild frontend:"
echo "   npm run build"
echo ""
echo "3. Deploy frontend:"
echo "   npm run deploy"
echo ""
echo "4. Test at:"
echo "   https://finance.wifjapan.com"
echo ""
