import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testExcludeTopup() {
  console.log('--- Cleaning and verifying top-up orders ---');

  // 1. Update orders where product_name is Nạp tiền vào ví
  const { data: updated, error: uErr } = await adminDb
    .from('orders')
    .update({ expires_at: null })
    .or('product_name.eq.Nạp tiền vào ví,payment_code.ilike.BOWN%')
    .select('id, payment_code, product_name, expires_at');

  if (uErr) console.error('Update error:', uErr);
  console.log(`Updated ${updated?.length || 0} topup orders to expires_at = null.`);

  // 2. Query all topup orders to confirm
  const { data: topupOrders } = await adminDb
    .from('orders')
    .select('id, payment_code, product_name, plan_label, status, expires_at')
    .or('product_name.eq.Nạp tiền vào ví,payment_code.ilike.BOWN%');

  console.log('Topup Orders currently in DB:');
  console.table(topupOrders);
}

testExcludeTopup().catch(console.error);
