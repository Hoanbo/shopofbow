/**
 * Inspect order BOW904364635 and its notifications
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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkOrder() {
  const { data: order } = await adminDb
    .from('orders')
    .select('id, user_id, payment_code, status, price, created_at')
    .ilike('payment_code', '%904364635%')
    .single();

  console.log('Order Details:', order);

  if (order) {
    const { data: notifs } = await adminDb
      .from('notifications')
      .select('id, user_id, is_admin, type, title, message, created_at')
      .eq('order_id', order.id);

    console.log('\nNotifications for this order:');
    console.table(notifs);
  }
}

checkOrder().catch(console.error);
