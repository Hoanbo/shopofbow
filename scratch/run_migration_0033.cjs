const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';
const client = createClient(url, key);

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0033_fix_coupon_null_checkout.sql'), 'utf-8');
  console.log('Running migration 0033...');
  const { data, error } = await client.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error with exec_sql:', error);
    // Try run_sql or direct statements
  } else {
    console.log('Migration 0033 executed successfully:', data);
  }
}

run();
