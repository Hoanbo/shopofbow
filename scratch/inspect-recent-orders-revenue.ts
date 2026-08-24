import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspect7dOrders() {
  const now = Date.now();
  const limit7d = 7 * 24 * 60 * 60 * 1000;

  const { data: orders } = await adminDb.from('orders').select('*').order('created_at', { ascending: false });
  console.log('Total orders:', orders?.length);

  const recent7d = (orders || []).filter(o => now - new Date(o.created_at).getTime() <= limit7d);
  console.log(`Orders in last 7 days (${recent7d.length}):`);
  for (const o of recent7d) {
    console.log(`- Order: id=${o.id} | code=${o.payment_code} | product=${o.product_name} | price=${o.price} | status=${o.status} | created_at=${o.created_at}`);
  }
}

inspect7dOrders().catch(console.error);
