// scratch/test_phase10_full_e2e_certification.mjs
// Phase 10: Full E2E Certification / QA Suite
// Strict evaluation of User Agent, Admin Copilot, Surface Isolation, RBAC, Action Card Contracts, and Error Handling

import { resolveMultiIntent } from '../node_modules/@bow/agent/dist/index.js';
import { processAgentMessageV2 } from '../node_modules/@bow/agent/dist/core/agentEngine.js';

console.log('========================================================================');
console.log('🏛️ BOW AGENT V4.0 — PHASE 10 FULL E2E CERTIFICATION SUITE');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
    failed++;
    failures.push(name);
  }
}

// Context fixtures
const ctxCustomerOnHomepage = {
  role: 'customer',
  surface: 'customer',
  route: '/',
  isAuthenticated: false,
  userId: undefined,
};

const ctxAuthCustomerOnHomepage = {
  role: 'customer',
  surface: 'customer',
  route: '/',
  isAuthenticated: true,
  userId: 'cust_7781',
};

const ctxAdminOnHomepage = {
  role: 'admin',
  surface: 'customer',
  route: '/',
  isAuthenticated: true,
  userId: 'admin_master',
};

const ctxAdminOnDashboard = {
  role: 'admin',
  surface: 'admin',
  route: '/admin',
  isAuthenticated: true,
  userId: 'admin_master',
};

const ctxCustomerOnAdminRoute = {
  role: 'customer',
  surface: 'admin',
  route: '/admin',
  isAuthenticated: true,
  userId: 'cust_intruder',
};

