/**
 * Inspect live database for:
 * 1. Duplicate notifications in public.notifications
 * 2. All records in public.order_expiry_notifications
 * 3. All expiring orders & recipient email resolution
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

async function inspectDuplicatesAndRecipients() {
  console.log('================================================================');
  console.log('🔍 AUDIT: Duplicates & Recipient Resolution');
  console.log('================================================================\n');

  // 1. Check duplicate notifications in public.notifications
  console.log('--- 1. AUDIT DUPLICATE NOTIFICATIONS IN public.notifications ---');
  const { data: allNotifs } = await client
    .from('notifications')
    .select('id, type, title, message, order_id, user_id, is_admin, created_at')
    .order('created_at', { ascending: false });

  console.log(`Total notifications in database: ${allNotifs?.length || 0}`);

  // Group by (order_id, title, user_id)
  const notifGroups: Record<string, any[]> = {};
  for (const n of allNotifs || []) {
    if (n.order_id) {
      const key = `${n.order_id}::${n.title}::${n.user_id}`;
      if (!notifGroups[key]) notifGroups[key] = [];
      notifGroups[key].push(n);
    }
  }

  let dupCount = 0;
  for (const [key, items] of Object.entries(notifGroups)) {
    if (items.length > 1) {
      dupCount++;
      console.log(`⚠️ DUPLICATE FOUND (${items.length} records): Key [${key}]`);
      for (const it of items) {
        console.log(`   - ID: ${it.id} | created_at: ${it.created_at} | is_read: ${it.is_read}`);
      }
    }
  }
  if (dupCount === 0) {
    console.log('✓ No duplicate notifications found by (order_id, title, user_id).');
  }

  // 2. Check order_expiry_notifications table
  console.log('\n--- 2. ALL RECORDS IN public.order_expiry_notifications ---');
  const { data: expiryRecords } = await client
    .from('order_expiry_notifications')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`Total expiry records: ${expiryRecords?.length || 0}`);
  console.log(JSON.stringify(expiryRecords, null, 2));

  // 3. Inspect Recipient Resolution for real customer orders
  console.log('\n--- 3. RECIPIENT RESOLUTION FOR ACTIVE ORDERS ---');
  const { data: orders } = await client
    .from('orders')
    .select(`
      id,
      payment_code,
      product_name,
      plan_label,
      price,
      status,
      expires_at,
      user_id,
      created_at
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Order | User ID | Profile Email | Auth Email | Final Recipient:');
  for (const ord of orders || []) {
    let profileEmail = '';
    let authEmail = '';

    if (ord.user_id) {
      const { data: prof } = await client.from('profiles').select('email, full_name').eq('id', ord.user_id).maybeSingle();
      profileEmail = prof?.email || '';

      const { data: authU } = await client.auth.admin.getUserById(ord.user_id);
      authEmail = authU.user?.email || '';
    }

    const finalRecipient = profileEmail || authEmail || '(NO EMAIL)';
    console.log(`- #${ord.payment_code} (${ord.product_name}) | User: ${ord.user_id} | Profile: ${profileEmail} | Auth: ${authEmail} → RECIPIENT: ${finalRecipient}`);
  }
}

inspectDuplicatesAndRecipients().catch(console.error);
