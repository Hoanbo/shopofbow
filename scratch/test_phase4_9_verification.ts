import { extractDuration, matchPlanByDuration } from '../src/services/agent/intentResolver';
import { processAgentMessageV2 } from '../src/services/agent/agentEngine';
import type { AgentContext, PlanItemResult } from '../src/services/agent/types';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${msg}`);
  }
}

async function runPhase49Verification() {
  console.log('================================================================');
  console.log('PHASE 4.9 DEDICATED DEFECT FIX & CONTRACT VERIFICATION SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // 1. BUG-48-002: DIRECT extractDuration() CANONICAL OUTPUT TESTS
  // --------------------------------------------------------------------------
  console.log('--- 1. extractDuration() Canonical Form Tests ---');

  // 6 tháng variants
  const sixMonthVariants = [
    '6 tháng', '6 thang', '6tháng', '6thang', '6 t', '6t',
    'nửa năm', 'nua nam', '180 ngày', '180 ngay'
  ];
  for (const v of sixMonthVariants) {
    assert(extractDuration(`Mua YouTube ${v}`) === '6 tháng', `6m variant: "${v}" -> "6 tháng"`);
  }

  // 12 tháng / 1 năm variants
  const twelveMonthVariants = [
    '12 tháng', '12 thang', '12 t', '12t', '1 năm', '1 nam',
    '1n', 'cả năm', 'ca nam', '365 ngày', '365 ngay'
  ];
  for (const v of twelveMonthVariants) {
    assert(extractDuration(`Mua YouTube ${v}`) === '1 năm', `12m/1y variant: "${v}" -> "1 năm"`);
  }

  // 3 tháng variants
  const threeMonthVariants = [
    '3 tháng', '3 thang', '3 t', '3t', '1 quý', '1 quy', '90 ngày', '90 ngay'
  ];
  for (const v of threeMonthVariants) {
    assert(extractDuration(`Mua YouTube ${v}`) === '3 tháng', `3m variant: "${v}" -> "3 tháng"`);
  }

  // 1 tháng variants
  const oneMonthVariants = [
    '1 tháng', '1 thang', '1 t', '1t', '30 ngày', '30 ngay'
  ];
  for (const v of oneMonthVariants) {
    assert(extractDuration(`Mua YouTube ${v}`) === '1 tháng', `1m variant: "${v}" -> "1 tháng"`);
  }

  // --------------------------------------------------------------------------
  // 2. matchPlanByDuration() CONTRACT TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. matchPlanByDuration() Multi-Representation Matching ---');
  const mockPlans: PlanItemResult[] = [
    { id: 'p-1m', name: 'Slot 1 tháng', duration: '1 tháng', price: 35000 },
    { id: 'p-3m', name: 'Slot 3 tháng', duration: '3 tháng', price: 105000 },
    { id: 'p-6m', name: 'Slot 6 tháng', duration: '6 tháng', price: 280000 },
    { id: 'p-12m', name: 'Slot 12 tháng', duration: '1 năm', price: 450000 },
  ];

  const matched6m = matchPlanByDuration(mockPlans, '6 tháng');
  assert(matched6m?.id === 'p-6m' && matched6m.price === 280000, 'matchPlanByDuration("6 tháng") -> Slot 6 tháng (280.000đ)');

  const matched6mSpaced = matchPlanByDuration(mockPlans, '6 t');
  assert(matched6mSpaced?.id === 'p-6m', 'matchPlanByDuration("6 t") -> Slot 6 tháng');

  const matched1y = matchPlanByDuration(mockPlans, '1 năm');
  assert(matched1y?.id === 'p-12m' && matched1y.price === 450000, 'matchPlanByDuration("1 năm") -> Slot 12 tháng (450.000đ)');

  const matched3m = matchPlanByDuration(mockPlans, '3 tháng');
  assert(matched3m?.id === 'p-3m', 'matchPlanByDuration("3 tháng") -> Slot 3 tháng');

  const matched1m = matchPlanByDuration(mockPlans, '1 tháng');
  assert(matched1m?.id === 'p-1m', 'matchPlanByDuration("1 tháng") -> Slot 1 tháng');

  // --------------------------------------------------------------------------
  // 3. RUNTIME BUY INTENT INTEGRATION: "Mua YouTube 6 tháng"
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Runtime Engine Buy Intent: "Mua YouTube 6 tháng" ---');
  const guestContext: AgentContext = {
    isAuthenticated: false,
    role: 'guest',
  };

  const resBuy6m = await processAgentMessageV2('Mua YouTube 6 tháng', guestContext);
  assert(resBuy6m.action !== undefined, '3.1 Action generated for "Mua YouTube 6 tháng"');
  assert(resBuy6m.action?.type === 'NAVIGATE_CHECKOUT', '3.2 Action is NAVIGATE_CHECKOUT');
  assert(resBuy6m.action?.payload?.planLabel === 'Slot 6 tháng', '3.3 Plan is strictly "Slot 6 tháng" (NEVER 1 month)');
  assert(resBuy6m.action?.payload?.displayPrice === 280000, '3.4 Price is 280.000đ (NOT 35.000đ)');

  // --------------------------------------------------------------------------
  // 4. CRITICAL BEHAVIORS REMAIN UNCHANGED
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Critical Behaviors Invariant Checks ---');

  // 4.1 Discovery: "Có app nào xem phim không?"
  const resDisc = await processAgentMessageV2('Có app nào xem phim không?', guestContext);
  assert(resDisc.data?.type === 'semantic_candidates', '4.1 Discovery returns semantic_candidates');
  assert((resDisc.data?.candidates?.length || 0) >= 2, '4.1b Discovery contains >= 2 movie apps');

  // 4.2 Single Product: "Netflix giá bao nhiêu?"
  const resSingle = await processAgentMessageV2('Netflix giá bao nhiêu?', guestContext);
  assert(resSingle.data?.type === 'product', '4.2 Single product returns product type');
  assert(resSingle.data?.product?.name?.includes('Netflix'), '4.2b Product is Netflix');

  // 4.3 Plan Discovery: "Netflix có những gói nào?"
  const resPlanDisc = await processAgentMessageV2('Netflix có những gói nào?', guestContext);
  assert(resPlanDisc.actions !== undefined && resPlanDisc.actions.length > 1, '4.3 Plan discovery provides multiple choice actions');
  assert(resPlanDisc.action === undefined, '4.3b No auto-checkout on plan discovery');

  // 4.4 Catalog Overview: "Shop có những sản phẩm gì?"
  const resCatalog = await processAgentMessageV2('Shop có những sản phẩm gì?', guestContext);
  assert(resCatalog.data?.type === 'catalog_overview', '4.4 Shop overview returns catalog_overview');

  // 4.5 Unsupported: "Quản lý tàu vũ trụ"
  const resUnsup = await processAgentMessageV2('Quản lý tàu vũ trụ', guestContext);
  assert(resUnsup.action === undefined, '4.5 Unsupported returns no buy actions');
  assert(resUnsup.data?.candidates === undefined || resUnsup.data?.candidates?.length === 0, '4.5b No fake products hallucinated');

  // 4.6 Warranty: "Bảo hành"
  const authContext: AgentContext = {
    userId: '11111111-2222-3333-4444-555555555555',
    isAuthenticated: true,
    role: 'user',
  };
  const resWarr = await processAgentMessageV2('Bảo hành', authContext);
  assert(resWarr.content.includes('bảo hành') || resWarr.action?.type === 'NAVIGATE_SUPPORT', '4.6 Warranty flow initiated correctly');

  console.log('\n================================================================');
  console.log(`TOTAL PHASE 4.9 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runPhase49Verification().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
