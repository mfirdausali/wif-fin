#!/bin/bash
# ============================================================================
# PDF Service HTTPS Setup Script
# This script sets up HTTPS for the PDF service using nginx reverse proxy
# ============================================================================

set -e

echo "========================================="
echo "PDF Service HTTPS Setup"
echo "========================================="
echo ""

# Check if we're on the PDF service server
if [ ! -f "/home/ec2-user/wif-fin/pdf-service/package.json" ]; then
    echo "⚠️  This script should be run on the PDF service EC2 instance"
    echo "Current server doesn't seem to be the PDF service server"
    echo ""
    echo "To run this script on the PDF service server:"
    echo "1. SSH to the server:"
    echo "   ssh -i your-key.pem ec2-user@18.141.140.2"
    echo "2. Copy this script to the server"
    echo "3. Run: bash setup-pdf-https.sh"
    exit 1
fi

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Error: Domain name required"
    echo ""
    echo "Usage: $0 <domain-name>"
    echo "Example: $0 pdf.wifjapan.com"
    echo ""
    echo "Note: Make sure the domain DNS is pointed to this server's IP first!"
    exit 1
fi

DOMAIN=$1
echo "Setting up HTTPS for domain: $DOMAIN"
echo ""

# Install nginx and certbot
echo "📦 Installing nginx and certbot..."
sudo yum update -y
sudo yum install -y nginx certbot python3-certbot-nginx

# Create nginx configuration
echo "📝 Creating nginx configuration..."
sudo tee /etc/nginx/conf.d/pdf-service.conf > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to PDF service
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

        # Increase timeouts for PDF generation
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
echo "Note: Make sure DNS is pointing to this server!"
echo ""
read -p "Press Enter to continue or Ctrl+C to abort..."

sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@wifjapan.com

# Verify SSL
echo ""
echo "✅ Setup complete!"
echo ""
echo "Your PDF service is now available at: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Update .env.production on the frontend:"
echo "   VITE_PDF_SERVICE_URL=https://$DOMAIN"
echo ""
echo "2. Rebuild and deploy the frontend:"
echo "   npm run build"
echo "   npm run deploy"
echo ""
echo "3. Test the PDF service:"
echo "   curl https://$DOMAIN/health"
echo ""
