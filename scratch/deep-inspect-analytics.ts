import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deepInspect() {
  console.log('================================================================');
  console.log('🔍 PHASE 1 & 2: DEEP INSPECTION OF REAL ORDER DATA & SCHEMA');
  console.log('================================================================\n');

  // 1. Inspect all orders in the database
  const { data: allOrders, error: orderErr } = await adminDb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (orderErr) {
    console.error('Error fetching orders:', orderErr);
    return;
  }

  console.log(`📦 Tổng số đơn hàng trong DB: ${allOrders.length}`);

  // Print columns available in orders table
  if (allOrders.length > 0) {
    console.log('\n📋 Các trường (columns) có trong bảng `orders`:');
    console.log(Object.keys(allOrders[0]).join(', '));
  }

  // 2. Exact 7-day range calculation (VN Timezone GMT+7 vs UTC)
  const now = new Date();
  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const start7d = new Date(nowMs - sevenDaysMs);

  console.log(`\n⏰ Mốc thời gian kiểm tra:`);
  console.log(`- Current time (UTC): ${now.toISOString()}`);
  console.log(`- Current time (VN): ${new Date(nowMs + 7 * 3600000).toISOString()}`);
  console.log(`- 7 days ago (UTC): ${start7d.toISOString()}`);

  const recent7dOrders = allOrders.filter((o) => new Date(o.created_at).getTime() >= start7d.getTime());
  console.log(`\n🔎 Số đơn trong 7 ngày qua: ${recent7dOrders.length}`);

  recent7dOrders.forEach((o, index) => {
    console.log(`\n--------------------------------------------------`);
    console.log(`ORDER #${index + 1}:`);
    console.log(`  ID:                     ${o.id}`);
    console.log(`  Payment Code:           ${o.payment_code}`);
    console.log(`  Created At:             ${o.created_at}`);
    console.log(`  Status:                 ${o.status}`);
    console.log(`  Price (Stored):         ${o.price}`);
    console.log(`  Original Price:         ${o.original_price}`);
    console.log(`  Discount Amount:        ${o.discount_amount}`);
    console.log(`  Coupon Code:            ${o.coupon_code}`);
    console.log(`  Product Name:           ${o.product_name}`);
    console.log(`  Plan Label:             ${o.plan_label}`);
    console.log(`  User ID:                ${o.user_id}`);
    console.log(`  Expires At:             ${o.expires_at}`);
    console.log(`  Delivery Info:          ${o.delivery_info || '(none)'}`);
    console.log(`  Notes:                  ${o.notes || '(none)'}`);
  });

  // 3. Inspect status breakdown across all orders
  const statusCounts: Record<string, number> = {};
  allOrders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });
  console.log('\n📊 Phân bổ trạng thái của TOÀN BỘ 44 đơn hàng trong DB:');
  console.table(statusCounts);
}

deepInspect().catch(console.error);
