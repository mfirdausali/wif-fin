# WIF Finance - Deployment Checklist

## Quick Reference Checklist

Use this checklist to track your deployment progress.

---

## Pre-Deployment Preparation

### Domain & DNS
- [ ] Purchase domain name (or use existing)
- [ ] Configure DNS A record pointing to Linode IP
- [ ] Verify DNS propagation (`dig yourdomain.com`)

### Accounts & Credentials
- [ ] Create Linode account
- [ ] Create Supabase account
- [ ] Generate SSH key pair
- [ ] Save all credentials in password manager

### Local Development
- [ ] Test application locally (`npm run dev`)
- [ ] Test PDF service locally
- [ ] Review environment variables needed
- [ ] Commit all changes to GitHub

---

## Phase 1: Linode Server Setup (30 min)

- [ ] Create Linode instance (Ubuntu 22.04, 4GB RAM)
- [ ] Add SSH key to Linode
- [ ] Note down Linode IP address
- [ ] SSH into server as root
- [ ] Update system packages (`apt update && apt upgrade`)
- [ ] Create non-root user (`wifadmin`)
- [ ] Setup SSH key for wifadmin
- [ ] Disable root login
- [ ] Install Node.js 18.x
- [ ] Install Nginx
- [ ] Install Git
- [ ] Install PM2 globally
- [ ] Install Certbot
- [ ] Install Chromium and dependencies for Puppeteer
- [ ] Verify all installations

---

## Phase 2: Supabase Database (45 min)

- [ ] Create Supabase project
- [ ] Choose region (Southeast Asia - Singapore)
- [ ] Save database password
- [ ] Wait for project provisioning
- [ ] Copy SQL schema from DATABASE_SCHEMA.md
- [ ] Run migrations in SQL Editor
- [ ] Verify all 10 tables created
- [ ] Enable Row-Level Security on all tables
- [ ] Create temporary RLS policies
- [ ] Save Supabase URL
- [ ] Save anon key (public)
- [ ] Save service_role key (secret)
- [ ] Test connection from local machine

---

## Phase 3: Frontend Deployment (30 min)

- [ ] SSH into Linode
- [ ] Clone GitHub repository
- [ ] Create `.env.production` file
- [ ] Add VITE_PDF_SERVICE_URL
- [ ] Add VITE_SUPABASE_URL
- [ ] Add VITE_SUPABASE_ANON_KEY
- [ ] Install dependencies (`npm install`)
- [ ] Build production bundle (`npm run build`)
- [ ] Verify `dist/` folder created
- [ ] Create `/var/www/wif-fin` directory
- [ ] Copy built files to web root
- [ ] Set correct permissions (www-data:www-data)

---

## Phase 4: PDF Service Deployment (30 min)

- [ ] Navigate to `pdf-service` directory
- [ ] Create `.env` file
- [ ] Configure PORT=3001
- [ ] Configure NODE_ENV=production
- [ ] Configure CORS_ORIGIN with your domain
- [ ] Set CHROMIUM_PATH=/usr/bin/chromium-browser
- [ ] Install dependencies (`npm install --production`)
- [ ] Verify Puppeteer finds Chromium
- [ ] Start with PM2 (cluster mode, 2 instances)
- [ ] Save PM2 configuration
- [ ] Setup PM2 startup script
- [ ] Test health endpoint (curl localhost:3001/health)
- [ ] Check PM2 status and logs

---

## Phase 5: Nginx Configuration (45 min)

- [ ] Create Nginx site config (`/etc/nginx/sites-available/wif-fin`)
- [ ] Update `server_name` with your domain
- [ ] Enable site (symlink to sites-enabled)
- [ ] Remove default site
- [ ] Test Nginx configuration (`nginx -t`)
- [ ] Reload Nginx
- [ ] Obtain SSL certificate with Certbot
- [ ] Verify SSL certificate installation
- [ ] Test HTTPS redirect
- [ ] Uncomment SSL security headers
- [ ] Test final Nginx configuration
- [ ] Reload Nginx again

---

## Phase 6: Firewall & Security (15 min)

- [ ] Enable UFW firewall
- [ ] Allow SSH (port 22)
- [ ] Allow HTTP (port 80)
- [ ] Allow HTTPS (port 443)
- [ ] Deny PDF service port (3001) from outside
- [ ] Verify UFW status
- [ ] Create Linode Cloud Firewall
- [ ] Configure inbound rules
- [ ] Configure outbound rules
- [ ] Assign firewall to Linode instance
- [ ] Test SSH access still works
- [ ] Test HTTPS access from browser

---

## Phase 7: Monitoring & Backups (30 min)

- [ ] Install PM2 log rotation
- [ ] Configure log rotation settings
- [ ] Test PM2 monitoring (`pm2 monit`)
- [ ] Create backup script
- [ ] Make backup script executable
- [ ] Test backup script manually
- [ ] Schedule daily backups with cron
- [ ] Verify Supabase automatic backups enabled
- [ ] Setup UptimeRobot monitoring
- [ ] Add email/SMS alerts
- [ ] Setup PM2.io monitoring (optional)
- [ ] Document monitoring dashboard URLs

---

## Phase 8: Testing & Validation (30 min)

