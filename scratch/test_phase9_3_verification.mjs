// scratch/test_phase9_3_verification.mjs
// Phase 9.3 Verification Suite: Surface Separation, Routing & Admin Copilot Capability Expansion

import { resolveMultiIntent } from '../node_modules/@bow/agent/dist/index.js';
import { processAgentMessageV2 } from '../node_modules/@bow/agent/dist/core/agentEngine.js';

console.log('========================================================================');
console.log('🧪 BOW AGENT V4.0 — PHASE 9.3 COMPREHENSIVE VERIFICATION SUITE');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: SURFACE SEPARATION & ISOLATION (Case A, B, C, D)
// -----------------------------------------------------------------------------
console.log('📌 SECTION 1: Surface Separation & RBAC Isolation:');

const adminCustomerSurfaceCtx = {
  role: 'admin',
  surface: 'customer',
  route: '/',
  isAuthenticated: true,
  userId: 'admin_1',
};

const adminAdminSurfaceCtx = {
  role: 'admin',
  surface: 'admin',
  route: '/admin',
  isAuthenticated: true,
  userId: 'admin_1',
};

const customerCustomerSurfaceCtx = {
  role: 'customer',
  surface: 'customer',
  route: '/',
  isAuthenticated: true,
  userId: 'cust_1',
};

const customerAdminSurfaceCtx = {
  role: 'customer',
  surface: 'admin',
  route: '/admin',
  isAuthenticated: true,
  userId: 'cust_1',
};

// Case A: Admin at Homepage (surface: 'customer') -> User Agent experience
const caseA_Greeting = resolveMultiIntent('chào shop', adminCustomerSurfaceCtx);
assert(caseA_Greeting.primaryIntent === 'GREETING', 'Case A: Admin on homepage "chào shop" -> GREETING');

const caseA_Buy = resolveMultiIntent('Mua Canva Pro 1 năm', adminCustomerSurfaceCtx);
assert(caseA_Buy.primaryIntent === 'BUY', 'Case A: Admin on homepage "Mua Canva Pro 1 năm" -> BUY');

const caseA_AdminQuery = resolveMultiIntent('⏳ Đơn nào đang chờ bàn giao?', adminCustomerSurfaceCtx);
assert(caseA_AdminQuery.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'Case A: Admin on homepage asks admin question -> Routes to Customer flow, NOT Admin Intent');

// Case B: Admin at Admin Dashboard (surface: 'admin') -> Admin AI Copilot
const caseB_Pending = resolveMultiIntent('⏳ Đơn nào đang chờ bàn giao?', adminAdminSurfaceCtx);
assert(caseB_Pending.primaryIntent === 'ADMIN_PENDING_HANDOVER', 'Case B: Admin on dashboard "⏳ Đơn nào đang chờ bàn giao?" -> ADMIN_PENDING_HANDOVER');

const caseB_Revenue = resolveMultiIntent('📈 Báo cáo doanh thu & lợi nhuận hôm nay', adminAdminSurfaceCtx);
assert(caseB_Revenue.primaryIntent === 'ADMIN_REVENUE_REPORT', 'Case B: Admin on dashboard "📈 Báo cáo doanh thu & lợi nhuận hôm nay" -> ADMIN_REVENUE_REPORT');

// Case C: Customer at Homepage (surface: 'customer') -> User Agent only
const caseC_Buy = resolveMultiIntent('Mua CapCut 1 năm', customerCustomerSurfaceCtx);
assert(caseC_Buy.primaryIntent === 'BUY', 'Case C: Customer on homepage "Mua CapCut 1 năm" -> BUY');

const caseC_AdminQ = resolveMultiIntent('⏳ Đơn nào đang chờ bàn giao?', customerCustomerSurfaceCtx);
assert(caseC_AdminQ.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'Case C: Customer on homepage typing admin query -> Cannot trigger Admin Intent');

// Case D: Customer attempting Admin Surface -> RBAC Isolation
const caseD_AdminQ = resolveMultiIntent('⏳ Đơn nào đang chờ bàn giao?', customerAdminSurfaceCtx);
assert(caseD_AdminQ.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'Case D: Customer on admin route -> Cannot trigger Admin Intent (role !== admin)');

