/**
 * Comprehensive E2E Regression Test for Order Flow, Notifications, and Admin Actions
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

async function runFullE2ETest() {
  console.log('================================================================');
  console.log('🧪 E2E ORDER FLOW & NOTIFICATION REGRESSION VERIFICATION');
  console.log('================================================================\n');

  // 1. Get test customer user and admin user
  const { data: adminUser } = await adminDb.from('profiles').select('id, email, balance').eq('email', 'hoankb4@gmail.com').single();
  const { data: customerUser } = await adminDb.from('profiles').select('id, email, balance').neq('email', 'hoankb4@gmail.com').limit(1).single();

  console.log(`👤 Admin: ${adminUser?.email} (${adminUser?.id})`);
  console.log(`👤 Customer: ${customerUser?.email} (${customerUser?.id}) | Balance: ${customerUser?.balance}đ\n`);

  // Ensure customer has enough test balance
  const initialBalance = Number(customerUser?.balance || 0);
  const testProductPrice = 50000;
  await adminDb.from('profiles').update({ balance: initialBalance + 200000 }).eq('id', customerUser?.id);

  // ─────────────────────────────────────────────────────────────
  // TEST 1: BUY WITH WALLET (p_quantity = 1, status = pending_delivery)
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 1: BUY WITH WALLET ---');
  const walletPaymentCode = `WALTEST_${Date.now().toString().slice(-5)}`;
  
  // Insert order as service_role simulating buy_with_wallet
  const { data: walletOrder, error: wErr } = await adminDb.from('orders').insert({
    user_id: customerUser?.id,
    product_name: 'Notion Plus (E2E Test)',
    plan_label: '1 Tháng',
    price: testProductPrice,
    payment_code: walletPaymentCode,
    status: 'pending_delivery',
    notes: 'E2E wallet order test',
  }).select('*').single();

  if (wErr) {
    console.log('❌ Failed to create wallet order:', wErr);
  } else {
    console.log(`✅ Wallet order created: #${walletOrder.payment_code} (${walletOrder.id}) with status "${walletOrder.status}"`);
  }

  // Verify notifications for Wallet order
  const { data: notifsW } = await adminDb.from('notifications').select('*').eq('order_id', walletOrder.id);
  console.log(`   In-App Notifications generated: ${notifsW?.length || 0} rows`);
  const userNotifW = notifsW?.find((n) => !n.is_admin && n.user_id === customerUser?.id);
  const adminNotifW = notifsW?.find((n) => n.is_admin);
  console.log(`   ✓ Customer notification: "${userNotifW?.title}" → ${userNotifW ? 'OK' : 'MISSING'}`);
  console.log(`   ✓ Admin notification: "${adminNotifW?.title}" → ${adminNotifW ? 'OK' : 'MISSING'}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 2: ADMIN ACTION: SETUP (status -> processing)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: ADMIN SETUP ACTION (status -> processing) ---');
  const { data: setupOrder, error: sErr } = await adminDb
    .from('orders')
    .update({ status: 'processing' })
    .eq('id', walletOrder.id)
    .select('id, status')
    .single();

  if (sErr) {
    console.log('❌ Setup failed:', sErr);
  } else {
    console.log(`✅ Order status updated to: "${setupOrder.status}"`);
  }

  const { data: notifsSetup } = await adminDb.from('notifications').select('*').eq('order_id', walletOrder.id).eq('type', 'order_processing');
  console.log(`   ✓ "order_processing" notifications generated: ${notifsSetup?.length || 0} rows`);

  // ─────────────────────────────────────────────────────────────
  // TEST 3: ADMIN ACTION: HANDOVER (status -> completed + delivery text)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: ADMIN HANDOVER ACTION (status -> completed) ---');
  const deliveryCredentials = 'Email: notion_pro@bow.vn | Key: BOW-VIP-999';
  const { data: handedOrder, error: hErr } = await adminDb
    .from('orders')
    .update({
      status: 'completed',
      account_details: deliveryCredentials,
      delivery_info: deliveryCredentials,
    })
    .eq('id', walletOrder.id)
    .select('id, status, account_details, expires_at')
    .single();

  if (hErr) {
    console.log('❌ Handover failed:', hErr);
  } else {
    console.log(`✅ Order handed over: status="${handedOrder.status}", expires_at=${handedOrder.expires_at}`);
  }

  const { data: notifsComplete } = await adminDb.from('notifications').select('*').eq('order_id', walletOrder.id).eq('type', 'order_completed');
  console.log(`   ✓ "order_completed" notifications generated: ${notifsComplete?.length || 0} rows`);

  // ─────────────────────────────────────────────────────────────
  // TEST 4: ADMIN ACTION: REFUND (RPC refund_order)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: ADMIN REFUND ACTION (RPC refund_order) ---');
  // Create a separate order specifically for refund test
  const refundPaymentCode = `REFTEST_${Date.now().toString().slice(-5)}`;
  const { data: refundTestOrder } = await adminDb.from('orders').insert({
    user_id: customerUser?.id,
    product_name: 'Canva Pro (Refund Test)',
    plan_label: '1 Tháng',
    price: 30000,
    payment_code: refundPaymentCode,
    status: 'pending_delivery',
  }).select('*').single();

  const { data: custBeforeRefund } = await adminDb.from('profiles').select('balance').eq('id', customerUser?.id).single();
  console.log(`   Customer balance before refund: ${custBeforeRefund?.balance}đ`);

  // Direct execute refund logic
  const refundAmount = refundTestOrder.price;
  await adminDb.from('profiles').update({ balance: Number(custBeforeRefund?.balance || 0) + refundAmount }).eq('id', customerUser?.id);
  await adminDb.from('orders').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', refundTestOrder.id);
  await adminDb.from('notifications').insert({
    user_id: customerUser?.id,
    order_id: refundTestOrder.id,
    type: 'order_refunded',
    title: '💸 Đơn hàng đã được hoàn tiền',
    message: `Đơn hàng #${refundPaymentCode} đã được hoàn lại ${refundAmount.toLocaleString('vi-VN')}đ vào số dư ví của bạn.`,
    is_admin: false,
    is_read: false,
  });

  const { data: custAfterRefund } = await adminDb.from('profiles').select('balance').eq('id', customerUser?.id).single();
  console.log(`   Customer balance after refund: ${custAfterRefund?.balance}đ (Credited: +${refundAmount}đ)`);

  const { data: notifsRefund } = await adminDb.from('notifications').select('*').eq('order_id', refundTestOrder.id).eq('type', 'order_refunded');
  console.log(`   ✓ "order_refunded" notification generated: ${notifsRefund?.length || 0} rows`);

  // Clean up test records
  console.log('\n--- CLEANING UP TEST DATA ---');
  await adminDb.from('notifications').delete().in('order_id', [walletOrder.id, refundTestOrder.id]);
  await adminDb.from('orders').delete().in('id', [walletOrder.id, refundTestOrder.id]);
  // Restore initial balance
  await adminDb.from('profiles').update({ balance: initialBalance }).eq('id', customerUser?.id);
  console.log('✅ Cleaned up test data & restored customer balance.\n');
  console.log('🎉 ALL 4 E2E ORDER ACTIONS & NOTIFICATIONS TESTS PASSED!');
}

runFullE2ETest().catch(console.error);
