// scratch/test_phase9_2_verification.mjs
import { resolveMultiIntent } from '../node_modules/@bow/agent/dist/index.js';
import { processAgentMessageV2 } from '../node_modules/@bow/agent/dist/core/agentEngine.js';

console.log('========================================================================');
console.log('🧪 BOW AGENT V4.0 — PHASE 9.2 ROOT CAUSE FIX VERIFICATION');
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
// 1. INTENT ROUTING VERIFICATION
// -----------------------------------------------------------------------------
console.log('📌 1. Admin Intent Classification:');

const adminCtx = { role: 'admin', isAuthenticated: true, userId: 'admin_1' };
const custCtx = { role: 'customer', isAuthenticated: true, userId: 'cust_1' };

// Scenario 1: Pending Handover
const intent1 = resolveMultiIntent('⏳ Đơn nào đang chờ bàn giao?', adminCtx);
assert(intent1.primaryIntent === 'ADMIN_PENDING_HANDOVER', 'Admin query "⏳ Đơn nào đang chờ bàn giao?" -> ADMIN_PENDING_HANDOVER');

// Scenario 2: Revenue & Profit
const intent2 = resolveMultiIntent('📈 Báo cáo doanh thu & lợi nhuận hôm nay', adminCtx);
assert(intent2.primaryIntent === 'ADMIN_REVENUE_REPORT', 'Admin query "📈 Báo cáo doanh thu & lợi nhuận hôm nay" -> ADMIN_REVENUE_REPORT');

// Scenario 3: Voucher Creation
const intent3 = resolveMultiIntent('🎟️ Tạo voucher giảm 20% cho khách', adminCtx);
assert(intent3.primaryIntent === 'ADMIN_VOUCHER_CREATE', 'Admin query "🎟️ Tạo voucher giảm 20% cho khách" -> ADMIN_VOUCHER_CREATE');

// Scenario 4: Dispute Inspection
const intent4 = resolveMultiIntent('🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921', adminCtx);
assert(intent4.primaryIntent === 'ADMIN_DISPUTE_INSPECT', 'Admin query "🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921" -> ADMIN_DISPUTE_INSPECT');

// Admin purchasing (Should NOT be admin intent!)
const intentAdminBuy = resolveMultiIntent('Mua YouTube Premium 6 tháng', adminCtx);
assert(intentAdminBuy.primaryIntent === 'BUY', 'Admin purchasing "Mua YouTube Premium 6 tháng" -> BUY intent preserved');

// Customer purchasing (Should be BUY!)
const intentCustBuy = resolveMultiIntent('Mua CapCut Pro 1 năm', custCtx);
assert(intentCustBuy.primaryIntent === 'BUY', 'Customer query "Mua CapCut Pro 1 năm" -> BUY intent');

// Customer querying admin question
const intentCustAdminQ = resolveMultiIntent('⏳ Đơn nào đang chờ bàn giao?', custCtx);
assert(intentCustAdminQ.primaryIntent !== 'ADMIN_PENDING_HANDOVER', 'Customer cannot trigger ADMIN_PENDING_HANDOVER');

// -----------------------------------------------------------------------------
// 2. RUNTIME ENGINE EXECUTION & ACTION CARD VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n📌 2. Runtime Execution & Action Card Mapping:');

async function testRuntime() {
  // Test Scenario 1 execution
  const res1 = await processAgentMessageV2('⏳ Đơn nào đang chờ bàn giao?', adminCtx);
  assert(res1 && res1.content.toLowerCase().includes('đơn hàng chờ bàn giao'), 'Scenario 1 Runtime response contains pending fulfillment queue summary');
  assert(res1.data && res1.data.type === 'pending_fulfillment', 'Scenario 1 responseData.type is "pending_fulfillment"');

  // Test Scenario 2 execution
  const res2 = await processAgentMessageV2('📈 Báo cáo doanh thu & lợi nhuận hôm nay', adminCtx);
  assert(res2 && (res2.content.includes('Lợi nhuận ròng') || res2.content.includes('Doanh thu')), 'Scenario 2 Runtime response contains profit/revenue details');
  assert(res2.data && res2.data.type === 'profit_margin', 'Scenario 2 responseData.type is "profit_margin"');

  // Test Scenario 3 execution
  const res3 = await processAgentMessageV2('🎟️ Tạo voucher giảm 20% cho khách', adminCtx);
  assert(res3 && (res3.content.includes('Voucher') || res3.content.includes('khuyến mãi')), 'Scenario 3 Runtime response contains voucher creation message');
  assert(res3.data && res3.data.type === 'shop_voucher', 'Scenario 3 responseData.type is "shop_voucher"');

  // Test Scenario 4 execution
  const res4 = await processAgentMessageV2('🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921', adminCtx);
  assert(res4 && (res4.content.includes('khiếu nại') || res4.content.includes('bảo hành')), 'Scenario 4 Runtime response contains dispute inspection message');
  assert(res4.data && res4.data.type === 'order_dispute', 'Scenario 4 responseData.type is "order_dispute"');

  console.log('\n========================================================================');
  console.log(`🏁 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

testRuntime().catch(e => {
  console.error('Runtime error:', e);
  process.exit(1);
});
