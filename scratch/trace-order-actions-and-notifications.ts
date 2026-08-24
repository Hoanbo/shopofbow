/**
 * Trace Order Creation, In-App Notification generation, and Admin Actions (Setup, Handover, Refund)
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

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function traceRegression() {
  console.log('================================================================');
  console.log('🔍 TRACE REGRESSION: In-App Notifications & Admin Order Actions');
  console.log('================================================================\n');

  // 1. Get real customer user and admin user
  const { data: adminUser } = await adminDb.from('profiles').select('id, email').eq('email', 'hoankb4@gmail.com').single();
  const { data: customerUser } = await adminDb.from('profiles').select('id, email').neq('email', 'hoankb4@gmail.com').limit(1).single();

  console.log(`Admin User: ${adminUser?.email} (${adminUser?.id})`);
  console.log(`Customer User: ${customerUser?.email} (${customerUser?.id})\n`);

  // ─────────────────────────────────────────────────────────────
  // STEP 1: USER PURCHASES ORDER → CHECK NOTIFICATION TRIGGER
  // ─────────────────────────────────────────────────────────────
  console.log('--- STEP 1: CREATE ORDER & CHECK IN-APP NOTIFICATION ---');
  const testCode = `TRACE_${Date.now().toString().slice(-6)}`;
  
  const { data: newOrder, error: orderErr } = await adminDb.from('orders').insert({
    user_id: customerUser?.id,
    product_name: 'CapCut Pro (Trace Test)',
    plan_label: '1 Tháng',
    price: 99000,
    payment_code: testCode,
    status: 'pending_payment',
  }).select('*').single();

  if (orderErr) {
    console.log('❌ Failed to insert order:', orderErr);
    return;
  }
  console.log(`✅ Order created: #${newOrder.payment_code} (${newOrder.id})`);

  // Check if notification was created for Customer and Admin
  const { data: notifs } = await adminDb
    .from('notifications')
    .select('*')
    .eq('order_id', newOrder.id);

  console.log(`In-App Notifications generated for this order (${notifs?.length || 0} rows):`);
  for (const n of notifs || []) {
    console.log(`  - [is_admin: ${n.is_admin}] [user_id: ${n.user_id}] [type: ${n.type}] "${n.title}": ${n.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2: ADMIN ACTION → SETUP / PROCESSING
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- STEP 2: ADMIN ACTION: SETUP (status -> processing) ---');
  const { data: updateProc, error: procErr } = await adminDb
    .from('orders')
    .update({ status: 'processing' })
    .eq('id', newOrder.id)
    .select('id, status');

  if (procErr) {
    console.log('❌ Setup (status=processing) failed:', procErr);
  } else {
    console.log('✅ Setup succeeded. New status:', updateProc?.[0]?.status);
  }

  // Check notifications after setup
  const { data: notifsAfterProc } = await adminDb.from('notifications').select('*').eq('order_id', newOrder.id);
  console.log(`Total notifications after setup: ${notifsAfterProc?.length}`);
  for (const n of notifsAfterProc || []) {
    console.log(`  - [type: ${n.type}] [user_id: ${n.user_id}] "${n.title}"`);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3: ADMIN ACTION → HANDOVER / COMPLETE
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- STEP 3: ADMIN ACTION: HANDOVER (status -> completed) ---');
  const { data: updateComp, error: compErr } = await adminDb
    .from('orders')
    .update({
      status: 'completed',
      account_details: 'User: test@bow.vn | Pass: 123456',
      delivery_info: 'User: test@bow.vn | Pass: 123456',
    })
    .eq('id', newOrder.id)
    .select('id, status, account_details');

  if (compErr) {
    console.log('❌ Handover (status=completed) failed:', compErr);
  } else {
    console.log('✅ Handover succeeded. New status:', updateComp?.[0]?.status);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4: ADMIN ACTION → REFUND (RPC refund_order)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- STEP 4: ADMIN ACTION: REFUND (RPC refund_order) ---');
  const { data: refundRes, error: refundErr } = await adminDb.rpc('refund_order', {
    p_order_id: newOrder.id,
  });

  if (refundErr) {
    console.log('❌ refund_order failed:', refundErr);
  } else {
    console.log('✅ refund_order returned:', refundRes);
  }

  // Check final order state
  const { data: finalOrder } = await adminDb.from('orders').select('id, status, refunded_at').eq('id', newOrder.id).single();
  console.log(`Final order status: ${finalOrder?.status}, refunded_at: ${finalOrder?.refunded_at}`);

  // Clean up
  await adminDb.from('notifications').delete().eq('order_id', newOrder.id);
  await adminDb.from('orders').delete().eq('id', newOrder.id);
  console.log('\nCleaned up trace test order.');
}

traceRegression().catch(console.error);