- [ ] Test homepage loads (https://yourdomain.com)
- [ ] Test HTTPS redirect from HTTP
- [ ] Verify SSL certificate (green lock icon)
- [ ] Test user login/logout
- [ ] Test creating a document
- [ ] Test PDF generation
- [ ] Test PDF download
- [ ] Verify database writes to Supabase
- [ ] Test on mobile browser
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Run performance test with Apache Bench
- [ ] Check Nginx access logs
- [ ] Check Nginx error logs
- [ ] Check PM2 logs for errors
- [ ] Verify all security headers present

---

## Post-Deployment Tasks

### Documentation
- [ ] Document server IP address
- [ ] Document domain name
- [ ] Document SSH access details
- [ ] Document Supabase credentials
- [ ] Document PM2 commands
- [ ] Document deployment process
- [ ] Create runbook for common issues

### Security Hardening
- [ ] Install fail2ban
- [ ] Enable automatic security updates
- [ ] Review Supabase RLS policies
- [ ] Change all default passwords
- [ ] Setup SSH key-only authentication
- [ ] Configure security monitoring alerts
- [ ] Schedule regular security audits

### Performance Optimization
- [ ] Enable Nginx caching for PDFs
- [ ] Optimize Puppeteer settings
- [ ] Add database indexes
- [ ] Configure CDN (optional)
- [ ] Enable HTTP/2 push (optional)

### Automation
- [ ] Create deployment script
- [ ] Test deployment script
- [ ] Setup GitHub Actions CI/CD (optional)
- [ ] Document deployment workflow

---

## Ongoing Maintenance

### Daily
- [ ] Check uptime monitoring alerts
- [ ] Review error logs if issues reported

### Weekly
- [ ] Review PM2 logs for errors
- [ ] Check disk space usage
- [ ] Review Nginx access logs
- [ ] Monitor CPU/RAM usage

### Monthly
- [ ] Review Supabase usage statistics
- [ ] Test backup restoration
- [ ] Review security logs
- [ ] Update system packages
- [ ] Review SSL certificate expiration (auto-renews every 60 days)

### Quarterly
- [ ] Security audit
- [ ] Performance review
- [ ] Cost optimization review
- [ ] Disaster recovery drill

---

## Emergency Contacts

| Service | Support URL | Notes |
|---------|-------------|-------|
| Linode | https://www.linode.com/support | 24/7 support |
| Supabase | https://supabase.com/dashboard/support | Email support |
| Domain Registrar | | Check your registrar |

---

## Quick Commands Reference

### SSH Access
```bash
ssh wifadmin@your-linode-ip
```

### Deployment
```bash
~/deploy-wif-fin.sh
```

### PM2 Management
```bash
pm2 status
pm2 logs wif-pdf-service
pm2 restart wif-pdf-service
pm2 monit
```

### Nginx Management
```bash
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Reload
sudo systemctl restart nginx     # Restart
```

### View Logs
```bash
# Nginx access logs
sudo tail -f /var/log/nginx/wif-fin-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/wif-fin-error.log

# PM2 logs
pm2 logs wif-pdf-service
```

### SSL Certificate
```bash
# Renew certificate (auto-renews, but manual option available)
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

---

## Troubleshooting Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| 502 Bad Gateway | `pm2 restart wif-pdf-service` |
| SSL not working | `sudo certbot renew --force-renewal && sudo systemctl reload nginx` |
| High memory | `pm2 restart wif-pdf-service` (reduces instances) |
| Site not loading | Check `sudo systemctl status nginx` |
| PDF timeout | Increase `proxy_read_timeout` in Nginx config |

---

## Success Criteria

Your deployment is successful when:

✅ Homepage loads via HTTPS
✅ HTTP automatically redirects to HTTPS
✅ SSL certificate shows as valid (green lock)
✅ User can login/logout
✅ Documents can be created and saved
✅ PDFs can be generated and downloaded
✅ Data persists in Supabase database
✅ PM2 shows all processes running
✅ Nginx logs show no errors
✅ Uptime monitoring shows 100% uptime
✅ Backup script runs successfully
✅ All security headers present (check with securityheaders.com)

---

## Estimated Timeline

| Phase | Time | Cumulative |
|-------|------|------------|
| Pre-deployment prep | 30 min | 30 min |
| Linode server setup | 30 min | 1 hour |
| Supabase database | 45 min | 1h 45m |
| Frontend deployment | 30 min | 2h 15m |
| PDF service deployment | 30 min | 2h 45m |
| Nginx configuration | 45 min | 3h 30m |
| Firewall & security | 15 min | 3h 45m |
| Monitoring & backups | 30 min | 4h 15m |
| Testing & validation | 30 min | 4h 45m |
| Documentation | 15 min | 5 hours |

**Total Deployment Time**: 4-6 hours (including breaks and troubleshooting)

---

## Cost Tracker

| Item | Monthly Cost |
|------|--------------|
| Linode Shared 4GB | $24 |
| Supabase Free Tier | $0 |
| Domain (.com) | ~$1 (annual/12) |
| SSL Certificate (Let's Encrypt) | $0 |
| Linode Backups (optional) | $5 |
| **Total** | **~$25-30** |

---

**Ready to deploy?** Start with Phase 1 and check off each item as you complete it. Good luck!
