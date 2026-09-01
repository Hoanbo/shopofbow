// scratch/test_bug_001_duration.ts
// BUG-001 Hotfix Verification: Duration Parsing & Plan Selection with Vietnamese Encoding

import { processAgentMessageV2, extractDuration } from '../src/services/agent/agentEngine';
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
    console.error(`[FAIL] ${testName}${detail ? ` — Detail: ${detail}` : ''}`);
  }
}

async function runBug001Suite() {
  console.log('================================================================');
  console.log('BUG-001 HOTFIX VERIFICATION SUITE — DURATION & VIETNAMESE ENCODING');
  console.log('================================================================\n');

  const guestContext: AgentContext = {
    userId: undefined,
    isAuthenticated: false,
    role: 'guest',
  };

  // --------------------------------------------------------------------------
  // 1. 6-MONTH DURATION DETECTION (All variants)
  // --------------------------------------------------------------------------
  console.log('--- 1. 6-Month Duration Detection ---');
  assert(extractDuration('Mua YouTube 6 tháng') === '6 tháng', '1.1 "Mua YouTube 6 tháng"');
  assert(extractDuration('Mua YouTube 6 thang') === '6 tháng', '1.2 "Mua YouTube 6 thang"');
  assert(extractDuration('Mua YouTube 6tháng') === '6 tháng', '1.3 "Mua YouTube 6tháng"');
  assert(extractDuration('Mua YouTube 6thang') === '6 tháng', '1.4 "Mua YouTube 6thang"');
  assert(extractDuration('Mua YouTube 6 t') === '6 tháng', '1.5 "Mua YouTube 6 t"');
  assert(extractDuration('Mua YouTube 6t') === '6 tháng', '1.6 "Mua YouTube 6t"');
  assert(extractDuration('Mua YouTube nửa năm') === '6 tháng', '1.7 "Mua YouTube nửa năm"');
  assert(extractDuration('Mua YouTube nua nam') === '6 tháng', '1.8 "Mua YouTube nua nam"');
  assert(extractDuration('Mua YouTube 180 ngày') === '6 tháng', '1.9 "Mua YouTube 180 ngày"');
  assert(extractDuration('Mua YouTube 180 ngay') === '6 tháng', '1.10 "Mua YouTube 180 ngay"');

  // Decomposed Unicode (NFD) test: 'th' + 'a' + '\u0301' + 'ng' = 'tháng' in NFD
  const nfd6Thang = 'Mua YouTube 6 tha\u0301ng';
  assert(extractDuration(nfd6Thang) === '6 tháng', '1.11 Decomposed Unicode NFD "6 tha\\u0301ng"');

  // --------------------------------------------------------------------------
  // 2. 12-MONTH / 1-YEAR DURATION DETECTION (All variants)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. 12-Month / 1-Year Duration Detection ---');
  assert(extractDuration('Mua YouTube 12 tháng') === '1 năm', '2.1 "Mua YouTube 12 tháng"');
  assert(extractDuration('Mua YouTube 12 thang') === '1 năm', '2.2 "Mua YouTube 12 thang"');
  assert(extractDuration('Mua YouTube 12tháng') === '1 năm', '2.3 "Mua YouTube 12tháng"');
  assert(extractDuration('Mua YouTube 12thang') === '1 năm', '2.4 "Mua YouTube 12thang"');
  assert(extractDuration('Mua YouTube 1 năm') === '1 năm', '2.5 "Mua YouTube 1 năm"');
  assert(extractDuration('Mua YouTube 1 nam') === '1 năm', '2.6 "Mua YouTube 1 nam"');
  assert(extractDuration('Mua YouTube 1năm') === '1 năm', '2.7 "Mua YouTube 1năm"');
  assert(extractDuration('Mua YouTube 1nam') === '1 năm', '2.8 "Mua YouTube 1nam"');
  assert(extractDuration('Mua YouTube cả năm') === '1 năm', '2.9 "Mua YouTube cả năm"');
  assert(extractDuration('Mua YouTube ca nam') === '1 năm', '2.10 "Mua YouTube ca nam"');
  assert(extractDuration('Mua YouTube 365 ngày') === '1 năm', '2.11 "Mua YouTube 365 ngày"');
  assert(extractDuration('Mua YouTube 365 ngay') === '1 năm', '2.12 "Mua YouTube 365 ngay"');

  // --------------------------------------------------------------------------
  // 3. OTHER DURATIONS & NEGATIVE CASES
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Other Durations & Negatives ---');
  assert(extractDuration('Mua YouTube 1 tháng') === '1 tháng', '3.1 "Mua YouTube 1 tháng"');
  assert(extractDuration('Mua YouTube 3 tháng') === '3 tháng', '3.2 "Mua YouTube 3 tháng"');
  assert(extractDuration('Mua YouTube') === undefined, '3.3 "Mua YouTube" has undefined duration');
  assert(extractDuration('YouTube có những gói nào') === undefined, '3.4 "YouTube có những gói nào" has undefined duration');

  // --------------------------------------------------------------------------
  // 4. PLAN SELECTION IN ENGINE (Runtime Catalog Matching)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Plan Selection in Engine (YouTube) ---');
  
  // 4.1 Mua YouTube 6 tháng -> selects Slot 6 tháng (price: 280.000)
  clearSessionContext();
  const res6Thang = await processAgentMessageV2('Mua YouTube 6 tháng', guestContext);
  assert(res6Thang.data?.plan?.name === 'Slot 6 tháng', '4.1 Selects "Slot 6 tháng" for "Mua YouTube 6 tháng"');
  assert(res6Thang.data?.plan?.duration === '6 tháng', '4.2 Duration is "6 tháng"');
  assert(res6Thang.data?.plan?.price === 280000, '4.3 Price is 280.000đ (not 1-month 35.000đ)');
  assert(res6Thang.action?.payload?.planLabel === 'Slot 6 tháng', '4.4 Action card points to Slot 6 tháng');

  // 4.2 Mua YouTube 6 thang (no accent) -> selects Slot 6 tháng
  clearSessionContext();
  const res6ThangNoAccent = await processAgentMessageV2('Mua YouTube 6 thang', guestContext);
  assert(res6ThangNoAccent.data?.plan?.name === 'Slot 6 tháng', '4.5 Selects "Slot 6 tháng" for "Mua YouTube 6 thang"');

  // 4.3 Mua YouTube nửa năm -> selects Slot 6 tháng
  clearSessionContext();
  const resNuaNam = await processAgentMessageV2('Mua YouTube nửa năm', guestContext);
  assert(resNuaNam.data?.plan?.name === 'Slot 6 tháng', '4.6 Selects "Slot 6 tháng" for "Mua YouTube nửa năm"');

  // 4.4 Mua YouTube 12 tháng -> selects Slot 12 tháng (price: 450.000)
  clearSessionContext();
  const res12Thang = await processAgentMessageV2('Mua YouTube 12 tháng', guestContext);
  assert(res12Thang.data?.plan?.name === 'Slot 12 tháng', '4.7 Selects "Slot 12 tháng" for "Mua YouTube 12 tháng"');
  assert(res12Thang.data?.plan?.price === 450000, '4.8 Price is 450.000đ');

  // 4.5 Mua YouTube 1 tháng -> selects Slot 1 tháng
  clearSessionContext();
  const res1Thang = await processAgentMessageV2('Mua YouTube 1 tháng', guestContext);
  assert(res1Thang.data?.plan?.name === 'Slot 1 tháng', '4.9 Selects "Slot 1 tháng" for "Mua YouTube 1 tháng"');

  // 4.6 Mua YouTube 3 tháng -> selects Slot 3 tháng
  clearSessionContext();
  const res3Thang = await processAgentMessageV2('Mua YouTube 3 tháng', guestContext);
  assert(res3Thang.data?.plan?.name === 'Slot 3 tháng', '4.10 Selects "Slot 3 tháng" for "Mua YouTube 3 tháng"');

  // 4.7 Mua YouTube (no duration) -> prompts multiple plans, doesn't auto-pick
  clearSessionContext();
  const resNoDur = await processAgentMessageV2('Mua YouTube', guestContext);
  assert(resNoDur.data?.plan === undefined, '4.11 "Mua YouTube" without duration leaves plan undefined');
  assert(resNoDur.actions && resNoDur.actions.length > 1, '4.12 Provides multiple plan actions for choice');

  // --------------------------------------------------------------------------
  // 5. TOPIC SWITCHING GUARD
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Topic Switching Guard (YouTube 6 tháng -> Netflix) ---');
  clearSessionContext();
  await processAgentMessageV2('Mua YouTube 6 tháng', guestContext);
  const switchRes = await processAgentMessageV2('Tư vấn Netflix', guestContext);
  assert(switchRes.data?.product?.name.includes('Netflix'), '5.1 Successfully switches to Netflix');
  // Must NOT leak YouTube's 6-month plan context to Netflix
  assert(switchRes.data?.plan === undefined, '5.2 Does NOT leak YouTube 6-month plan to Netflix');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  if (failedTests === 0) {
    console.log('🎉 ALL BUG-001 TESTS PASSED WITH ZERO ERRORS!');
  } else {
    console.error('❌ SOME TESTS FAILED');
  }
  console.log('================================================================\n');

  if (failedTests > 0) process.exit(1);
}

runBug001Suite().catch((err) => {
  console.error('BUG-001 Suite Error:', err);
  process.exit(1);
});
