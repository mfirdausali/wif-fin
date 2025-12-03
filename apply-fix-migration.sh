#!/bin/bash

# Script to apply the Statement of Payment transaction fix migration
# This creates/replaces the trigger function to handle NULL total_deducted

echo "Applying Statement of Payment transaction amount fix..."
echo ""
echo "This migration fixes the issue where transactions were getting NULL amounts"
echo "when creating Statement of Payment documents."
echo ""
echo "To apply this migration, you have two options:"
echo ""
echo "Option 1: Via Supabase Dashboard (SQL Editor)"
echo "  1. Go to your Supabase project dashboard"
echo "  2. Navigate to SQL Editor"
echo "  3. Copy the contents of: supabase/migrations/008_fix_sop_transaction_amount.sql"
echo "  4. Paste and execute the SQL"
echo ""
echo "Option 2: Via psql command line"
echo "  1. Get your database connection string from Supabase Dashboard > Settings > Database"
echo "  2. Run: psql 'your-connection-string' < supabase/migrations/008_fix_sop_transaction_amount.sql"
echo ""
echo "After applying, the trigger will use COALESCE to handle NULL values properly."
