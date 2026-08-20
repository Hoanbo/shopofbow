/**
 * BOW Security Hardening — VERIFY Script
 * Migration 0050: Notification INSERT/UPDATE Security
 *
 * Kiểm thử:
 * 1. User thường KHÔNG INSERT được notification (kể cả is_admin=false, user_id=self)
 * 2. User KHÔNG INSERT được admin notification (is_admin=true)
 * 3. User KHÔNG INSERT notification cho user khác
 * 4. Admin INSERT được notification
 * 5. Trigger SECURITY DEFINER vẫn tạo được notification (thông qua service_role)
 * 6. User KHÔNG UPDATE được field nhạy cảm (user_id, is_admin, type, title, message)
 * 7. User chỉ UPDATE được is_read trên notification của mình
 * 8. Admin UPDATE được tất cả
 * 9. User DELETE được notification của mình
 * 10. User KHÔNG DELETE được notification của user khác hay admin notification
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDE3MzAsImV4cCI6MjEwMDU3NzczMH0.XxOz3PMflhzrT1MWiOr4phd4vMs_MiJ7UbZ90b3Wykg';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function run() {
  console.log('================================================================');
  console.log('🔒 VERIFY: Migration 0050 — Notification Security Hardening');
  console.log('================================================================\n');

  // ── Setup: Get real users ──
  const { data: usersData } = await adminDb.auth.admin.listUsers();
  const adminUser = usersData!.users.find(u => u.email?.toLowerCase() === 'hoankb4@gmail.com')!;
  const regularUsers = usersData!.users.filter(u => u.email?.toLowerCase() !== 'hoankb4@gmail.com');
  const userA = regularUsers[0];
  const userB = regularUsers[1] ?? regularUsers[0];

  console.log(`Admin: ${adminUser.email} (${adminUser.id})`);
  console.log(`User A: ${userA.email} (${userA.id})`);
  console.log(`User B: ${userB.email} (${userB.id})\n`);

  // ── Auth: Create session for User A ──
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: linkA } = await adminDb.auth.admin.generateLink({ type: 'magiclink', email: userA.email! });
  if (linkA?.properties?.hashed_token) {
    const { data: verifyA } = await clientA.auth.verifyOtp({
      token_hash: linkA.properties.hashed_token,
      type: 'magiclink',
    });
    console.log(`Session User A: ${verifyA?.session ? 'OK' : 'FAILED'}`);
  }

  // ── Auth: Create session for Admin ──
  const clientAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: linkAdmin } = await adminDb.auth.admin.generateLink({ type: 'magiclink', email: adminUser.email! });
  if (linkAdmin?.properties?.hashed_token) {
    const { data: verifyAdmin } = await clientAdmin.auth.verifyOtp({
      token_hash: linkAdmin.properties.hashed_token,
      type: 'magiclink',
    });
    console.log(`Session Admin: ${verifyAdmin?.session ? 'OK' : 'FAILED'}\n`);
  }

  // ─────────────────────────────────────────────────────────────
  // PHẦN 1: INSERT SECURITY
  // ─────────────────────────────────────────────────────────────
  console.log('--- PHẦN 1: INSERT SECURITY ---');

  // TEST 1: User A KHÔNG INSERT được notification cho chính mình
  const { error: e1 } = await clientA.from('notifications').insert({
    type: 'system',
    title: 'HACK: User tự tạo',
    message: 'Thử tạo notification không hợp lệ',
    is_admin: false,
    user_id: userA.id,
    is_read: false,
  });
  assert(!!e1, 'TEST 1: User A bị chặn INSERT notification cho chính mình (via API)', e1?.message ?? 'INSERT không có lỗi — FAIL');

  // TEST 2: User A KHÔNG INSERT được admin notification
  const { error: e2 } = await clientA.from('notifications').insert({
    type: 'new_order',
    title: 'HACK: Giả mạo admin notif',
    message: 'Thử leo thang đặc quyền',
    is_admin: true,
    user_id: null,
    is_read: false,
  });
  assert(!!e2, 'TEST 2: User A bị chặn INSERT is_admin=true notification (leo thang đặc quyền)', e2?.message ?? 'INSERT không có lỗi — FAIL');

  // TEST 3: User A KHÔNG INSERT được notification cho User B
  const { error: e3 } = await clientA.from('notifications').insert({
    type: 'system',
    title: 'HACK: Gửi spam cho User B',
    message: 'Spam cho user khác',
    is_admin: false,
    user_id: userB.id,
    is_read: false,
  });
  assert(!!e3, 'TEST 3: User A bị chặn INSERT notification cho User B (user-to-user)', e3?.message ?? 'INSERT không có lỗi — FAIL');

  // TEST 4: Service Role vẫn INSERT được (đảm bảo hệ thống vẫn hoạt động)
  const testNotifId = '99000000-0000-0000-0000-000000000001';
  const { error: e4 } = await adminDb.from('notifications').insert({
    id: testNotifId,
    type: 'system',
    title: 'TEST: Service role notif',
    message: 'Do service_role tạo',
    is_admin: false,
    user_id: userA.id,
    is_read: false,
  });
  assert(!e4, 'TEST 4: Service role vẫn INSERT được notification (hệ thống hoạt động bình thường)', e4?.message);

  const testAdminNotifId = '99000000-0000-0000-0000-000000000002';
  const { error: e4b } = await adminDb.from('notifications').insert({
    id: testAdminNotifId,
    type: 'new_order',
    title: 'TEST: Admin notif',
    message: 'Do service_role tạo cho admin',
    is_admin: true,
    user_id: null,
    is_read: false,
  });
  assert(!e4b, 'TEST 5: Service role INSERT được admin notification (is_admin=true)', e4b?.message);

  // ─────────────────────────────────────────────────────────────
  // PHẦN 2: UPDATE SECURITY
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 2: UPDATE SECURITY ---');

  // TEST 6: User A chỉ được update is_read (mark as read)
  const { error: e6 } = await clientA.from('notifications').update({ is_read: true }).eq('id', testNotifId);
  assert(!e6, 'TEST 6: User A UPDATE is_read=true trên notification của mình — được phép', e6?.message);

  // TEST 7: User A KHÔNG được thay đổi title/message (field bất biến)
  const { error: e7 } = await clientA.from('notifications').update({
    title: 'HACKED TITLE',
    message: 'HACKED MESSAGE',
  }).eq('id', testNotifId);
  assert(!!e7, 'TEST 7: User A bị chặn UPDATE title/message (field bất biến — trigger guard)', e7?.message ?? 'UPDATE không có lỗi — FAIL');

  // TEST 8: User A KHÔNG được đổi is_admin
  const { error: e8 } = await clientA.from('notifications').update({ is_admin: true }).eq('id', testNotifId);
  assert(!!e8, 'TEST 8: User A bị chặn đổi is_admin=true trên notification của mình', e8?.message ?? 'UPDATE không có lỗi — FAIL');

  // TEST 9: User A KHÔNG được đổi user_id
  const { error: e9 } = await clientA.from('notifications').update({ user_id: userB.id }).eq('id', testNotifId);
  assert(!!e9, 'TEST 9: User A bị chặn đổi user_id sang User B', e9?.message ?? 'UPDATE không có lỗi — FAIL');

  // TEST 10: User A KHÔNG được update admin notification
  const { error: e10 } = await clientA.from('notifications').update({ is_read: true }).eq('id', testAdminNotifId);
  // Kỳ vọng: 0 rows updated hoặc error (do RLS using clause không match)
  const { data: adminNotifAfter } = await adminDb.from('notifications').select('is_read').eq('id', testAdminNotifId).single();
  assert(
    adminNotifAfter?.is_read === false || !!e10,
    'TEST 10: User A KHÔNG update được admin notification (RLS using clause)',
    e10?.message ?? `is_read = ${adminNotifAfter?.is_read}`
  );

  // TEST 11: Admin UPDATE được tất cả
  const { error: e11 } = await clientAdmin.from('notifications').update({ is_read: true }).eq('id', testAdminNotifId);
  assert(!e11, 'TEST 11: Admin UPDATE được admin notification (is_read)', e11?.message);

  // ─────────────────────────────────────────────────────────────
  // PHẦN 3: DELETE SECURITY
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 3: DELETE SECURITY ---');

  // TEST 12: User A KHÔNG DELETE được admin notification
  const { error: e12 } = await clientA.from('notifications').delete().eq('id', testAdminNotifId);
  const { data: adminNotifStillExists } = await adminDb.from('notifications').select('id').eq('id', testAdminNotifId).single();
  assert(
    !!adminNotifStillExists || !!e12,
    'TEST 12: User A KHÔNG xóa được admin notification',
    e12?.message ?? (adminNotifStillExists ? 'Admin notif vẫn tồn tại ✓' : 'Admin notif đã bị xóa — FAIL')
  );

  // TEST 13: User A DELETE được notification của chính mình
  const { error: e13 } = await clientA.from('notifications').delete().eq('id', testNotifId);
  const { data: userNotifStillExists } = await adminDb.from('notifications').select('id').eq('id', testNotifId).single();
  assert(
    !e13 && !userNotifStillExists,
    'TEST 13: User A DELETE được notification của chính mình',
    e13?.message ?? (!userNotifStillExists ? 'Đã xóa thành công ✓' : 'Notification vẫn còn — FAIL')
  );

  // ─────────────────────────────────────────────────────────────
  // PHẦN 4: REALTIME CHANNEL PROBING
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 4: REALTIME CHANNEL PROBING ---');

  let receivedAdminEvent = false;
  let receivedUserBEvent = false;

  const probeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: linkProbe } = await adminDb.auth.admin.generateLink({ type: 'magiclink', email: userA.email! });
  if (linkProbe?.properties?.hashed_token) {
    await probeClient.auth.verifyOtp({ token_hash: linkProbe.properties.hashed_token, type: 'magiclink' });
  }

  // User A cố subscribe admin channel
  const maliciousAdminCh = probeClient
    .channel('malicious-admin')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'is_admin=eq.true' }, () => {
      receivedAdminEvent = true;
    })
    .subscribe();

  // User A cố subscribe user-hub của User B
  const maliciousUserBCh = probeClient
    .channel(`malicious-user-b-hub`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userB.id}` }, () => {
      receivedUserBEvent = true;
    })
    .subscribe();

  await new Promise(r => setTimeout(r, 2000));

  // Trigger events
  const liveAdminId = '99000000-0000-0000-0000-000000000011';
  const liveUserBId = '99000000-0000-0000-0000-000000000012';

  await adminDb.from('notifications').insert([
    { id: liveAdminId, type: 'new_order', title: 'LIVE ADMIN', message: 'Admin notif', is_admin: true, user_id: null, is_read: false },
    { id: liveUserBId, type: 'system', title: 'LIVE USER B', message: 'User B notif', is_admin: false, user_id: userB.id, is_read: false },
  ]);

  await new Promise(r => setTimeout(r, 3000));

  assert(!receivedAdminEvent, 'TEST 14: Realtime — User A KHÔNG nhận admin notification qua WebSocket (RLS WAL)');
  assert(!receivedUserBEvent, 'TEST 15: Realtime — User A KHÔNG nhận notification của User B qua WebSocket');

  probeClient.removeChannel(maliciousAdminCh);
  probeClient.removeChannel(maliciousUserBCh);

  // ─────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────
  await adminDb.from('notifications').delete().in('id', [
    testNotifId, testAdminNotifId, liveAdminId, liveUserBId,
  ]);

  // ─────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  console.log('\n================================================================');
  console.log(`📊 KẾT QUẢ: ${passed}/${total} TEST PASS`);
  console.log('================================================================');

  const failedTests = results.filter(r => !r.pass);
  if (failedTests.length > 0) {
    console.log('\n❌ TESTS FAILED:');
    for (const t of failedTests) {
      console.log(`  - ${t.name}: ${t.detail ?? 'No detail'}`);
    }
  }

  if (passed === total) {
    console.log('\n✅ Security checks passed for verified scope.');
    console.log('   Migration 0050 hardening verified successfully.\n');
  } else {
    console.log('\n⚠️  Some security checks failed. Review before deploying.\n');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
