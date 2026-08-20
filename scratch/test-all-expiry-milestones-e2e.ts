/**
 * Comprehensive E2E Verification Suite for Order Expiry Reminder System
 * Tests all 4 milestones (7d, 3d, 1d, expired) + manual_reminder + security + SMTP acceptance.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
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
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '81d70e09-f061-4967-ab9c-9cdc1782e128';

const VERCEL_URL = 'https://shopofbow.vercel.app/api/email-notify';

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  results.push({ name: testName, pass: condition, detail });
  const icon = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${testName}${detail ? ` → ${detail}` : ''}`);
}

async function runE2ETestSuite() {
  console.log('================================================================');
  console.log('🚀 E2E AUDIT: Order Expiry Reminder & Email Dispatch System');
  console.log('================================================================\n');

  const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find real order for hoankb4@gmail.com
  const { data: orders } = await adminDb
    .from('orders')
    .select('id, payment_code, product_name, user_id, status')
    .not('user_id', 'is', null)
    .limit(1);

  if (!orders || orders.length === 0) {
    console.error('No orders with user_id found');
    return;
  }

  const testOrder = orders[0];
  console.log(`Target Order: #${testOrder.payment_code} (${testOrder.id})\n`);

  // ─────────────────────────────────────────────────────────────
  // PHẦN 1: BẢO MẬT & XÁC THỰC ENDPOINT
  // ─────────────────────────────────────────────────────────────
  console.log('--- PHẦN 1: ENDPOINT AUTHENTICATION & SECURITY ---');

  // TEST 1: Reject unauthenticated requests
  const res1 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: testOrder.id, type: 'expiry_7_days' }),
  });
  assert(res1.status === 401, 'TEST 1: Chặn truy cập không xác thực (No Auth Header → 401)', `HTTP ${res1.status}`);

  // TEST 2: Reject invalid API key
  const res2 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Apikey INVALID_SECRET_KEY_123',
    },
    body: JSON.stringify({ order_id: testOrder.id, type: 'expiry_7_days' }),
  });
  assert(res2.status === 401, 'TEST 2: Chặn truy cập với INTERNAL_API_KEY sai (Invalid Key → 401)', `HTTP ${res2.status}`);

  // TEST 3: Reject request with non-existent order
  const res3 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({ order_id: '00000000-0000-0000-0000-000000000000', type: 'expiry_7_days' }),
  });
  assert(res3.status === 404, 'TEST 3: Xử lý chính xác đơn hàng không tồn tại (Order Not Found → 404)', `HTTP ${res3.status}`);

  // ─────────────────────────────────────────────────────────────
  // PHẦN 2: DISPATCH THỰC TẾ 4 MỐC NHẮC HẠN QUA SMTP
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 2: REAL DISPATCH 4 EXPIRY MILESTONES VIA GMAIL SMTP ---');

  // TEST 4: Milestone 7 Ngày (expiry_7_days)
  const res4 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      order_id: testOrder.id,
      type: 'expiry_7_days',
      event: 'expiry_7_days',
      days_left: 7,
      expires_at_formatted: '27/08/2026',
    }),
  });
  const data4 = await res4.json().catch(() => null);
  assert(res4.status === 200 && data4?.status === 'sent', 'TEST 4: Mốc 7 Ngày (expiry_7_days) gửi email thành công', `MessageId: ${data4?.messageId}`);

  // TEST 5: Milestone 3 Ngày (expiry_3_days)
  const res5 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      order_id: testOrder.id,
      type: 'expiry_3_days',
      event: 'expiry_3_days',
      days_left: 3,
      expires_at_formatted: '23/08/2026',
    }),
  });
  const data5 = await res5.json().catch(() => null);
  assert(res5.status === 200 && data5?.status === 'sent', 'TEST 5: Mốc 3 Ngày (expiry_3_days) gửi email thành công', `MessageId: ${data5?.messageId}`);

  // TEST 6: Milestone 1 Ngày (expiry_1_day)
  const res6 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      order_id: testOrder.id,
      type: 'expiry_1_day',
      event: 'expiry_1_day',
      days_left: 1,
      expires_at_formatted: '21/08/2026',
    }),
  });
  const data6 = await res6.json().catch(() => null);
  assert(res6.status === 200 && data6?.status === 'sent', 'TEST 6: Mốc 1 Ngày (expiry_1_day) gửi email thành công', `MessageId: ${data6?.messageId}`);

  // TEST 7: Milestone Đã Hết Hạn (expiry_expired)
  const res7 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      order_id: testOrder.id,
      type: 'expiry_expired',
      event: 'expiry_expired',
      days_left: 0,
      expires_at_formatted: '20/08/2026',
    }),
  });
  const data7 = await res7.json().catch(() => null);
  assert(res7.status === 200 && data7?.status === 'sent', 'TEST 7: Mốc Đã Hết Hạn (expiry_expired) gửi email thành công', `MessageId: ${data7?.messageId}`);

  // TEST 8: Gửi Nhắc Thủ Công (manual_reminder)
  const res8 = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      order_id: testOrder.id,
      type: 'manual_reminder',
      event: 'manual_reminder',
      days_left: 3,
      expires_at_formatted: '23/08/2026',
      custom_message: 'Lời nhắn thử nghiệm từ Ban Quản Trị BOW',
    }),
  });
  const data8 = await res8.json().catch(() => null);
  assert(res8.status === 200 && data8?.status === 'sent', 'TEST 8: Nhắc Thủ Công (manual_reminder) gửi email thành công', `MessageId: ${data8?.messageId}`);

  // ─────────────────────────────────────────────────────────────
  // PHẦN 3: BÁO CÁO TỔNG HỢP
  // ─────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  console.log('\n================================================================');
  console.log(`📊 KẾT QUẢ E2E: ${passed}/${total} TEST PASS`);
  console.log('================================================================');

  if (passed === total) {
    console.log('\n✅ 100% Expiry Email System Tests Passed successfully with real Gmail SMTP.');
  } else {
    console.log('\n⚠️ Some tests failed. Review details above.');
    process.exit(1);
  }
}

runE2ETestSuite().catch(console.error);
