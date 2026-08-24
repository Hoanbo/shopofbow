import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkVault() {
  console.log('--- Checking Vault configuration for Email Notify ---');
  
  // We can query decrypted_secrets via an RPC or check if net.http_post works
  const { data, error } = await adminDb.rpc('check_and_notify_expiring_orders');
  console.log('check_and_notify_expiring_orders output:', data, error);

  // Let's inspect the order_expiry_notifications table to see the email_status values
  const { data: records } = await adminDb
    .from('order_expiry_notifications')
    .select('id, notification_type, email_status, web_status, email_error, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Recent 10 order_expiry_notifications:');
  console.table(records);
}

checkVault().catch(console.error);
