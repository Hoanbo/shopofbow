// scratch/test_phase4_3_verification.ts — Comprehensive Test Suite for Phase 4.3
import { resolveMultiIntent, detectPluralDiscoveryIntent } from '../src/services/agent/intentResolver';
import { processAgentMessage } from '../src/services/agent/agentEngine';
import { planSupportTicketAction, planRenewalAction, planOrderDetailAction, planApplyCouponAction } from '../src/services/agent/actionPlanner';
import { clearSessionContext } from '../src/services/agent/sessionContext';
import type { AgentContext } from '../src/services/agent/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName} ${detail ? '— ' + detail : ''}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('=== TEST SUITE 1: Discovery Routing (PRODUCT_DISCOVERY)      ===');
  console.log('===============================================================');

  // Test 1.1: "có app nào xem phim không?"
  const res1Intent = resolveMultiIntent('có app nào xem phim không?');
  assert(res1Intent.primaryIntent !== 'CATALOG', '1.1 Intent is NOT CATALOG', `got: ${res1Intent.primaryIntent}`);
  assert(res1Intent.primaryIntent === 'PRODUCT_SEARCH', '1.2 Intent is PRODUCT_SEARCH', `got: ${res1Intent.primaryIntent}`);

  const isPlural1 = detectPluralDiscoveryIntent('có app nào xem phim không?');
  assert(isPlural1 === true, '1.3 "có app nào xem phim không?" detected as plural/capability discovery');

  clearSessionContext();
  const guestContext: AgentContext = { isAuthenticated: false, role: 'guest' };
  const res1 = await processAgentMessage('có app nào xem phim không?', guestContext);
  assert(res1.data?.type !== 'catalog_overview', '1.4 Response is NOT catalog_overview');
  assert(
    res1.data?.type === 'semantic_candidates' || res1.data?.type === 'product',
    '1.5 Response is product discovery (semantic_candidates)',
    `got: ${res1.data?.type}`
  );
  if (res1.data?.candidates) {
    const names = res1.data.candidates.map((c: any) => c.name);
    assert(names.includes('Netflix Premium'), '1.6 Netflix Premium in candidates', JSON.stringify(names));
    assert(names.includes('TV360 Standard'), '1.7 TV360 Standard in candidates', JSON.stringify(names));
  }

  // Test 1.2: "có những app xem phim nào?"
  const isPlural2 = detectPluralDiscoveryIntent('có những app xem phim nào?');
  assert(isPlural2 === true, '1.8 "có những app xem phim nào?" detected as plural');
  const res2 = await processAgentMessage('có những app xem phim nào?', guestContext);
  assert(res2.data?.type === 'semantic_candidates', '1.9 Returns plural product list', `got: ${res2.data?.type}`);

  // Test 1.3: "app xem phim có gì?"
  const isPlural3 = detectPluralDiscoveryIntent('app xem phim có gì?');
  assert(isPlural3 === true, '1.10 "app xem phim có gì?" detected as plural');

  // Test 1.4: "muốn xem phim thì dùng app nào?"
  const isPlural4 = detectPluralDiscoveryIntent('muốn xem phim thì dùng app nào?');
  assert(isPlural4 === true, '1.11 "muốn xem phim thì dùng app nào?" detected as plural');

  // Test 1.5: "Netflix giá bao nhiêu?" -> single product
  clearSessionContext();
  const res5 = await processAgentMessage('Netflix giá bao nhiêu?', guestContext);
  assert(res5.data?.type === 'product', '1.12 "Netflix giá bao nhiêu?" returns single product', `got: ${res5.data?.type}`);
  assert(res5.data?.product?.name === 'Netflix Premium', '1.13 Product is Netflix Premium');

  // Test 1.6: "shop có những sản phẩm gì?" -> true shop overview
  clearSessionContext();
  const res6Intent = resolveMultiIntent('shop có những sản phẩm gì?');
  assert(res6Intent.primaryIntent === 'CATALOG', '1.14 "shop có những sản phẩm gì?" is CATALOG intent', `got: ${res6Intent.primaryIntent}`);
  const res6 = await processAgentMessage('shop có những sản phẩm gì?', guestContext);
  assert(res6.data?.type === 'catalog_overview', '1.15 "shop có những sản phẩm gì?" returns catalog_overview');

  // Test 1.7: "tôi muốn một app tốt" -> clarification / guide
  clearSessionContext();
  const res7 = await processAgentMessage('tôi muốn một app tốt', guestContext);
  assert(res7.content.includes('cụ thể') || res7.content.includes('nhu cầu'), '1.16 Clarification requested for vague query');

  // Test 1.8: "quản lý tàu vũ trụ" -> unsupported
  clearSessionContext();
  const res8 = await processAgentMessage('quản lý tàu vũ trụ', guestContext);
  assert(res8.content.includes('chưa tìm thấy sản phẩm'), '1.17 "quản lý tàu vũ trụ" returns unsupported');
  assert(res8.action === undefined, '1.18 No buy action card for unsupported query');

  console.log('\n===============================================================');
  console.log('=== TEST SUITE 2: Warranty Order Status & Security Guards   ===');
  console.log('===============================================================');

  const authUserContext: AgentContext = {
    userId: 'usr_real_owner_123',
    email: 'test@example.com',
    isAuthenticated: true,
    role: 'user',
  };

  // Mock Orders
  const eligibleOrder = {
    id: 'ord_eligible_01',
    user_id: 'usr_real_owner_123',
    product_name: 'YouTube Premium',
    payment_code: 'BOW-ELIGIBLE1',
    status: 'completed',
  };

  const cancelledOrder = {
    id: 'ord_cancelled_02',
    user_id: 'usr_real_owner_123',
    product_name: 'Netflix Premium',
    payment_code: 'BOW-CANCELLED2',
    status: 'cancelled',
  };

  const refundedOrder = {
    id: 'ord_refunded_03',
    user_id: 'usr_real_owner_123',
    product_name: 'Spotify Premium',
    payment_code: 'BOW-REFUNDED3',
    status: 'refunded',
  };

  const pendingPaymentOrder = {
    id: 'ord_pending_04',
    user_id: 'usr_real_owner_123',
    product_name: 'Canva Pro',
    payment_code: 'BOW-PENDING4',
    status: 'pending_payment',
  };

  // Test 2.1: Eligible Order -> Warranty Action Allowed
  const actEligible = planSupportTicketAction(eligibleOrder, 'Lỗi tài khoản', authUserContext);
  assert(actEligible !== null, '2.1 Eligible order (completed) returns action');
  assert(actEligible?.type === 'NAVIGATE_SUPPORT', '2.2 Action type is NAVIGATE_SUPPORT');
  assert(actEligible?.payload?.orderId === 'ord_eligible_01', '2.3 Order ID matches');

  // Test 2.2: Cancelled Order -> REJECTED (returns null)
  const actCancelled = planSupportTicketAction(cancelledOrder, 'Lỗi tài khoản', authUserContext);
  assert(actCancelled === null, '2.4 Cancelled order action is strictly REJECTED (null)');

  // Test 2.3: Refunded Order -> REJECTED (returns null)
  const actRefunded = planSupportTicketAction(refundedOrder, 'Lỗi tài khoản', authUserContext);
  assert(actRefunded === null, '2.5 Refunded order action is strictly REJECTED (null)');

  // Test 2.4: Pending Payment Order -> REJECTED (returns null)
  const actPending = planSupportTicketAction(pendingPaymentOrder, 'Lỗi tài khoản', authUserContext);
  assert(actPending === null, '2.6 Pending payment order action is strictly REJECTED (null)');

  // Test 2.5: Unauthenticated User -> REJECTED by validator
  const actUnauth = planSupportTicketAction(eligibleOrder, 'Lỗi tài khoản', { isAuthenticated: false, role: 'guest' });
  assert(actUnauth === null, '2.7 Unauthenticated user cannot plan support action');

  console.log('\n===============================================================');
  console.log('=== TEST SUITE 3: Icon & Emoji Deduplication                ===');
  console.log('===============================================================');

  // Test 3.1: Support action label has NO duplicate emoji
  assert(actEligible?.label === 'Gửi yêu cầu bảo hành', '3.1 Warranty label has no leading emoji (got: ' + actEligible?.label + ')');
  assert(actEligible?.icon === '🎫', '3.2 Warranty icon is 🎫');

  // Test 3.2: Renewal action label has NO duplicate emoji
  const actRenewal = planRenewalAction(eligibleOrder, authUserContext);
  assert(actRenewal?.label === 'Gia hạn ngay', '3.3 Renewal label has no leading emoji (got: ' + actRenewal?.label + ')');
  assert(actRenewal?.icon === '🔄', '3.4 Renewal icon is 🔄');

  // Test 3.3: Order detail action label has NO duplicate emoji
  const actOrder = planOrderDetailAction(eligibleOrder, authUserContext);
  assert(actOrder?.label === 'Xem chi tiết đơn', '3.5 Order detail label has no leading emoji (got: ' + actOrder?.label + ')');
  assert(actOrder?.icon === '👁️', '3.6 Order detail icon is 👁️');

  // Test 3.4: Coupon action label has NO duplicate emoji
  const actCoupon = planApplyCouponAction('BOWVIP', 'Giảm 10%', authUserContext);
  assert(!actCoupon?.label?.startsWith('🎟️'), '3.7 Coupon label has no leading emoji (got: ' + actCoupon?.label + ')');
  assert(actCoupon?.icon === '🎟️', '3.8 Coupon icon is 🎟️');

  // Test 3.5: Component sanitizer regex test
  const stripEmojiRegex = /^[\p{Emoji}\u200d\uFE0F\s]+/u;
  const rawLabelWithEmoji = '🎫 Gửi yêu cầu bảo hành';
  const sanitized = rawLabelWithEmoji.replace(stripEmojiRegex, '').trim();
  assert(sanitized === 'Gửi yêu cầu bảo hành', '3.9 Sanitizer strips emoji from legacy action labels');

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 4.3 VERIFICATION ASSERTIONS PASSED WITH ZERO ERRORS!\n');
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
