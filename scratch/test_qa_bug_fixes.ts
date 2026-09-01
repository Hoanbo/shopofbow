// scratch/test_qa_bug_fixes.ts
// Comprehensive validation script for QA Playwright bug fixes:
// 1. TC-AGENT-TOPIC-SWITCH-001 (Topic Switch State Contamination)
// 2. TC-AGENT-DURATION-001 (Multi-Month Duration Mismatch)
// 3. QA Adapter Export (validateAction vs validateAgentAction)

import {
  processAgentMessageV2,
  validateAction,
  validateAgentAction,
  extractDuration,
  matchPlanByDuration,
} from '../src/services/agent/agentEngine';
import {
  validateAction as validateActionDirect,
  validateAgentAction as validateAgentActionDirect,
} from '../src/services/agent/actionValidator';
import {
  getSessionContext,
  clearSessionContext,
} from '../src/services/agent/sessionContext';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (detail) console.error('Detail:', detail);
  }
}

console.log('===============================================================');
console.log('=== TEST SUITE 1: QA Adapter Exports (validateAction alias) ===');
console.log('===============================================================');

assert(typeof validateAction === 'function', '1.1 validateAction is exported from agentEngine');
assert(typeof validateAgentAction === 'function', '1.2 validateAgentAction is exported from agentEngine');
assert(validateAction === validateAgentAction, '1.3 validateAction and validateAgentAction are identical');
assert(typeof validateActionDirect === 'function', '1.4 validateAction is exported from actionValidator');
assert(typeof validateAgentActionDirect === 'function', '1.5 validateAgentAction is exported from actionValidator');

const sampleAction = {
  type: 'NAVIGATE_CHECKOUT' as const,
  label: 'Mua ngay',
  payload: { productId: 'prod-123', productSlug: 'test-slug' },
};
const mockCtx = { userId: 'u1', isAuthenticated: true, role: 'user' as const };
const validated = validateAction(sampleAction, mockCtx);
assert(!!validated && !!validated.id && validated.payload.productId === 'prod-123', '1.6 validateAction executes correctly');

console.log('\n===============================================================');
console.log('=== TEST SUITE 2: Regex Duration Extraction (Multi-Month)   ===');
console.log('===============================================================');

assert(extractDuration('Mua youtube 6 tháng') === '6 tháng', '2.1 Extract "6 tháng"');
assert(extractDuration('Mua youtube 6tháng') === '6 tháng', '2.2 Extract "6tháng" (no space)');
assert(extractDuration('mua youtube nửa năm') === '6 tháng', '2.3 Extract "nửa năm"');
assert(extractDuration('Mua youtube 12 tháng') === '1 năm', '2.4 Extract "12 tháng" -> "1 năm"');
assert(extractDuration('Mua youtube 1 năm') === '1 năm', '2.5 Extract "1 năm"');
assert(extractDuration('Mua youtube 1nam') === '1 năm', '2.6 Extract "1nam"');
assert(extractDuration('Mua netflix 3 tháng') === '3 tháng', '2.7 Extract "3 tháng"');
assert(extractDuration('Mua netflix 1 tháng') === '1 tháng', '2.8 Extract "1 tháng"');
assert(extractDuration('Mua chatgpt 1 tuần') === '1 tuần', '2.9 Extract "1 tuần"');
assert(extractDuration('Gói 100M token') === '100M Token', '2.10 Extract "100M token"');

console.log('\n===============================================================');
console.log('=== TEST SUITE 3: TC-AGENT-DURATION-001 (Multi-Month Match) ===');
console.log('===============================================================');

clearSessionContext();
const resBuy6M = await processAgentMessageV2('Mua youtube 6 tháng', mockCtx);

assert(resBuy6M.action?.type === 'NAVIGATE_CHECKOUT', '3.1 Returns NAVIGATE_CHECKOUT Action Card');
assert(resBuy6M.action?.payload?.productSlug === 'youtube-premium', '3.2 Product is YouTube Premium');
assert(resBuy6M.action?.payload?.planLabel === 'Slot 6 tháng', `3.3 Action Card matches "Slot 6 tháng" (got: ${resBuy6M.action?.payload?.planLabel})`);
assert(resBuy6M.action?.payload?.displayPrice === 280000, `3.4 Action Card price is 280.000đ (got: ${resBuy6M.action?.payload?.displayPrice})`);

