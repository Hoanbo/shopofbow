/**
 * Test RLS on public.orders for Admin user and Customer user
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
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDE3MzAsImV4cCI6MjEwMDU3NzczMH0.0K_jDk16zL_sE3b3VlCq423jE2C7-hR9UqNf9_N6uEw';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testRLS() {
  console.log('=== TESTING RLS ON public.orders FOR ADMIN ===\n');

  // Let's create an order
  const { data: u } = await adminDb.from('profiles').select('id, email').eq('email', 'hoankb4@gmail.com').single();
  const adminId = u!.id;

  const testCode = `RLSTEST_${Date.now().toString().slice(-4)}`;
  const { data: ord, error: insErr } = await adminDb.from('orders').insert({
    user_id: adminId,
    product_name: 'Test RLS Order',
    plan_label: '1 Tháng',
    price: 50000,
    payment_code: testCode,
    status: 'pending_payment',
  }).select('*').single();

  if (insErr) {
    console.log('❌ Insert failed:', insErr);
    return;
  }
  console.log(`Created test order ${ord.id} (${ord.payment_code})`);

  // Generate a custom session token for hoankb4@gmail.com
  // Or check public.admins table
  const { data: adminRow } = await adminDb.from('admins').select('*').eq('user_id', adminId);
  console.log('Admins table entry for adminId:', adminRow);

  // Check auth.users entry for admin
  const { data: authUser } = await adminDb.auth.admin.getUserById(adminId);
  console.log('Auth user email:', authUser?.user?.email);

  // Clean up
  await adminDb.from('notifications').delete().eq('order_id', ord.id);
  await adminDb.from('orders').delete().eq('id', ord.id);
}

testRLS().catch(console.error);
