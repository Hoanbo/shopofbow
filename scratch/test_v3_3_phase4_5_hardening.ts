// scratch/test_v3_3_phase4_5_hardening.ts
// BOW Agent V3.3 Phase 4.5 — Hardening & Verification Suite

import { processAgentMessageV2, isAmbiguousDemandQuery } from '../src/services/agent/agentEngine';
import { resolveMultiIntent, detectPluralDiscoveryIntent } from '../src/services/agent/intentResolver';
import { executeGeminiTool } from '../src/services/agent/gemini/geminiTools';
import { planSupportTicketAction, findRelevantWarrantyOrder } from '../src/services/agent/actionPlanner';
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
    console.error(`[FAIL] ${testName}${detail ? ` — Detail: ${detail}` : ''}`);
  }
}

async function runPhase45Suite() {
  console.log('================================================================');
  console.log('BOW AGENT V3.3 PHASE 4.5 — IMPLEMENTATION & HARDENING SUITE');
  console.log('================================================================\n');

  const guestContext: AgentContext = {
    userId: undefined,
    isAuthenticated: false,
    role: 'guest',
  };

  const authUserContext: AgentContext = {
    userId: 'test_user_p45',
    email: 'test_p45@example.com',
    fullName: 'Test User P45',
    isAuthenticated: true,
    role: 'user',
  };

  // -------------------------------------------------------------------------
  // 1. AMBIGUOUS EXACT PHRASE
  // -------------------------------------------------------------------------
  console.log('--- 1. Ambiguous Exact Phrases ---');
  assert(isAmbiguousDemandQuery('tôi muốn một app tốt'), '1.1 "tôi muốn một app tốt" is ambiguous');
  assert(isAmbiguousDemandQuery('tôi cần ai tốt'), '1.2 "tôi cần ai tốt" is ambiguous');
  assert(isAmbiguousDemandQuery('app nào hay'), '1.3 "app nào hay" is ambiguous');
  assert(isAmbiguousDemandQuery('tool nào tốt'), '1.4 "tool nào tốt" is ambiguous');

  const exactRes = await processAgentMessageV2('tôi muốn một app tốt', guestContext);
  assert(exactRes.content.includes('Bạn muốn dùng AI để làm việc gì cụ thể'), '1.5 Engine returns clarification for exact ambiguous');
  assert(exactRes.suggestions?.includes('🎬 Làm video AI'), '1.6 Clarification suggestions present');

  // -------------------------------------------------------------------------
  // 2. AMBIGUOUS PARAPHRASE
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Ambiguous Paraphrase ---');
  assert(isAmbiguousDemandQuery('cho tôi một app tốt'), '2.1 "cho tôi một app tốt" is ambiguous');
  assert(isAmbiguousDemandQuery('tìm cái gì hay hay'), '2.2 "tìm cái gì hay hay" is ambiguous');
  assert(isAmbiguousDemandQuery('gợi ý giúp tôi'), '2.3 "gợi ý giúp tôi" is ambiguous');
  assert(isAmbiguousDemandQuery('có gì tốt'), '2.4 "có gì tốt" is ambiguous');
  assert(isAmbiguousDemandQuery('recommend cho tôi'), '2.5 "recommend cho tôi" is ambiguous');

  const paraRes1 = await processAgentMessageV2('cho tôi một app tốt', guestContext);
  assert(paraRes1.content.includes('Bạn muốn dùng AI để làm việc gì cụ thể'), '2.6 Engine clarifies "cho tôi một app tốt"');

  const paraRes2 = await processAgentMessageV2('tìm cái gì hay hay', guestContext);
  assert(paraRes2.content.includes('Bạn muốn dùng AI để làm việc gì cụ thể'), '2.7 Engine clarifies "tìm cái gì hay hay"');

  // -------------------------------------------------------------------------
  // 3. VIETNAMESE ACCENTS & 4. NO ACCENTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3 & 4. Vietnamese Accents & No Accents ---');
  assert(isAmbiguousDemandQuery('toi muon mot app tot'), '3.1 "toi muon mot app tot" (no accent) is ambiguous');
  assert(isAmbiguousDemandQuery('cho toi mot app tot'), '3.2 "cho toi mot app tot" (no accent) is ambiguous');
  assert(isAmbiguousDemandQuery('tim cai gi hay hay'), '3.3 "tim cai gi hay hay" (no accent) is ambiguous');
  assert(isAmbiguousDemandQuery('co gi tot'), '3.4 "co gi tot" (no accent) is ambiguous');
  assert(isAmbiguousDemandQuery('goi y giup toi'), '3.5 "goi y giup toi" (no accent) is ambiguous');

  const noAccentRes = await processAgentMessageV2('cho toi mot app tot', guestContext);
  assert(noAccentRes.content.includes('Bạn muốn dùng AI để làm việc gì cụ thể'), '3.6 Engine clarifies no-accent ambiguous query');

  // -------------------------------------------------------------------------
  // 5. DOMAIN / PRODUCT SAFETY GUARDS (NOT AMBIGUOUS)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Domain & Specific Product Safety (Must NOT be Ambiguous) ---');
  assert(!isAmbiguousDemandQuery('app xem phim nào tốt?'), '5.1 "app xem phim nào tốt?" is NOT ambiguous');
  assert(!isAmbiguousDemandQuery('Netflix giá bao nhiêu?'), '5.2 "Netflix giá bao nhiêu?" is NOT ambiguous');
  assert(!isAmbiguousDemandQuery('có những app xem phim nào?'), '5.3 "có những app xem phim nào?" is NOT ambiguous');
  assert(!isAmbiguousDemandQuery('YouTube Premium có gói nào?'), '5.4 "YouTube Premium có gói nào?" is NOT ambiguous');
  assert(!isAmbiguousDemandQuery('tôi muốn mua Netflix'), '5.5 "tôi muốn mua Netflix" is NOT ambiguous');
  assert(!isAmbiguousDemandQuery('quản lý tàu vũ trụ'), '5.6 "quản lý tàu vũ trụ" is NOT ambiguous');
  assert(!isAmbiguousDemandQuery('shop có những sản phẩm gì?'), '5.7 "shop có những sản phẩm gì?" is NOT ambiguous');

  // -------------------------------------------------------------------------
  // 6. SINGLE PRODUCT BEHAVIOR
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Single Product Behavior ---');
  const singleRes = await processAgentMessageV2('Netflix giá bao nhiêu?', guestContext);
  assert(singleRes.data?.type === 'product', '6.1 "Netflix giá bao nhiêu?" returns product type');
  assert(singleRes.data?.product?.name.includes('Netflix'), '6.2 Product is Netflix');

  // -------------------------------------------------------------------------
  // 7. PLURAL DISCOVERY BEHAVIOR
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Plural Discovery Behavior ---');
  assert(detectPluralDiscoveryIntent('có những app xem phim nào?'), '7.1 "có những app xem phim nào?" detected as plural');
  assert(detectPluralDiscoveryIntent('xem phim thì có những app gì'), '7.2 "xem phim thì có những app gì" detected as plural');

  const pluralRes = await processAgentMessageV2('có những app xem phim nào?', guestContext);
  assert(pluralRes.data?.type === 'semantic_candidates', '7.3 Returns semantic_candidates');
  assert(Array.isArray(pluralRes.data?.candidates) && pluralRes.data.candidates.length > 1, '7.4 Returns plural product list');

  // -------------------------------------------------------------------------
  // 8. CATALOG OVERVIEW
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Catalog Overview ---');
  const catalogRes = await processAgentMessageV2('shop có những sản phẩm gì?', guestContext);
  assert(catalogRes.data?.type === 'catalog_overview', '8.1 "shop có những sản phẩm gì?" returns catalog_overview');

  // -------------------------------------------------------------------------
  // 9. UNSUPPORTED QUERY
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Unsupported Query ---');
  const unsuppRes = await processAgentMessageV2('quản lý tàu vũ trụ', guestContext);
  assert(unsuppRes.content.includes('chưa tìm thấy sản phẩm'), '9.1 "quản lý tàu vũ trụ" returns unsupported');
  assert(!unsuppRes.action, '9.2 No action card for unsupported query');

  // -------------------------------------------------------------------------
  // 10. PLAN DISCOVERY
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Plan Discovery ---');
  assert(!detectPluralDiscoveryIntent('Netflix có những gói nào?'), '10.1 "Netflix có những gói nào?" is plan discovery, not plural');
  const planRes = await processAgentMessageV2('Netflix có những gói nào?', guestContext);
  assert(planRes.data?.type === 'product', '10.2 Plan discovery returns single product');

  // -------------------------------------------------------------------------
  // 11. WARRANTY STATUS GUARDS & PARITY
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Warranty Status Guards & Parity ---');
  const eligibleOrder = {
    id: 'ord_completed_1',
    user_id: 'test_user_p45',
    product_name: 'Netflix Premium',
    payment_code: 'BOW-NETFLIX-01',
    status: 'completed',
    price: 260000,
  };

  const cancelledOrder = {
    id: 'ord_cancelled_1',
    user_id: 'test_user_p45',
    product_name: 'YouTube Premium',
    payment_code: 'BOW-YT-CANCELLED',
    status: 'cancelled',
    price: 280000,
  };

  const refundedOrder = {
    id: 'ord_refunded_1',
    user_id: 'test_user_p45',
    product_name: 'Spotify Premium',
    payment_code: 'BOW-SPOT-REFUNDED',
    status: 'refunded',
    price: 190000,
  };

  const pendingOrder = {
    id: 'ord_pending_1',
    user_id: 'test_user_p45',
    product_name: 'Canva Pro',
    payment_code: 'BOW-CANVA-PENDING',
    status: 'pending_payment',
    price: 150000,
  };

  // V2 validation tests
  const eligibleAct = planSupportTicketAction(eligibleOrder, 'Lỗi tài khoản', authUserContext);
  assert(eligibleAct !== null, '11.1 Eligible order returns action');
  assert(eligibleAct?.type === 'NAVIGATE_SUPPORT', '11.2 Action type is NAVIGATE_SUPPORT');
  assert(eligibleAct?.label === 'Gửi yêu cầu bảo hành', '11.3 Action label has no leading emoji');
  assert(eligibleAct?.icon === '🎫', '11.4 Action icon is 🎫');

  const cancelledAct = planSupportTicketAction(cancelledOrder, 'Lỗi', authUserContext);
  assert(cancelledAct === null, '11.5 Cancelled order strictly returns null');

  const refundedAct = planSupportTicketAction(refundedOrder, 'Lỗi', authUserContext);
  assert(refundedAct === null, '11.6 Refunded order strictly returns null');

  const pendingAct = planSupportTicketAction(pendingOrder, 'Lỗi', authUserContext);
  assert(pendingAct === null, '11.7 Pending payment order strictly returns null');

  // findRelevantWarrantyOrder helper
  const orderList = [eligibleOrder, cancelledOrder, refundedOrder, pendingOrder];
  const matchedByCode = findRelevantWarrantyOrder(orderList, 'bảo hành đơn BOW-YT-CANCELLED');
  assert(matchedByCode?.payment_code === 'BOW-YT-CANCELLED', '11.8 findRelevantWarrantyOrder matches code');

  const matchedByName = findRelevantWarrantyOrder(orderList, 'bảo hành Spotify');
  assert(matchedByName?.product_name === 'Spotify Premium', '11.9 findRelevantWarrantyOrder matches product name');

  // -------------------------------------------------------------------------
  // 12. GEMINI TOOL PARITY (request_order_warranty)
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Gemini Tool request_order_warranty Parity ---');
  const unauthGemini = await executeGeminiTool('request_order_warranty', {}, guestContext);
  assert(!unauthGemini.success, '12.1 Unauthenticated Gemini request_order_warranty rejected');
  assert(unauthGemini.data?.isAuthenticated === false, '12.2 Gemini reports isAuthenticated: false');

  const unauthWithCode = await executeGeminiTool('request_order_warranty', { paymentCode: 'BOW-TEST' }, guestContext);
  assert(!unauthWithCode.success, '12.3 Unauthenticated Gemini request with code rejected');

  // Test findRelevantWarrantyOrder with multiple candidates
  const orderListMulti = [
    { id: '1', payment_code: 'BOW-111', product_name: 'ChatGPT Plus', status: 'completed' },
    { id: '2', payment_code: 'BOW-222', product_name: 'Canva Pro', status: 'cancelled' },
  ];
  const foundChatGpt = findRelevantWarrantyOrder(orderListMulti, 'tôi muốn bảo hành ChatGPT');
  assert(foundChatGpt?.id === '1', '12.4 findRelevantWarrantyOrder finds ChatGPT');

  const foundCanva = findRelevantWarrantyOrder(orderListMulti, 'bảo hành đơn Canva');
  assert(foundCanva?.id === '2', '12.5 findRelevantWarrantyOrder finds Canva');
  const canvaAct = planSupportTicketAction(foundCanva, 'Lỗi', authUserContext);
  assert(canvaAct === null, '12.6 Cancelled Canva warranty action is strictly null');

  const chatGptAct = planSupportTicketAction(foundChatGpt, 'Lỗi', authUserContext);
  assert(chatGptAct !== null, '12.7 Completed ChatGPT warranty action created');
  assert(chatGptAct?.payload?.paymentCode === 'BOW-111', '12.8 Action paymentCode matches');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  if (failedTests === 0) {
    console.log('🎉 ALL PHASE 4.5 TESTS PASSED WITH ZERO ERRORS!');
  } else {
    console.error('❌ SOME TESTS FAILED');
  }
  console.log('================================================================\n');

  if (failedTests > 0) process.exit(1);
}

runPhase45Suite().catch((err) => {
  console.error('Phase 4.5 Suite Error:', err);
  process.exit(1);
});
