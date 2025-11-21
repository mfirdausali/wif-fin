# Cloudflare DNS Setup for finance.wifjapan.com

## ✅ What's Already Done
- SSL Certificate: arn:aws:acm:us-east-1:387158738611:certificate/5765a07c-de80-401e-829a-00b496e069bd
- CloudFront Distribution ID: E10R2ZLIGYCY0W
- CloudFront Domain: d3iesx5hq3slg3.cloudfront.net

## 🌐 Add DNS Record in Cloudflare

### Step-by-Step Instructions:

1. **Login to Cloudflare**
   - Go to: https://dash.cloudflare.com/
   - Select domain: `wifjapan.com`

2. **Go to DNS Settings**
   - Click on **DNS** in the left sidebar
   - Click **Add record** button

3. **Add CNAME Record**
   ```
   Type:    CNAME
   Name:    finance
   Target:  d3iesx5hq3slg3.cloudfront.net
   Proxy:   🔴 DNS only (turn OFF the orange cloud)
   TTL:     Auto
   ```

   **IMPORTANT**: Make sure the **orange cloud is GREY (DNS only)**, not orange (proxied)

   Why? CloudFront handles SSL/CDN, so Cloudflare should just do DNS routing.

4. **Save the Record**
   - Click **Save**
   - That's it!

## ⚠️ Critical: Orange Cloud Must Be OFF

```
✅ CORRECT:  finance  →  d3iesx5hq3slg3.cloudfront.net  [☁️ grey cloud]
❌ WRONG:    finance  →  d3iesx5hq3slg3.cloudfront.net  [🟠 orange cloud]
```

If the orange cloud is ON, Cloudflare will proxy the traffic and cause SSL errors.

## 📸 Visual Guide

### Cloudflare Dashboard:
```
┌─────────────────────────────────────────────────────┐
│  DNS Records                          [Add record]  │
├─────────────────────────────────────────────────────┤
│  Type     Name      Content                   Proxy │
│  CNAME    finance   d3iesx5hq3slg3.cloudfront.net   │
│                                            [☁️ grey] │
└─────────────────────────────────────────────────────┘
```

## ⏱️ Timeline

- **CloudFront deployment**: 15-20 minutes (started already)
- **DNS propagation**: 1-5 minutes (Cloudflare is fast!)
- **Total wait time**: ~20 minutes

## 🧪 Testing

After adding the record, wait ~20 minutes then test:

```bash
# Check DNS is resolving
nslookup finance.wifjapan.com

# Should show something like:
# finance.wifjapan.com  canonical name = d3iesx5hq3slg3.cloudfront.net

# Test HTTPS (wait for CloudFront to deploy first)
curl -I https://finance.wifjapan.com

# Should return: HTTP/2 200 (after CloudFront finishes deploying)
```

## 🎯 What Happens Next

1. **Now** (you do this):
   - Add CNAME record in Cloudflare

2. **In ~20 minutes**:
   - CloudFront finishes deploying
   - Your site is live at https://finance.wifjapan.com

3. **Then**:
   - Visit https://finance.wifjapan.com
   - Test all features
   - Update .env.production (already done by script)

## ✅ Final Configuration

Once live, your app will be accessible at:
- **Primary URL**: https://finance.wifjapan.com
- **PDF Service**: http://18.141.140.2:3001 (backend)

## 🆘 Troubleshooting

### "This site can't provide a secure connection"
**Cause**: CloudFront still deploying
**Fix**: Wait 20 minutes total from when you ran the script

### "DNS_PROBE_FINISHED_NXDOMAIN"
**Cause**: DNS record not added or wrong
**Fix**:
- Check you added CNAME in Cloudflare
- Name should be exactly: `finance`
- Target should be: `d3iesx5hq3slg3.cloudfront.net`

### SSL Error
**Cause**: Orange cloud is ON in Cloudflare
**Fix**: Turn off orange cloud (DNS only mode)

### 503 Error
**Cause**: CloudFront can't reach S3
**Fix**: Wait for full deployment (20 mins), then check S3 bucket policy

## 📞 Support

If you need help:
```bash
# Check CloudFront deployment status
aws cloudfront get-distribution \
  --id E10R2ZLIGYCY0W \
  --query 'Distribution.Status'

# Should say "Deployed" when ready
```

## 🎉 Success Checklist

- [ ] CNAME record added in Cloudflare
- [ ] Orange cloud is OFF (grey)
- [ ] Waited 20 minutes
- [ ] DNS resolves: `nslookup finance.wifjapan.com`
- [ ] HTTPS works: `curl -I https://finance.wifjapan.com`
- [ ] Can access in browser: https://finance.wifjapan.com

---

**Current Status**: ⏳ Waiting for you to add CNAME in Cloudflare
**Next**: Visit https://finance.wifjapan.com in ~20 minutes!
