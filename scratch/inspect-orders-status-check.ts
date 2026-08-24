/**
 * Inspect orders_status_check constraint on Supabase database
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

async function inspectOrdersStatusCheck() {
  console.log('=== INSPECTING ORDERS STATUS CHECK CONSTRAINT ===\n');

  // Try creating an order with various statuses to find what fails and what passes
  const testStatuses = [
    'pending',
    'pending_payment',
    'paid',
    'pending_delivery',
    'processing',
    'delivering',
    'completed',
    'cancelled',
    'refunded',
  ];

  const { data: u } = await client.from('profiles').select('id').limit(1).single();
  const testUserId = u!.id;

  for (const st of testStatuses) {
    const testCode = `TEST_${st.toUpperCase()}_${Date.now().toString().slice(-4)}`;
    const { data, error } = await client.from('orders').insert({
      user_id: testUserId,
      product_name: 'Test Order',
      plan_label: '1 Tháng',
      price: 1000,
      payment_code: testCode,
      status: st,
    }).select('id, status');

    if (error) {
      console.log(`❌ Status "${st}": FAILED → ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Status "${st}": ALLOWED (id: ${data?.[0]?.id})`);
      // Delete test order
      await client.from('orders').delete().eq('payment_code', testCode);
    }
  }

  // Also check what buy_with_wallet or create_order_with_coupon inserts
  console.log('\n--- Checking RPC buy_with_wallet and create_order_with_coupon ---');
  // Let's check RPC definitions in migrations
}

inspectOrdersStatusCheck().catch(console.error);
