/**
 * Inspect all triggers on public.orders and test every update operation
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectTriggers() {
  console.log('=== INSPECTING TRIGGERS ON public.orders ===\n');

  // Let's create an order first
  const { data: u } = await client.from('profiles').select('id, email').eq('email', 'hoankb4@gmail.com').single();
  const adminId = u!.id;

  const testCode = `TRGTEST_${Date.now().toString().slice(-4)}`;
  const { data: ord, error: insErr } = await client.from('orders').insert({
    user_id: adminId,
    product_name: 'Test Trigger Order',
    plan_label: '1 Tháng',
    price: 50000,
    payment_code: testCode,
    status: 'pending_payment',
  }).select('*').single();

  if (insErr) {
    console.log('❌ Insert failed:', insErr);
    return;
  }
  console.log(`Created test order ${ord.id} with status pending_payment`);

  // Test 1: Update status to processing (Setup action)
  console.log('\n--- 1. Testing Admin Setup: status -> processing ---');
  const { data: s1, error: e1 } = await client.from('orders').update({ status: 'processing' }).eq('id', ord.id).select('id, status');
  if (e1) console.log('❌ Update processing failed:', e1);
  else console.log('✅ Update processing succeeded:', s1);

  // Test 2: Update status to completed + account_details (Handover action)
  console.log('\n--- 2. Testing Admin Handover: status -> completed ---');
  const { data: s2, error: e2 } = await client.from('orders').update({
    status: 'completed',
    account_details: 'User: user@bow.vn | Pass: 123456',
    delivery_info: 'User: user@bow.vn | Pass: 123456',
  }).eq('id', ord.id).select('id, status, expires_at');
  if (e2) console.log('❌ Update completed failed:', e2);
  else console.log('✅ Update completed succeeded. expires_at:', s2?.[0]?.expires_at);

  // Test 3: Test refund_order RPC
  console.log('\n--- 3. Testing RPC refund_order ---');
  // Need to test as authenticated admin or test what refund_order does
  const { data: s3, error: e3 } = await client.rpc('refund_order', { p_order_id: ord.id });
  console.log('refund_order (via service_role / unauthenticated):', s3, e3);

  // Clean up
  await client.from('notifications').delete().eq('order_id', ord.id);
  await client.from('orders').delete().eq('id', ord.id);
  console.log('\nCleaned up test order.');
}

inspectTriggers().catch(console.error);
