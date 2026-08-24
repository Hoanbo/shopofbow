import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function auditOrders() {
  console.log('================================================================');
  console.log('🔍 AUDITING ALL ORDERS & EXPIRY STATUS');
  console.log('================================================================\n');

  const { data: orders, error } = await adminDb
    .from('orders')
    .select('id, payment_code, product_name, plan_label, price, status, created_at, expires_at, user_id, notes, superseded_by_order_id, renewed_from_order_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Total orders: ${orders.length}`);
  const now = new Date();

  for (const o of orders) {
    const expDate = o.expires_at ? new Date(o.expires_at) : null;
    const daysLeft = expDate ? (expDate.getTime() - now.getTime()) / (1000 * 86400) : null;

    // Check existing notifications in order_expiry_notifications
    const { data: notifs } = await adminDb
      .from('order_expiry_notifications')
      .select('notification_type, email_status, web_status, created_at')
      .eq('order_id', o.id);

    console.log(`\n📦 Order #${o.payment_code} (${o.product_name} - ${o.plan_label})`);
    console.log(`   Status: ${o.status}`);
    console.log(`   Created: ${o.created_at}`);
    console.log(`   Expires At: ${o.expires_at || 'NULL'}`);
    console.log(`   Days Left: ${daysLeft !== null ? daysLeft.toFixed(2) : 'N/A'}`);
    console.log(`   Superseded By: ${o.superseded_by_order_id || 'None'}, Renewed From: ${o.renewed_from_order_id || 'None'}`);
    console.log(`   Expiry Notifs Claimed: ${notifs?.map(n => `${n.notification_type} (${n.email_status})`).join(', ') || 'NONE'}`);
  }
}

auditOrders().catch(console.error);
