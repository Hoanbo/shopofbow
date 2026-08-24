import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectCapCutOrders() {
  const { data: capcut } = await adminDb.from('products').select('*').eq('slug', 'capcut-pro').single();
  console.log('CapCut Product:', capcut);

  const { data: orders } = await adminDb.from('orders').select('*');
  console.log(`Total orders in DB: ${orders?.length}`);
  for (const o of orders || []) {
    console.log(`Order: id=${o.id} | code=${o.order_code || o.code} | product_id=${o.product_id} | plan_id=${o.plan_id} | status=${o.status} | qty=${o.quantity || o.qty} | created_at=${o.created_at}`);
  }

  const { data: reviews } = await adminDb.from('product_reviews').select('*').eq('product_id', capcut?.id);
  console.log('CapCut Reviews:', reviews);
}

inspectCapCutOrders().catch(console.error);