// -----------------------------------------------------------------------------
// SECTION 2: EXPANDED ADMIN COPILOT INTENT CLASSIFICATION
// -----------------------------------------------------------------------------
console.log('\n📌 SECTION 2: Expanded Admin Copilot Capabilities Classification:');

// 1. Order Lookup
const intentOrderLookup1 = resolveMultiIntent('Kiểm tra đơn #BOW-ORD-8812', adminAdminSurfaceCtx);
assert(intentOrderLookup1.primaryIntent === 'ADMIN_ORDER_LOOKUP', 'Admin query "Kiểm tra đơn #BOW-ORD-8812" -> ADMIN_ORDER_LOOKUP');

const intentOrderLookup2 = resolveMultiIntent('Đơn này đã bàn giao chưa?', adminAdminSurfaceCtx);
assert(intentOrderLookup2.primaryIntent === 'ADMIN_ORDER_LOOKUP', 'Admin query "Đơn này đã bàn giao chưa?" -> ADMIN_ORDER_LOOKUP');

// 2. Daily Operational Summary
const intentDailySummary = resolveMultiIntent('Hôm nay shop có gì cần tôi xử lý?', adminAdminSurfaceCtx);
assert(intentDailySummary.primaryIntent === 'ADMIN_DAILY_SUMMARY', 'Admin query "Hôm nay shop có gì cần tôi xử lý?" -> ADMIN_DAILY_SUMMARY');

// 3. Task Prioritization
const intentTaskPriority = resolveMultiIntent('Hôm nay tôi nên xử lý gì trước?', adminAdminSurfaceCtx);
assert(intentTaskPriority.primaryIntent === 'ADMIN_TASK_PRIORITIZATION', 'Admin query "Hôm nay tôi nên xử lý gì trước?" -> ADMIN_TASK_PRIORITIZATION');

// 4. Customer Lookup
const intentCustomerLookup = resolveMultiIntent('Kiểm tra khách hàng Trần Minh Đức', adminAdminSurfaceCtx);
assert(intentCustomerLookup.primaryIntent === 'ADMIN_CUSTOMER_LOOKUP', 'Admin query "Kiểm tra khách hàng Trần Minh Đức" -> ADMIN_CUSTOMER_LOOKUP');

// 5. Sales Analytics
const intentSalesAnalytics = resolveMultiIntent('Sản phẩm nào bán chạy nhất hôm nay?', adminAdminSurfaceCtx);
assert(intentSalesAnalytics.primaryIntent === 'ADMIN_SALES_ANALYTICS', 'Admin query "Sản phẩm nào bán chạy nhất hôm nay?" -> ADMIN_SALES_ANALYTICS');

// 6. Voucher Creation & List
const intentVoucherCreate = resolveMultiIntent('Tạo voucher giảm 20% cho khách', adminAdminSurfaceCtx);
assert(intentVoucherCreate.primaryIntent === 'ADMIN_VOUCHER_CREATE', 'Admin query "Tạo voucher giảm 20% cho khách" -> ADMIN_VOUCHER_CREATE');

// 7. Dispute & Warranty Inspection
const intentDispute = resolveMultiIntent('Kiểm tra khiếu nại đơn #BOW-ORD-9921', adminAdminSurfaceCtx);
assert(intentDispute.primaryIntent === 'ADMIN_DISPUTE_INSPECT', 'Admin query "Kiểm tra khiếu nại đơn #BOW-ORD-9921" -> ADMIN_DISPUTE_INSPECT');

// 8. Order Handover
const intentHandover = resolveMultiIntent('Bàn giao tài khoản cho đơn BOW-ORD-8812', adminAdminSurfaceCtx);
assert(intentHandover.primaryIntent === 'ADMIN_ORDER_HANDOVER', 'Admin query "Bàn giao tài khoản cho đơn BOW-ORD-8812" -> ADMIN_ORDER_HANDOVER');

// -----------------------------------------------------------------------------
// SECTION 3: RUNTIME ENGINE & ACTION CARD CONTRACT EXECUTION
// -----------------------------------------------------------------------------
console.log('\n📌 SECTION 3: Runtime Execution & Action Card Contract Verification:');

