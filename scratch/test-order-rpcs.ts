/**
 * Verify Order Creation via RPC after constraint update
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

async function testOrderCreation() {
  console.log('=== TESTING ORDER CREATION RPCs ===\n');

  const { data: u } = await client.from('profiles').select('id, email, balance').limit(1).single();
  const testUserId = u!.id;

  console.log(`Test User: ${u!.email} (Balance: ${u!.balance}đ)`);

  // Test 1: create_order_with_coupon (External / VietQR flow)
  const testCode = `TEST_${Date.now().toString().slice(-6)}`;
  console.log('\n--- 1. Testing create_order_with_coupon (status = "pending") ---');
  const { data: ordRes, error: ordErr } = await client.rpc('create_order_with_coupon', {
    p_user_id: testUserId,
    p_product_name: 'Test Product',
    p_plan_label: '1 Tháng',
    p_price: 100000,
    p_payment_code: testCode,
    p_notes: 'Test order',
    p_quantity: 1,
    p_coupon_code: null,
  });

  if (ordErr) {
    console.log('❌ create_order_with_coupon failed:', ordErr.message, `(${ordErr.code})`);
  } else {
    console.log('✅ create_order_with_coupon succeeded:', ordRes);
    // Clean up
    if (ordRes?.order_id) {
      await client.from('orders').delete().eq('id', ordRes.order_id);
    }
  }

  // Test 2: buy_with_wallet (Wallet flow)
  console.log('\n--- 2. Testing buy_with_wallet (status = "paid") ---');
  const testCodeWallet = `TESTW_${Date.now().toString().slice(-6)}`;
  const { data: walRes, error: walErr } = await client.rpc('buy_with_wallet', {
    p_user_id: testUserId,
    p_product_name: 'Test Product Wallet',
    p_plan_label: '1 Tháng',
    p_price: 100, // Small amount
    p_payment_code: testCodeWallet,
    p_notes: 'Test wallet buy',
    p_quantity: 1,
    p_coupon_code: null,
  });

  if (walErr) {
    console.log('❌ buy_with_wallet failed:', walErr.message, `(${walErr.code})`);
  } else {
    console.log('✅ buy_with_wallet returned:', walRes);
    // Clean up
    await client.from('orders').delete().eq('payment_code', testCodeWallet);
  }
}

testOrderCreation().catch(console.error);
