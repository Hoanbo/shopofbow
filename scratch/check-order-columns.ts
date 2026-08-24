import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkOrderDetails() {
  const { data: order } = await adminDb.from('orders').select('*').eq('id', 'da3ddbaf-5038-480b-9b53-b4a308ca42af').single();
  console.log('Sample Order:', order);

  const { data: ordersWithData } = await adminDb.from('orders').select('id, product_id, plan_id, product_name, plan_name, status').limit(10);
  console.log('Orders sample columns:', ordersWithData);
}

checkOrderDetails().catch(console.error);
