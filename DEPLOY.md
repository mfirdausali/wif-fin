# 🚀 Deploy WIF Finance - Super Simple Guide

## One-Time Setup (5 minutes)

### Step 1: Initialize Supabase Database (ONE TIME ONLY)

This creates all your database tables. You only need to do this **ONCE**.

**Go to Supabase SQL Editor:**
```
https://supabase.com/dashboard/project/fthkayaprkicvzgqeipq/sql/new
```

**Copy this file:**
```bash
# Open in your editor:
supabase/migrations/001_initial_schema.sql
```

**Paste into Supabase SQL Editor and click "RUN"**

You should see: ✅ "Success. No rows returned"

**That's it!** You never need to do this again.

---

### Step 2: Deploy Everything

Now run ONE command to deploy everything to AWS:

```bash
./deploy-full.sh
```

This automatically deploys:
- ✅ Frontend to CloudFront
- ✅ PDF Service to ECS
- ✅ Connects to your Supabase database

---

## That's It! 🎉

Your app is now live at:
```
https://finance.wifjapan.com
```

---

## Future Deployments

After the first time, just run:

```bash
./deploy-full.sh
```

It will:
1. Check if database is set up ✅
2. Build frontend ✅
3. Deploy to AWS ✅
4. Update PDF service ✅
5. Test everything ✅

---

## What If I Forgot to Initialize Database?

If you run `./deploy-full.sh` without initializing the database, it will detect this and remind you:

```
⚠️  Database not initialized

Please initialize your database first:
1. Open: https://supabase.com/dashboard/project/...
2. Copy: supabase/migrations/001_initial_schema.sql
3. Paste and RUN
```

Then just run `./deploy-full.sh` again.

---

## Quick Troubleshooting

### "Database not initialized"
- Run the SQL migration (Step 1 above)
- Only need to do this once!

### "Frontend not live yet"
- CloudFront takes 2-5 minutes to deploy
- Check: https://finance.wifjapan.com after waiting

### "PDF Service not running"
- ECS takes 2-3 minutes to start
- Check: http://18.141.140.2:3001/health

### Need to update after making changes?
```bash
./deploy-full.sh
```

---

## Summary

**First Time:**
1. Run SQL in Supabase (1 minute)
2. Run `./deploy-full.sh` (5 minutes)
3. Done! ✅

**Every Update:**
1. Run `./deploy-full.sh` (5 minutes)
2. Done! ✅

---

## What Gets Deployed

| Component | Location | Status |
|-----------|----------|--------|
| Frontend | https://finance.wifjapan.com | ✅ |
| Database | Supabase | ✅ |
| PDF Service | AWS ECS | ✅ |
| SSL Certificate | AWS ACM | ✅ |
| CDN | CloudFront | ✅ |

---

## Need Help?

Check the deployment status:
```bash
# CloudFront status
aws cloudfront get-distribution --id E10R2ZLIGYCY0W --query 'Distribution.Status'

# ECS service status
aws ecs describe-services \
  --cluster wif-finance-cluster \
  --services wif-pdf-service \
  --region ap-southeast-1 \
  --query 'services[0].runningCount'

# PDF service health
curl http://18.141.140.2:3001/health
```

View logs:
```bash
# PDF service logs
aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1
```

Invalidate cache (force CloudFront to show latest):
```bash
aws cloudfront create-invalidation \
  --distribution-id E10R2ZLIGYCY0W \
  --paths "/*"
```

---

**Ready?** Just run:
```bash
./deploy-full.sh
```
