# 🚀 WIF Finance - Final Setup Steps

## ✅ What's Already Done
- ✅ SSL Certificate issued
- ✅ CloudFront distribution created
- ✅ Configuration updated

## 📋 What You Need to Do NOW

### Step 1: Add DNS Record in Cloudflare (5 minutes)

1. **Go to Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com/
   ```

2. **Select your domain**: `wifjapan.com`

3. **Click**: DNS → Add record

4. **Add CNAME Record**:
   ```
   Type:    CNAME
   Name:    finance
   Target:  d3iesx5hq3slg3.cloudfront.net
   Proxy:   🔴 DNS only (GREY cloud - NOT orange!)
   TTL:     Auto
   ```

5. **Click Save**

**CRITICAL**: Make sure the cloud icon is **GREY**, not orange!

---

## ⏰ Wait ~20 Minutes

After adding the DNS record:
- CloudFront needs to finish deploying (15-20 mins from when you ran the script)
- Started at: Check your terminal
- Should be ready by: ~20 minutes from start

---

## 🧪 Test Your Site (After 20 minutes)

### Test 1: Check DNS
```bash
nslookup finance.wifjapan.com
# Should show: d3iesx5hq3slg3.cloudfront.net
```

### Test 2: Check HTTPS
```bash
curl -I https://finance.wifjapan.com
# Should return: HTTP/2 200
```

### Test 3: Check CloudFront Status
```bash
aws cloudfront get-distribution \
  --id E10R2ZLIGYCY0W \
  --query 'Distribution.Status'
# Should say: "Deployed"
```

### Test 4: Open in Browser
```
https://finance.wifjapan.com
```

---

## 📊 Your Configuration

| Item | Value |
|------|-------|
| **Custom Domain** | https://finance.wifjapan.com |
| **CloudFront ID** | E10R2ZLIGYCY0W |
| **CloudFront Domain** | d3iesx5hq3slg3.cloudfront.net |
| **Certificate ARN** | arn:aws:acm:us-east-1:387158738611:certificate/5765a07c-de80-401e-829a-00b496e069bd |
| **DNS Provider** | Cloudflare |
| **PDF Service** | http://18.141.140.2:3001 |

---

## 🎯 Quick Checklist

- [ ] Add CNAME in Cloudflare (do this now!)
- [ ] Orange cloud is OFF (grey, not orange)
- [ ] Wait 20 minutes
- [ ] Test DNS: `nslookup finance.wifjapan.com`
- [ ] Test HTTPS: `curl -I https://finance.wifjapan.com`
- [ ] Open in browser: https://finance.wifjapan.com
- [ ] Test all features (documents, PDF generation, etc.)

---

## 🆘 Troubleshooting

### Still getting errors after 20 minutes?

**Check CloudFront Status:**
```bash
aws cloudfront get-distribution --id E10R2ZLIGYCY0W \
  --query 'Distribution.Status'
```

**If status is "Deployed" but site doesn't work:**
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E10R2ZLIGYCY0W \
  --paths "/*"
```

**DNS not resolving:**
```bash
# Check from Google DNS
nslookup finance.wifjapan.com 8.8.8.8

# If still not working, check Cloudflare DNS settings
```

**SSL Error:**
- Make sure orange cloud is OFF in Cloudflare
- Wait full 20 minutes for CloudFront

---

## 📱 Share Your Site

Once it's working:
- Primary URL: **https://finance.wifjapan.com**
- No more ugly S3 URLs!
- Free SSL certificate (HTTPS)
- Global CDN for fast access

---

## 🔄 Future Deployments

When you update your app:

```bash
# 1. Build and deploy
./deploy-aws.sh

# 2. Invalidate CloudFront cache (so users see new version)
aws cloudfront create-invalidation \
  --distribution-id E10R2ZLIGYCY0W \
  --paths "/*"

# 3. Wait 1-2 minutes
# 4. Visit https://finance.wifjapan.com (hard refresh: Cmd+Shift+R)
```

---

## 🎉 You're Almost Done!

**Right now:** Add the CNAME in Cloudflare
**In 20 mins:** Your site is live at https://finance.wifjapan.com!

Need help? Check `CLOUDFLARE_DNS_SETUP.md` for detailed guide.
