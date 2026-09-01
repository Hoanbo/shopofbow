import { processAgentMessageV2, extractDuration } from '../src/services/agent/agentEngine';
import { clearSessionContext } from '../src/services/agent/sessionContext';

const queries = [
  { q: "Mua YouTube 6 tháng", expectedDur: "6 tháng", expectedPlan: "Slot 6 tháng" },
  { q: "Mua YouTube 6 thang", expectedDur: "6 tháng", expectedPlan: "Slot 6 tháng" },
  { q: "Mua YouTube 6tháng", expectedDur: "6 tháng", expectedPlan: "Slot 6 tháng" },
  { q: "Mua YouTube 6thang", expectedDur: "6 tháng", expectedPlan: "Slot 6 tháng" },
  { q: "Mua YouTube nửa năm", expectedDur: "6 tháng", expectedPlan: "Slot 6 tháng" },
  { q: "Mua YouTube 180 ngày", expectedDur: "6 tháng", expectedPlan: "Slot 6 tháng" },
  { q: "Mua YouTube 12 tháng", expectedDur: "1 năm", expectedPlan: "Slot 12 tháng" },
  { q: "Mua YouTube 12 thang", expectedDur: "1 năm", expectedPlan: "Slot 12 tháng" },
  { q: "Mua YouTube 1 năm", expectedDur: "1 năm", expectedPlan: "Slot 12 tháng" },
  { q: "Mua YouTube 1 nam", expectedDur: "1 năm", expectedPlan: "Slot 12 tháng" },
  { q: "Mua YouTube cả năm", expectedDur: "1 năm", expectedPlan: "Slot 12 tháng" },
  { q: "Mua YouTube 365 ngày", expectedDur: "1 năm", expectedPlan: "Slot 12 tháng" },
  { q: "Mua YouTube 1 tháng", expectedDur: "1 tháng", expectedPlan: "Slot 1 tháng" },
  { q: "Mua YouTube 3 tháng", expectedDur: "3 tháng", expectedPlan: "Slot 3 tháng" },
  { q: "Mua YouTube", expectedDur: undefined, expectedPlan: undefined },
  { q: "YouTube có những gói nào", expectedDur: undefined, expectedPlan: undefined },
];

async function main() {
  for (const item of queries) {
    clearSessionContext();
    const dur = extractDuration(item.q);
    const res = await processAgentMessageV2(item.q, { isAuthenticated: false, role: 'guest' });
    const selectedPlan = res.data?.plan?.name;
    const passDur = dur === item.expectedDur;
    const passPlan = selectedPlan === item.expectedPlan;
    console.log(`[${passDur && passPlan ? 'PASS' : 'FAIL'}] "${item.q}" -> dur: "${dur}" (exp: "${item.expectedDur}"), plan: "${selectedPlan}" (exp: "${item.expectedPlan}")`);
  }
}
main();