async function runRuntimeTests() {
  // Test 1: Daily Summary Action Card
  const resSummary = await processAgentMessageV2('Hôm nay shop có gì cần tôi xử lý?', adminAdminSurfaceCtx);
  assert(resSummary.data?.type === 'daily_summary', 'Daily summary runtime returns data.type = "daily_summary"');
  assert(resSummary.data?.summary?.pendingHandoverCount >= 0, 'Daily summary contains pendingHandoverCount');
  assert(Array.isArray(resSummary.suggestions) && resSummary.suggestions.length > 0, 'Daily summary provides suggestions');

  // Test 2: Task Prioritization Action Card
  const resTasks = await processAgentMessageV2('Hôm nay tôi nên xử lý gì trước?', adminAdminSurfaceCtx);
  assert(resTasks.data?.type === 'task_prioritization', 'Task priority runtime returns data.type = "task_prioritization"');
  assert(Array.isArray(resTasks.data?.tasks?.tasks), 'Task priority data contains tasks list array');

  // Test 3: Order Lookup Action Card
  const resLookup = await processAgentMessageV2('Kiểm tra đơn #BOW-ORD-8812', adminAdminSurfaceCtx);
  assert(resLookup.data?.type === 'order_lookup', 'Order lookup runtime returns data.type = "order_lookup"');
  assert(resLookup.data?.order?.orderId !== undefined, 'Order lookup data contains orderId');
  assert(Array.isArray(resLookup.data?.order?.timeline), 'Order lookup data contains timeline array');

  // Test 4: Customer Lookup Action Card
  const resCust = await processAgentMessageV2('Kiểm tra khách hàng Trần Minh Đức', adminAdminSurfaceCtx);
  assert(resCust.data?.type === 'customer_lookup', 'Customer lookup runtime returns data.type = "customer_lookup"');
  assert(resCust.data?.customer?.customerName !== undefined, 'Customer lookup data contains customerName');

  // Test 5: Sales Analytics Action Card
  const resSales = await processAgentMessageV2('Sản phẩm nào bán chạy nhất hôm nay?', adminAdminSurfaceCtx);
  assert(resSales.data?.type === 'sales_report', 'Sales analytics runtime returns data.type = "sales_report"');
  assert(Array.isArray(resSales.data?.report?.topProducts), 'Sales report contains topProducts array');

  // Test 6: Pending Fulfillment Queue Action Card
  const resQueue = await processAgentMessageV2('⏳ Đơn nào đang chờ bàn giao?', adminAdminSurfaceCtx);
  assert(resQueue.data?.type === 'pending_fulfillment', 'Pending queue runtime returns data.type = "pending_fulfillment"');
  assert(resQueue.data?.pendingQueue?.totalPendingCount >= 0, 'Pending queue contains totalPendingCount');

  // Test 7: Profit Margin Action Card
  const resProfit = await processAgentMessageV2('📈 Báo cáo doanh thu & lợi nhuận hôm nay', adminAdminSurfaceCtx);
  assert(resProfit.data?.type === 'profit_margin', 'Profit margin runtime returns data.type = "profit_margin"');
  assert(resProfit.data?.profitReport?.netProfit !== undefined, 'Profit report contains netProfit');

  // Test 8: Voucher List / Creation Action Card
  const resVoucher = await processAgentMessageV2('🎟️ Tạo voucher giảm 20%', adminAdminSurfaceCtx);
  assert(resVoucher.data?.type === 'shop_voucher', 'Voucher creation runtime returns data.type = "shop_voucher"');
  assert(resVoucher.data?.voucher?.code !== undefined, 'Voucher contains generated code');

  // Test 9: Dispute Inspection Action Card
  const resDispute = await processAgentMessageV2('🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921', adminAdminSurfaceCtx);
  assert(resDispute.data?.type === 'order_dispute', 'Dispute inspection runtime returns data.type = "order_dispute"');
  assert(resDispute.data?.dispute?.issueReported !== undefined, 'Dispute data contains issueReported');

  console.log('\n========================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRuntimeTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
