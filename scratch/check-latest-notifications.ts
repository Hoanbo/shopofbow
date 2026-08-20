import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectLatestNotifications() {
  console.log('=== LATEST 10 NOTIFICATIONS IN DATABASE ===');
  const { data: notifs, error } = await client
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error fetching notifications:', error);
    return;
  }
  console.log(JSON.stringify(notifs, null, 2));

  console.log('\n=== LATEST 5 EXPIRY NOTIFICATIONS LOGS ===');
  const { data: expiryLogs, error: expErr } = await client
    .from('order_expiry_notifications')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(5);
  if (expErr) {
    console.log('Error / not found order_expiry_notifications:', expErr.message);
  } else {
    console.log(JSON.stringify(expiryLogs, null, 2));
  }
}

inspectLatestNotifications().catch(console.error);
