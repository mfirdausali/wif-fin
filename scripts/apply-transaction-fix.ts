/**
 * Script to apply the Statement of Payment transaction amount fix
 *
 * This script executes the SQL migration that fixes the NULL amount issue
 * in the transactions table when creating Statement of Payment documents.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role key for DDL operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '008_fix_sop_transaction_amount.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration: 008_fix_sop_transaction_amount.sql');
    console.log('This will fix the NULL amount issue in Statement of Payment transactions');
    console.log('');

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    }

    console.log('✓ Migration applied successfully!');
    console.log('');
    console.log('The trigger has been updated to handle NULL total_deducted values.');
    console.log('You can now create Statement of Payment documents without errors.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

applyMigration();
