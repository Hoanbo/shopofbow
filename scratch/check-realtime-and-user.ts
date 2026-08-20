import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkRealtimeAndUser() {
  console.log('=== CHECK REALTIME SUBSCRIPTION FOR NOTIFICATIONS ===');
  
  // Check user vocucpromax notifications count
  const { data: notifs, error: nErr } = await client
    .from('notifications')
    .select('id, type, title, message, user_id, is_admin, is_read, created_at')
    .eq('user_id', '4b6be9c5-ea9a-4169-8073-81d52e92f730');
    
  console.log(`Notifications for vocucpromax@gmail.com (${notifs?.length || 0} items):`);
  console.log(JSON.stringify(notifs, null, 2));

  // Check admin notifications count
  const { data: adminNotifs } = await client
    .from('notifications')
    .select('id, type, title, is_admin, is_read, created_at')
    .eq('is_admin', true)
    .limit(5);
  console.log(`\nAdmin notifications sample (${adminNotifs?.length || 0} items):`);
  console.log(JSON.stringify(adminNotifs, null, 2));
}

checkRealtimeAndUser().catch(console.error);