async function runPhase10Certification() {
  // =========================================================================
  // GROUP 1: USER AGENT (Customer Surface)
  // =========================================================================
  console.log('📌 GROUP 1: User Agent on Customer Surface');

  // A1: Greeting
  const a1 = resolveMultiIntent('Chào shop', ctxCustomerOnHomepage);
  assert(a1.primaryIntent === 'GREETING', 'A1: "Chào shop" -> GREETING');
  const a1Res = await processAgentMessageV2('Chào shop', ctxCustomerOnHomepage);
  assert(!a1Res.data || !a1Res.data.type?.startsWith('admin_') && a1Res.data.type !== 'pending_fulfillment', 
    'A1: "Chào shop" does not produce Admin Action Card');

  // A2: Product Search / Discovery
  const a2 = resolveMultiIntent('Có Canva Pro không?', ctxCustomerOnHomepage);
  assert(a2.primaryIntent === 'PRODUCT_SEARCH' || a2.primaryIntent === 'BUY' || a2.primaryIntent === 'UNKNOWN', 
    'A2: "Có Canva Pro không?" routes to customer product flow', `Intent: ${a2.primaryIntent}`);
  assert(!a2.primaryIntent.startsWith('ADMIN_'), 'A2: Product query does NOT route to any ADMIN_* intent');

  // A3: Buy Intent
  const a3 = resolveMultiIntent('Mua YouTube Premium 6 tháng', ctxCustomerOnHomepage);
  assert(a3.primaryIntent === 'BUY', 'A3: "Mua YouTube Premium 6 tháng" -> BUY');

  // A4: Customer Order Tracking (NOT ADMIN_ORDER_LOOKUP)
  const a4 = resolveMultiIntent('Kiểm tra đơn hàng của tôi', ctxAuthCustomerOnHomepage);
  assert(a4.primaryIntent !== 'ADMIN_ORDER_LOOKUP', 'A4: Customer "Kiểm tra đơn hàng của tôi" MUST NOT route to ADMIN_ORDER_LOOKUP');
  assert(a4.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'A4: Customer order query does NOT route to ADMIN_PENDING_HANDOVER');

  // =========================================================================
  // GROUP 2: ADMIN ON HOMEPAGE (Surface Isolation)
  // =========================================================================
  console.log('\n📌 GROUP 2: Admin on Homepage (surface: customer, role: admin)');

  // Admin on homepage greeting -> GREETING
  const admHomeG = resolveMultiIntent('Chào shop', ctxAdminOnHomepage);
  assert(admHomeG.primaryIntent === 'GREETING', 'Admin on homepage "Chào shop" -> GREETING');

  // Admin on homepage buying -> BUY
  const admHomeBuy = resolveMultiIntent('Mua Canva Pro 1 năm', ctxAdminOnHomepage);
  assert(admHomeBuy.primaryIntent === 'BUY', 'Admin on homepage "Mua Canva Pro 1 năm" -> BUY');

  // Admin on homepage asking admin question -> BLOCKED from Admin intent
  const admHomePending = resolveMultiIntent('Đơn nào đang chờ bàn giao?', ctxAdminOnHomepage);
  assert(admHomePending.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 
    'Admin on homepage "Đơn nào đang chờ bàn giao?" MUST NOT route to ADMIN_PENDING_HANDOVER');

  const admHomeRev = resolveMultiIntent('Báo cáo doanh thu và lợi nhuận hôm nay', ctxAdminOnHomepage);
  assert(admHomeRev.primaryIntent !== 'ADMIN_REVENUE_REPORT', 
    'Admin on homepage "Báo cáo doanh thu" MUST NOT route to ADMIN_REVENUE_REPORT');

  // Runtime check: Admin on homepage must NOT receive admin action card
  const admHomeRes = await processAgentMessageV2('Đơn nào đang chờ bàn giao?', ctxAdminOnHomepage);
  assert(admHomeRes.data?.type !== 'pending_fulfillment', 
    'Admin on homepage runtime MUST NOT produce pending_fulfillment Action Card');

  // =========================================================================
  // GROUP 3: ADMIN DASHBOARD (surface: admin, role: admin)
  // =========================================================================
  console.log('\n📌 GROUP 3: Admin AI Copilot on Dashboard (surface: admin, role: admin)');

  // A7.1 Pending Handover
  const i7_1 = resolveMultiIntent('Đơn nào đang chờ bàn giao?', ctxAdminOnDashboard);
  assert(i7_1.primaryIntent === 'ADMIN_PENDING_HANDOVER', 'A7.1: "Đơn nào đang chờ bàn giao?" -> ADMIN_PENDING_HANDOVER');
  const r7_1 = await processAgentMessageV2('Đơn nào đang chờ bàn giao?', ctxAdminOnDashboard);
  assert(r7_1.data?.type === 'pending_fulfillment', 'A7.1: Action Card type is pending_fulfillment');
  assert(r7_1.data?.pendingQueue !== undefined, 'A7.1: Payload has pendingQueue');

  // A7.2 Daily Summary
  const i7_2 = resolveMultiIntent('Hôm nay shop có gì cần tôi xử lý?', ctxAdminOnDashboard);
  assert(i7_2.primaryIntent === 'ADMIN_DAILY_SUMMARY', 'A7.2: "Hôm nay shop có gì cần tôi xử lý?" -> ADMIN_DAILY_SUMMARY');
  const r7_2 = await processAgentMessageV2('Hôm nay shop có gì cần tôi xử lý?', ctxAdminOnDashboard);
  assert(r7_2.data?.type === 'daily_summary', 'A7.2: Action Card type is daily_summary');
  assert(r7_2.data?.summary !== undefined, 'A7.2: Payload has summary');

  // A7.3 Task Prioritization
  const i7_3 = resolveMultiIntent('Hôm nay tôi nên xử lý gì trước?', ctxAdminOnDashboard);
  assert(i7_3.primaryIntent === 'ADMIN_TASK_PRIORITIZATION', 'A7.3: "Hôm nay tôi nên xử lý gì trước?" -> ADMIN_TASK_PRIORITIZATION');
  const r7_3 = await processAgentMessageV2('Hôm nay tôi nên xử lý gì trước?', ctxAdminOnDashboard);
  assert(r7_3.data?.type === 'task_prioritization', 'A7.3: Action Card type is task_prioritization');
  assert(Array.isArray(r7_3.data?.tasks?.tasks), 'A7.3: Payload has tasks array');

  // A7.4 Order Lookup
  const i7_4 = resolveMultiIntent('Kiểm tra đơn #BOW-ORD-8812', ctxAdminOnDashboard);
  assert(i7_4.primaryIntent === 'ADMIN_ORDER_LOOKUP', 'A7.4: "Kiểm tra đơn #BOW-ORD-8812" -> ADMIN_ORDER_LOOKUP');
  const r7_4 = await processAgentMessageV2('Kiểm tra đơn #BOW-ORD-8812', ctxAdminOnDashboard);
  assert(r7_4.data?.type === 'order_lookup', 'A7.4: Action Card type is order_lookup');
  assert(r7_4.data?.order?.orderId !== undefined, 'A7.4: Payload has orderId');

  // A7.5 Customer Lookup
  const i7_5 = resolveMultiIntent('Kiểm tra khách hàng Trần Minh Đức', ctxAdminOnDashboard);
  assert(i7_5.primaryIntent === 'ADMIN_CUSTOMER_LOOKUP', 'A7.5: "Kiểm tra khách hàng Trần Minh Đức" -> ADMIN_CUSTOMER_LOOKUP');
  const r7_5 = await processAgentMessageV2('Kiểm tra khách hàng Trần Minh Đức', ctxAdminOnDashboard);
  assert(r7_5.data?.type === 'customer_lookup', 'A7.5: Action Card type is customer_lookup');
  assert(r7_5.data?.customer?.customerName !== undefined, 'A7.5: Payload has customerName');

  // A7.6 Sales Analytics
  const i7_6 = resolveMultiIntent('Sản phẩm nào bán chạy nhất hôm nay?', ctxAdminOnDashboard);
  assert(i7_6.primaryIntent === 'ADMIN_SALES_ANALYTICS', 'A7.6: "Sản phẩm nào bán chạy nhất hôm nay?" -> ADMIN_SALES_ANALYTICS');
  const r7_6 = await processAgentMessageV2('Sản phẩm nào bán chạy nhất hôm nay?', ctxAdminOnDashboard);
  assert(r7_6.data?.type === 'sales_report', 'A7.6: Action Card type is sales_report');
  assert(Array.isArray(r7_6.data?.report?.topProducts), 'A7.6: Payload has topProducts array');

  // A7.7 Revenue & Margin Report
  const i7_7 = resolveMultiIntent('Báo cáo doanh thu và lợi nhuận hôm nay', ctxAdminOnDashboard);
  assert(i7_7.primaryIntent === 'ADMIN_REVENUE_REPORT', 'A7.7: "Báo cáo doanh thu và lợi nhuận hôm nay" -> ADMIN_REVENUE_REPORT');
  const r7_7 = await processAgentMessageV2('Báo cáo doanh thu và lợi nhuận hôm nay', ctxAdminOnDashboard);
  assert(r7_7.data?.type === 'profit_margin', 'A7.7: Action Card type is profit_margin');
  assert(r7_7.data?.profitReport?.netProfit !== undefined, 'A7.7: Payload has netProfit');

  // A7.8 Voucher Creation
  const i7_8 = resolveMultiIntent('Tạo voucher giảm 20% cho khách', ctxAdminOnDashboard);
  assert(i7_8.primaryIntent === 'ADMIN_VOUCHER_CREATE', 'A7.8: "Tạo voucher giảm 20% cho khách" -> ADMIN_VOUCHER_CREATE');
  const r7_8 = await processAgentMessageV2('Tạo voucher giảm 20% cho khách', ctxAdminOnDashboard);
  assert(r7_8.data?.type === 'shop_voucher', 'A7.8: Action Card type is shop_voucher');
  assert(r7_8.data?.voucher?.code !== undefined, 'A7.8: Payload has voucher code');

  // A7.9 Dispute Inspection
  const i7_9 = resolveMultiIntent('Kiểm tra khiếu nại đơn #BOW-ORD-9921', ctxAdminOnDashboard);
  assert(i7_9.primaryIntent === 'ADMIN_DISPUTE_INSPECT', 'A7.9: "Kiểm tra khiếu nại đơn #BOW-ORD-9921" -> ADMIN_DISPUTE_INSPECT');
  const r7_9 = await processAgentMessageV2('Kiểm tra khiếu nại đơn #BOW-ORD-9921', ctxAdminOnDashboard);
  assert(r7_9.data?.type === 'order_dispute', 'A7.9: Action Card type is order_dispute');
  assert(r7_9.data?.dispute?.issueReported !== undefined, 'A7.9: Payload has issueReported');

  // A7.10 Order Handover
  const i7_10 = resolveMultiIntent('Bàn giao tài khoản cho đơn BOW-ORD-8812', ctxAdminOnDashboard);
  assert(i7_10.primaryIntent === 'ADMIN_ORDER_HANDOVER', 'A7.10: "Bàn giao tài khoản cho đơn BOW-ORD-8812" -> ADMIN_ORDER_HANDOVER');
  const r7_10 = await processAgentMessageV2('Bàn giao tài khoản cho đơn BOW-ORD-8812', ctxAdminOnDashboard);
  assert(r7_10.data?.type === 'order_handover', 'A7.10: Action Card type is order_handover');
  assert(r7_10.data?.handover !== undefined, 'A7.10: Payload has handover data');

  // =========================================================================
  // GROUP 4: CUSTOMER RBAC ENFORCEMENT
  // =========================================================================
  console.log('\n📌 GROUP 4: Customer RBAC Enforcement (Customer Role Security)');

  // Customer asks admin questions on customer surface
  const cAdmin1 = resolveMultiIntent('Đơn nào đang chờ bàn giao?', ctxCustomerOnHomepage);
  assert(cAdmin1.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'RBAC: Customer "Đơn nào đang chờ bàn giao?" cannot trigger ADMIN_PENDING_HANDOVER');

  const cAdmin2 = resolveMultiIntent('Báo cáo doanh thu hôm nay', ctxCustomerOnHomepage);
  assert(cAdmin2.primaryIntent !== 'ADMIN_REVENUE_REPORT', 'RBAC: Customer "Báo cáo doanh thu" cannot trigger ADMIN_REVENUE_REPORT');

  const cAdmin3 = resolveMultiIntent('Tạo voucher giảm 20% cho khách', ctxCustomerOnHomepage);
  assert(cAdmin3.primaryIntent !== 'ADMIN_VOUCHER_CREATE', 'RBAC: Customer "Tạo voucher" cannot trigger ADMIN_VOUCHER_CREATE');

  const cAdmin4 = resolveMultiIntent('Kiểm tra khiếu nại đơn #BOW-ORD-9921', ctxCustomerOnHomepage);
  assert(cAdmin4.primaryIntent !== 'ADMIN_DISPUTE_INSPECT', 'RBAC: Customer "Kiểm tra khiếu nại" cannot trigger ADMIN_DISPUTE_INSPECT');

  // Runtime RBAC checks
  const rCustHandover = await processAgentMessageV2('Đơn nào đang chờ bàn giao?', ctxCustomerOnHomepage);
  assert(rCustHandover.data?.type !== 'pending_fulfillment', 'RBAC Runtime: Customer receives NO pending_fulfillment action card');

  const rCustRev = await processAgentMessageV2('Báo cáo doanh thu và lợi nhuận hôm nay', ctxCustomerOnHomepage);
  assert(rCustRev.data?.type !== 'profit_margin', 'RBAC Runtime: Customer receives NO profit_margin action card');

  // =========================================================================
  // GROUP 5: CUSTOMER ON /ADMIN ROUTE (RBAC Bypass Prevention)
  // =========================================================================
  console.log('\n📌 GROUP 5: Customer on /admin Route (Strict Role vs Route Verification)');

  const cOnAdmin1 = resolveMultiIntent('Đơn nào đang chờ bàn giao?', ctxCustomerOnAdminRoute);
  assert(cOnAdmin1.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'RBAC Route Bypass: Customer on /admin cannot trigger ADMIN_PENDING_HANDOVER');

  const cOnAdmin2 = resolveMultiIntent('Báo cáo doanh thu hôm nay', ctxCustomerOnAdminRoute);
  assert(cOnAdmin2.primaryIntent !== 'ADMIN_REVENUE_REPORT', 'RBAC Route Bypass: Customer on /admin cannot trigger ADMIN_REVENUE_REPORT');

  const rCustOnAdmin = await processAgentMessageV2('Đơn nào đang chờ bàn giao?', ctxCustomerOnAdminRoute);
  assert(rCustOnAdmin.data?.type !== 'pending_fulfillment', 'RBAC Route Bypass: Customer on /admin receives NO pending_fulfillment action card');

  // =========================================================================
  // GROUP 6: ACTION CARD CONTRACT INTEGRITY
  // =========================================================================
  console.log('\n📌 GROUP 6: Action Card Contract Integrity (Non-null, Structured)');

  const cardsToVerify = [
    { res: r7_1, type: 'pending_fulfillment', key: 'pendingQueue' },
    { res: r7_2, type: 'daily_summary', key: 'summary' },
    { res: r7_3, type: 'task_prioritization', key: 'tasks' },
    { res: r7_4, type: 'order_lookup', key: 'order' },
    { res: r7_5, type: 'customer_lookup', key: 'customer' },
    { res: r7_6, type: 'sales_report', key: 'report' },
    { res: r7_7, type: 'profit_margin', key: 'profitReport' },
    { r_res: r7_8, type: 'shop_voucher', key: 'voucher' },
    { res: r7_9, type: 'order_dispute', key: 'dispute' },
    { res: r7_10, type: 'order_handover', key: 'handover' },
  ];

  for (const card of cardsToVerify) {
    const target = card.res || card.r_res;
    assert(target.data !== null && target.data !== undefined, `Contract: ${card.type} data is NOT null`);
    assert(target.data?.type === card.type, `Contract: ${card.type} has exact type match`);
    assert(target.data?.[card.key] !== undefined, `Contract: ${card.type} contains payload key "${card.key}"`);
    assert(Array.isArray(target.suggestions), `Contract: ${card.type} returns valid suggestions array`);
  }

  // =========================================================================
  // GROUP 7: ERROR HANDLING & ROBUSTNESS
  // =========================================================================
  console.log('\n📌 GROUP 7: Error Handling & Graceful Degradation');

  // Empty query
  const emptyRes = await processAgentMessageV2('', ctxCustomerOnHomepage);
  assert(emptyRes !== null && (emptyRes.content !== undefined || emptyRes.text !== undefined), 
    'Robustness: Empty string handled gracefully');

  // Gibberish / unknown query
  const gibberishRes = await processAgentMessageV2('asdjklqwerty!@#$$%', ctxCustomerOnHomepage);
  assert(gibberishRes !== null && !gibberishRes.data?.type?.startsWith('admin_'), 
    'Robustness: Gibberish does not crash or trigger admin cards');

  // Order lookup with invalid/unknown format
  const unknownOrderRes = await processAgentMessageV2('Kiểm tra đơn #BOW-UNKNOWN-0000', ctxAdminOnDashboard);
  assert(unknownOrderRes !== null && unknownOrderRes.data !== undefined, 
    'Robustness: Unknown order ID handled gracefully without crash');

  // Customer lookup with missing name
  const missingCustRes = await processAgentMessageV2('Kiểm tra khách hàng', ctxAdminOnDashboard);
  assert(missingCustRes !== null, 'Robustness: General customer lookup query handled gracefully');

  // Secrets check: no service_role or API keys in response text
  const allResponses = [r7_1, r7_2, r7_3, r7_4, r7_5, r7_6, r7_7, r7_8, r7_9, r7_10];
  let secretLeaked = false;
  for (const r of allResponses) {
    const str = JSON.stringify(r);
    if (str.includes('service_role') || str.includes('AIzaSy') || str.includes('sbp_')) {
      secretLeaked = true;
    }
  }
  assert(!secretLeaked, 'Security: No sensitive credentials or service_role leaked in responses');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n========================================================================');
  console.log(`🎉 PHASE 10 E2E CERTIFICATION RESULTS:`);
  console.log(`   TOTAL TESTS: ${passed + failed}`);
  console.log(`   PASSED:      ${passed}`);
  console.log(`   FAILED:      ${failed}`);
  if (failures.length > 0) {
    console.log(`   FAILURES:    ${failures.join(', ')}`);
  }
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10Certification().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
