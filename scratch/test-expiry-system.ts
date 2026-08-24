import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testExpirySystem() {
  console.log('================================================================');
  console.log('🔍 KIỂM TRA HỆ THỐNG TỰ ĐỘNG NHẮC HẾT HẠN & EMAIL CRON');
  console.log('================================================================\n');

  // 1. Check orders with expiration date
  const now = Date.now();
  const { data: orders } = await adminDb.from('orders').select('*').eq('status', 'completed');
  console.log(`📦 Tổng số đơn completed: ${orders?.length}`);

  let expiringSoonCount = 0;
  let expiredCount = 0;
  let activeCount = 0;

  for (const o of orders || []) {
    if (!o.expires_at) continue;
    const expMs = new Date(o.expires_at).getTime();
    const diffDays = (expMs - now) / (24 * 60 * 60 * 1000);
    if (diffDays <= 0) {
      expiredCount++;
    } else if (diffDays <= 3) {
      expiringSoonCount++;
      console.log(`  ⚠️ Đơn sắp hết hạn (còn ${diffDays.toFixed(1)} ngày): ID=${o.id} | Code=${o.payment_code} | Product=${o.product_name} | Plan=${o.plan_label} | Hết hạn=${o.expires_at}`);
    } else {
      activeCount++;
    }
  }

  console.log(`\n📊 Thống kê hạn dùng:`);
  console.log(`  - Đang hoạt động (> 3 ngày): ${activeCount}`);
  console.log(`  - Sắp hết hạn (1-3 ngày): ${expiringSoonCount}`);
  console.log(`  - Đã hết hạn (<= 0 ngày): ${expiredCount}\n`);

  // 2. Check order_expiry_notifications table
  const { data: notifs, error: notifErr } = await adminDb.from('order_expiry_notifications').select('*').order('created_at', { ascending: false }).limit(10);
  console.log(`📬 Nhật ký thông báo nhắc hạn (order_expiry_notifications):`, notifs?.length || 0, 'bản ghi');
  if (notifs && notifs.length > 0) {
    for (const n of notifs) {
      console.log(`  - [${n.notification_type}] Order: ${n.order_id} | DaysLeft: ${n.days_left} | Email: ${n.email_status} | Web: ${n.web_status} | SentAt: ${n.sent_at || n.created_at}`);
    }
  }

  // 3. Test triggering scan_and_send_order_expiry_reminders RPC
  console.log('\n🚀 Chạy thử nghiệm RPC scan_and_send_order_expiry_reminders()...');
  const { data: scanRes, error: scanErr } = await adminDb.rpc('scan_and_send_order_expiry_reminders');
  console.log('  Kết quả quét & gửi thông báo:', scanRes, scanErr?.message || '');

  // 4. Test triggering run_expiry_retry_cycle RPC
  console.log('\n🔄 Chạy thử nghiệm RPC run_expiry_retry_cycle()...');
  const { data: cycleRes, error: cycleErr } = await adminDb.rpc('run_expiry_retry_cycle');
  console.log('  Kết quả chu kỳ Retry & Sync:', cycleRes, cycleErr?.message || '');
}

testExpirySystem().catch(console.error);