const sessionAfter6M = getSessionContext();
assert(sessionAfter6M.productSlug === 'youtube-premium', '3.5 Session productSlug is youtube-premium');
assert(sessionAfter6M.lastMentionedPlan?.name === 'Slot 6 tháng', '3.6 Session lastMentionedPlan is Slot 6 tháng');
assert(sessionAfter6M.planContext?.name === 'Slot 6 tháng', '3.7 Session planContext is Slot 6 tháng');

console.log('\n===============================================================');
console.log('=== TEST SUITE 4: TC-AGENT-TOPIC-SWITCH-001 (State Isolation) ===');
console.log('===============================================================');

// User switches topic from YouTube 6 months to Netflix
const resSwitchNetflix = await processAgentMessageV2('Shop có Netflix không?', mockCtx);

const sessionAfterSwitch = getSessionContext();
assert(sessionAfterSwitch.productSlug === 'netflix-premium', `4.1 Session productSlug updated to netflix-premium (got: ${sessionAfterSwitch.productSlug})`);
assert(sessionAfterSwitch.lastMentionedProduct?.slug === 'netflix-premium', '4.2 lastMentionedProduct is Netflix Premium');
assert(sessionAfterSwitch.planContext === null || sessionAfterSwitch.planContext === undefined, `4.3 planContext IS RESET TO null (got: ${JSON.stringify(sessionAfterSwitch.planContext)})`);
assert(sessionAfterSwitch.lastMentionedPlan === undefined, `4.4 lastMentionedPlan IS CLEARED TO undefined (got: ${sessionAfterSwitch.lastMentionedPlan?.name})`);

// Ensure response for Netflix does NOT offer a single checkout action bound to YouTube 6-month plan
assert(resSwitchNetflix.action?.payload?.productSlug !== 'youtube-premium', '4.5 Action Card does not point to YouTube');
if (resSwitchNetflix.action) {
  assert(resSwitchNetflix.action.payload.planLabel !== 'Slot 6 tháng', '4.6 Action Card does not contaminate Netflix with YouTube 6 months');
}

console.log('\n===============================================================');
console.log('=== TEST SUITE 5: Topic Switch Follow-up Buy                ===');
console.log('===============================================================');

// User buys Netflix "Extra Member 1 tháng" (real plan in catalog)
const resBuyNetflix = await processAgentMessageV2('Lấy gói Netflix Extra Member 1 tháng', mockCtx);
assert(resBuyNetflix.action?.type === 'NAVIGATE_CHECKOUT', '5.1 Returns NAVIGATE_CHECKOUT for Netflix Extra Member');
assert(resBuyNetflix.action?.payload?.productSlug === 'netflix-premium', '5.2 Action is for Netflix Premium');
assert(resBuyNetflix.action?.payload?.planLabel === 'Extra Member 1 tháng', `5.3 Action plan is Extra Member 1 tháng (got: ${resBuyNetflix.action?.payload?.planLabel})`);

const sessionAfterNetflix = getSessionContext();
assert(sessionAfterNetflix.productSlug === 'netflix-premium', '5.4 Session productSlug is netflix-premium');
assert(sessionAfterNetflix.planContext?.name === 'Extra Member 1 tháng', '5.5 Session planContext is Extra Member 1 tháng');

// Now user switches back to YouTube 1 year ("1 năm" -> "Slot 12 tháng")
const resBuyYT1Y = await processAgentMessageV2('Mua youtube 1 năm', mockCtx);
assert(resBuyYT1Y.action?.type === 'NAVIGATE_CHECKOUT', '5.6 Returns NAVIGATE_CHECKOUT for YouTube 1 year');
assert(resBuyYT1Y.action?.payload?.productSlug === 'youtube-premium', '5.7 Action is for YouTube Premium');
assert(resBuyYT1Y.action?.payload?.planLabel === 'Slot 12 tháng', `5.8 Action plan matched Slot 12 tháng (got: ${resBuyYT1Y.action?.payload?.planLabel})`);
assert(resBuyYT1Y.action?.payload?.displayPrice === 450000, `5.9 Action price is 450.000đ (got: ${resBuyYT1Y.action?.payload?.displayPrice})`);

const sessionAfterYT1Y = getSessionContext();
assert(sessionAfterYT1Y.productSlug === 'youtube-premium', '5.10 Session productSlug updated back to youtube-premium');
assert(sessionAfterYT1Y.planContext?.name === 'Slot 12 tháng', '5.11 Session planContext updated to Slot 12 tháng');

console.log('\n===============================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('===============================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL QA ADAPTER & REGRESSION ASSERTIONS PASSED WITH ZERO ERRORS!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!');
  process.exit(1);
}
