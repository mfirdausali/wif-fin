# Fix for 406 Error - RLS Policies

## Problem
You're seeing this error when visiting finance.wifjapan.com:
```
Failed to load resource: the server responded with a status of 406 ()
fthkayaprkicvzgqeipq.supabase.co/rest/v1/companies?select=id&limit=1
```

## Root Cause
The Supabase Row Level Security (RLS) policies are blocking anonymous access to the `companies` table. The existing policies don't explicitly grant access to the `anon` role (which is used before authentication).

## Solution

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `fthkayaprkicvzgqeipq`
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `fix-rls-policies.sql`
6. Click **Run** or press `Cmd/Ctrl + Enter`
7. Refresh your website at finance.wifjapan.com

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to your project directory
cd /Users/firdaus/Documents/2025/code/wif-fin

# Run the fix script
supabase db push
```

Or run the fix script directly:

```bash
psql -h db.fthkayaprkicvzgqeipq.supabase.co -U postgres -d postgres -f fix-rls-policies.sql
```

### Option 3: Manual Fix via Dashboard

1. Go to **Authentication** → **Policies** in Supabase Dashboard
2. For the `companies` table, delete existing policies
3. Add a new policy:
   - **Name**: Allow public read access to companies
   - **Command**: SELECT
   - **Roles**: `public`, `anon`, `authenticated`
   - **USING expression**: `true`
4. Repeat for INSERT, UPDATE, DELETE operations
5. Apply similar policies to other tables (accounts, documents, etc.)

## What Changed?

The RLS policies now explicitly grant access to the `anon` role, which is used when users visit the site before logging in:

**Before:**
```sql
CREATE POLICY "Users can view their company data" ON companies
    FOR SELECT
    USING (true);
```

**After:**
```sql
CREATE POLICY "Allow public read access to companies" ON companies
    FOR SELECT
    TO public, anon, authenticated  -- ← This is the key fix
    USING (true);
```

## Security Note

These policies currently allow full public access to all tables. This is intentional for initial setup and development. In production, you should implement proper authentication-based policies that check:
- User authentication status
- Company membership
- User roles and permissions

## Verification

After applying the fix, the error should be gone. You can verify by:

1. Opening Chrome DevTools (F12)
2. Go to the **Network** tab
3. Visit finance.wifjapan.com
4. Look for the request to `/rest/v1/companies?select=id&limit=1`
5. It should now return a **200 OK** status instead of **406**

## Next Steps

Once the error is fixed, you should see the admin setup page working correctly without any errors.
