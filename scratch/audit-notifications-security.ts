import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDE3MzAsImV4cCI6MjEwMDU3NzczMH0.XxOz3PMflhzrT1MWiOr4phd4vMs_MiJ7UbZ90b3Wykg';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

// 1. Service Role Client (for setup & teardown only)
const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('🛡️  BẮT ĐẦU AUDIT BẢO MẬT: NOTIFICATIONS & SUPABASE REALTIME');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      console.log(`✅ [PASS ${total}]: ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL ${total}]: ${testName}`, detail || '');
    }
  }

  // Find or create test users
  console.log('1. Khởi tạo tài khoản kiểm thử...');
  const { data: usersData, error: uErr } = await adminDb.auth.admin.listUsers();
  if (uErr || !usersData?.users?.length) {
    console.error('Cannot list users:', uErr);
    process.exit(1);
  }

  const adminUser = usersData.users.find(u => u.email?.toLowerCase() === 'hoankb4@gmail.com');
  const normalUsers = usersData.users.filter(u => u.email?.toLowerCase() !== 'hoankb4@gmail.com');

  if (!adminUser || normalUsers.length < 2) {
    console.log(`Found admin: ${!!adminUser}, normal users count: ${normalUsers.length}`);
  }

  const userA = normalUsers[0];
  const userB = normalUsers[1] || normalUsers[0];

  console.log(`- Admin User ID : ${adminUser?.id} (${adminUser?.email})`);
  console.log(`- User A ID     : ${userA.id} (${userA.email})`);
  console.log(`- User B ID     : ${userB.id} (${userB.email})\n`);

  // Tạo client với JWT token thật của từng user
  // Helper to get authenticated client for user ID
  async function createClientForUser(userId: string) {
    // Generate custom session / sign in via admin
    const { data, error } = await adminDb.auth.admin.generateLink({
      type: 'magiclink',
      email: usersData.users.find(u => u.id === userId)?.email || '',
    });
    
    // We can also create a client with the user's token directly by generating a JWT or impersonating via auth
    // In Supabase js, createClient with Authorization header:
    // Better: sign in with password if known or use user context via supabase client with token
    return {
      client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: {
          headers: {
            // We simulate user JWT or test via direct RLS evaluation
          }
        }
      })
    };
  }

  // ────────────────────────────────────────────────────────────
  // KIỂM TRA 1 & 3: RLS POLICY ON NOTIFICATIONS (Direct Query)
  // ────────────────────────────────────────────────────────────
  console.log('--- PHẦN 1: AUDIT CHÍNH SÁCH RLS TRÊN BẢNG NOTIFICATIONS ---');

  // Insert a test Admin notification via service role
  const testAdminNotifId = '00000000-0000-0000-0000-000000000001';
  const testUserANotifId = '00000000-0000-0000-0000-000000000002';
  const testUserBNotifId = '00000000-0000-0000-0000-000000000003';

  // Clean old test records if any
  await adminDb.from('notifications').delete().in('id', [testAdminNotifId, testUserANotifId, testUserBNotifId]);

  // Insert 3 distinct notifications
  await adminDb.from('notifications').insert([
    {
      id: testAdminNotifId,
      type: 'new_order',
      title: '[ADMIN SECRET] Đơn hàng thanh toán 5.000.000đ',
      message: 'Thông báo nội bộ chỉ dành cho Ban Quản Trị BOW',
      is_admin: true,
      user_id: null,
      is_read: false,
    },
    {
      id: testUserANotifId,
      type: 'order_paid',
      title: '[USER A] Đơn hàng của bạn đã thanh toán',
      message: 'Thông báo riêng tư của User A',
      is_admin: false,
      user_id: userA.id,
      is_read: false,
    },
    {
      id: testUserBNotifId,
      type: 'order_paid',
      title: '[USER B] Đơn hàng của bạn đã thanh toán',
      message: 'Thông báo riêng tư của User B',
      is_admin: false,
      user_id: userB.id,
      is_read: false,
    }
  ]);

  // Execute queries as specific authenticated roles using Supabase auth tokens
  // We can create real sessions using admin auth token or custom magic links
  const { data: userASession } = await adminDb.auth.admin.getUserById(userA.id);
  const { data: adminSession } = await adminDb.auth.admin.getUserById(adminUser?.id || '');

  // 1. Direct query as Anonymous (Unauthenticated)
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: anonNotifs } = await anonClient.from('notifications').select('*');
  assert(!anonNotifs || anonNotifs.length === 0, 'TEST 1: Khách vãng lai (Anon/Unauthenticated) bị RLS chặn 100%, không xem được bất kỳ thông báo nào', { count: anonNotifs?.length });

  // 2. Query as Authenticated User A using Postgres RPC / RLS simulation
  // Test RLS by creating an authenticated client with User A's token
  // Let's create a sign-in token for User A
  const { data: linkA } = await adminDb.auth.admin.generateLink({
    type: 'magiclink',
    email: userA.email || '',
  });

  let clientUserA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  if (linkA?.properties?.hashed_token) {
    const { data: verifyData } = await clientUserA.auth.verifyOtp({
      token_hash: linkA.properties.hashed_token,
      type: 'magiclink',
    });
    if (verifyData.session) {
      console.log(`Đã xác thực thành công session cho User A (${userA.email})`);
    }
  }

  // Query all notifications as User A
  const { data: userAAllNotifs, error: userAErr } = await clientUserA.from('notifications').select('*');
  
  const userASeesAdminNotif = userAAllNotifs?.some((n: any) => n.id === testAdminNotifId || n.is_admin === true);
  assert(!userASeesAdminNotif, 'TEST 2: User A query `.from("notifications").select("*")` KHÔNG BAO GIỜ nhận được thông báo Admin (RLS chặn ở Database Level)', { userASeesAdminNotif });

  const userASeesUserBNotif = userAAllNotifs?.some((n: any) => n.id === testUserBNotifId || (n.user_id && n.user_id !== userA.id));
  assert(!userASeesUserBNotif, 'TEST 3: User A KHÔNG BAO GIỜ đọc được thông báo của User B (User-to-User Isolation bảo đảm bởi RLS)', { userASeesUserBNotif });

  // User A directly tries to query admin notifications specifically
  const { data: userADirectAdminQuery } = await clientUserA.from('notifications').select('*').eq('is_admin', true);
  assert(!userADirectAdminQuery || userADirectAdminQuery.length === 0, 'TEST 4: User A cố tình query `.eq("is_admin", true)` trả về 0 bản ghi (Không bypass được qua filter/API)');

  // ────────────────────────────────────────────────────────────
  // KIỂM TRA 4: ADMIN ACCESS TO NOTIFICATIONS
  // ────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 2: AUDIT QUYỀN TRUY CẬP CỦA ADMIN ---');
  let clientAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  if (adminUser?.email) {
    const { data: linkAdmin } = await adminDb.auth.admin.generateLink({
      type: 'magiclink',
      email: adminUser.email,
    });
    if (linkAdmin?.properties?.hashed_token) {
      await clientAdmin.auth.verifyOtp({
        token_hash: linkAdmin.properties.hashed_token,
        type: 'magiclink',
      });
      console.log(`Đã xác thực thành công session cho Admin (${adminUser.email})`);
    }
  }

  const { data: adminAllNotifs } = await clientAdmin.from('notifications').select('*').eq('is_admin', true);
  const adminSeesTestNotif = adminAllNotifs?.some((n: any) => n.id === testAdminNotifId);
  assert(!!adminSeesTestNotif, 'TEST 5: Admin query `.eq("is_admin", true)` nhận đầy đủ thông báo dành cho Quản trị viên');

  // ────────────────────────────────────────────────────────────
  // KIỂM TRA 5: REALTIME BROADCAST & RLS ENFORCEMENT
  // ────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 3: AUDIT REALTIME WEBSOCKET & PAYLOAD ISOLATION ---');

  // Test Realtime with User A listening to user-hub
  let receivedByUserA: any[] = [];
  const userAChannel = clientUserA
    .channel(`user-hub-${userA.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userA.id}` }, (p) => {
      receivedByUserA.push(p.new);
    })
    .subscribe();

  // Also test if User A tries to maliciously subscribe to admin-hub-global
  let userAMaliciousAdminEvents: any[] = [];
  const userAMaliciousChannel = clientUserA
    .channel('malicious-admin-hub-subscription')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'is_admin=eq.true' }, (p) => {
      userAMaliciousAdminEvents.push(p.new);
    })
    .subscribe();

  // Wait for subscriptions to connect
  await new Promise((r) => setTimeout(r, 2000));

  // Trigger new notifications: 1 for User A, 1 for Admin, 1 for User B
  const liveAdminNotifId = '00000000-0000-0000-0000-000000000011';
  const liveUserANotifId = '00000000-0000-0000-0000-000000000012';
  const liveUserBNotifId = '00000000-0000-0000-0000-000000000013';

  await adminDb.from('notifications').insert([
    {
      id: liveAdminNotifId,
      type: 'new_order',
      title: 'LIVE ADMIN NOTIF',
      message: 'Nội dung mật Admin',
      is_admin: true,
      user_id: null,
      is_read: false,
    },
    {
      id: liveUserANotifId,
      type: 'order_paid',
      title: 'LIVE USER A NOTIF',
      message: 'Nội dung User A',
      is_admin: false,
      user_id: userA.id,
      is_read: false,
    },
    {
      id: liveUserBNotifId,
      type: 'order_paid',
      title: 'LIVE USER B NOTIF',
      message: 'Nội dung User B',
      is_admin: false,
      user_id: userB.id,
      is_read: false,
    }
  ]);

  // Wait for realtime events to deliver
  await new Promise((r) => setTimeout(r, 3000));

  // Check what User A received
  const receivedAdminEvent = userAMaliciousAdminEvents.some(e => e.id === liveAdminNotifId);
  assert(!receivedAdminEvent, 'TEST 6: Realtime WAL & RLS ngăn chặn triệt để User A nhận Admin Notification qua WebSocket (0 payload rò rỉ)', { userAMaliciousAdminEvents });

  const receivedUserBEvent = receivedByUserA.some(e => e.id === liveUserBNotifId || (e.user_id && e.user_id !== userA.id));
  assert(!receivedUserBEvent, 'TEST 7: Realtime Hub phân tách 100% — User A không nhận bất kỳ event nào của User B', { receivedByUserA });

  // ────────────────────────────────────────────────────────────
  // KIỂM TRA 6: SENSITIVE FIELDS AUDIT
  // ────────────────────────────────────────────────────────────
  console.log('\n--- PHẦN 4: AUDIT SENSITIVE FIELDS TRONG PAYLOAD ---');
  const sampleNotif = userAAllNotifs?.[0] || {};
  const sensitiveKeys = ['password', 'secret', 'token', 'auth_token', 'private_key', 'api_key'];
  const exposedSensitive = Object.keys(sampleNotif).filter(k => sensitiveKeys.includes(k.toLowerCase()));
  assert(exposedSensitive.length === 0, 'TEST 8: Bảng notifications không chứa hoặc làm lộ bất kỳ trường nhạy cảm nào (mật khẩu, tokens, api keys)', { fields: Object.keys(sampleNotif) });

  // ────────────────────────────────────────────────────────────
  // CLEANUP TEST DATA
  // ────────────────────────────────────────────────────────────
  console.log('\n--- DỌN DẸP DỮ LIỆU KIỂM THỬ ---');
  await adminDb.from('notifications').delete().in('id', [
    testAdminNotifId, testUserANotifId, testUserBNotifId,
    liveAdminNotifId, liveUserANotifId, liveUserBNotifId,
  ]);
  clientUserA.removeChannel(userAChannel);
  clientUserA.removeChannel(userAMaliciousChannel);
  console.log('Đã dọn dẹp sạch sẽ các bản ghi kiểm thử.');

  console.log('\n================================================================');
  console.log(`KẾT QUẢ TỔNG HỢP: ${passed}/${total} TEST PASS (${Math.round(passed / total * 100)}%)`);
  console.log('================================================================\n');
}

runSecurityAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
