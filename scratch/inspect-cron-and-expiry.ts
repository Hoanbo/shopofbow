import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectCronAndExpiry() {
  console.log('================================================================');
  console.log('🔍 INSPECTING PG_CRON & EXPIRY REMINDER SYSTEM');
  console.log('================================================================\n');

  // 1. Check RPCs / tables
  const { data: expiryNotifs, error: enErr } = await adminDb
    .from('order_expiry_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('1. Recent order_expiry_notifications:', expiryNotifs?.length || 0, 'rows');
  if (expiryNotifs && expiryNotifs.length > 0) {
    console.table(expiryNotifs.map(n => ({
      id: n.id,
      order_id: n.order_id,
      notification_type: n.notification_type,
      days_left: n.days_left,
      web_status: n.web_status,
      email_status: n.email_status,
      created_at: n.created_at,
      sent_at: n.sent_at
    })));
  }

  // 2. Test running check_and_notify_expiring_orders() or scan_and_send_order_expiry_reminders()
  console.log('\n2. Testing scan functions via RPC:');
  const { data: rpcRes1, error: rpcErr1 } = await adminDb.rpc('check_and_notify_expiring_orders');
  console.log('   check_and_notify_expiring_orders result:', rpcRes1, rpcErr1?.message || '');

  const { data: rpcRes2, error: rpcErr2 } = await adminDb.rpc('scan_and_send_order_expiry_reminders');
  console.log('   scan_and_send_order_expiry_reminders result:', rpcRes2, rpcErr2?.message || '');

  const { data: rpcRes3, error: rpcErr3 } = await adminDb.rpc('run_daily_order_expiry_check');
  console.log('   run_daily_order_expiry_check result:', rpcRes3, rpcErr3?.message || '');
}

inspectCronAndExpiry().catch(console.error);
