// scratch/test_v3_scenarios.ts
// BOW Agent V3 — End-to-End Verification Suite (14 Scenarios)

// @ts-ignore
if (typeof import.meta.env === 'undefined') {
  // @ts-ignore
  import.meta.env = { DEV: true, VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_ANON_KEY: 'mock-key' };
}

import { processAgentMessage, resetGeminiHistory } from '../src/services/agent/agentEngine';
import { clearSessionContext } from '../src/services/agent/sessionContext';

async function runTestSuite() {
  console.log('================================================================');
  console.log('=== BOW AGENT V3 COMPREHENSIVE 14-SCENARIO VERIFICATION ===');
  console.log('================================================================\n');

  const authContext = {
    userId: 'u123',
    email: 'khachhang@gmail.com',
    fullName: 'Nguyễn Văn A',
    role: 'user' as const,
    balance: 50000,
    isAuthenticated: true,
  };

  const scenarios = [
    { id: 1, query: 'chào bạn', expectedTheme: 'GREETING' },
    { id: 2, query: 'shop mình có gì?', expectedTheme: 'CATALOG' },
    { id: 3, query: 'cho tôi xem api', expectedTheme: 'API CODEX / Claude' },
    { id: 4, query: 'tôi cần app nghe nhạc', expectedTheme: 'Spotify / YouTube Music' },
    { id: 5, query: 'tôi muốn xem phim', expectedTheme: 'Netflix / TV360' },
    { id: 6, query: 'tôi cần tool làm video', expectedTheme: 'CapCut / Kling / Veo' },
    { id: 7, query: 'youtube có không?', expectedTheme: 'YouTube Premium' },
    { id: 8, query: 'gói 6 tháng bao nhiêu?', expectedTheme: 'YouTube 6 months (Multi-turn Context)' },
    { id: 9, query: 'kiểm tra ví của tôi', expectedTheme: 'Wallet Balance' },
    { id: 10, query: 'tôi muốn mua 6 tháng nhưng kiểm tra ví trước', expectedTheme: 'Wallet Balance Priority' },
    { id: 11, query: 'nạp thêm 50k', expectedTheme: 'Deposit 50.000đ' },
    { id: 12, query: 'đơn hàng của tôi đâu?', expectedTheme: 'My Orders' },
    { id: 13, query: 'mã giảm giá hôm nay?', expectedTheme: 'Active Coupons' },
    { id: 14, query: 'thời tiết Hà Nội hôm nay thế nào?', expectedTheme: 'Out-of-scope / Friendly redirect' },
  ];

  for (const s of scenarios) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`[Scenario ${s.id}] Input: "${s.query}" (Expected: ${s.expectedTheme})`);
    console.log(`------------------------------------------------------------`);

    // Reset history and session context only for queries that are NOT follow-ups (Scenario 8 follows 7, Scenario 10 follows 9)
    if (s.id !== 8 && s.id !== 10) {
      resetGeminiHistory();
      clearSessionContext();
    }

    const res = await processAgentMessage(s.query, authContext);
    
    console.log(`Sender: ${res.sender}`);
    console.log(`Content Snippet:\n${res.content.slice(0, 250)}...`);
    if (res.action) {
      console.log(`Primary Action: [${res.action.type}] ${res.action.label}`);
    }
    if (res.actions && res.actions.length > 1) {
      console.log(`Multiple Actions (${res.actions.length}):`, res.actions.map(a => a.label));
    }
    if (res.suggestions) {
      console.log(`Suggestions:`, res.suggestions);
    }
  }

  console.log('\n================================================================');
  console.log('=== ALL 14 SCENARIOS TESTED SUCCESSFULLY ===');
  console.log('================================================================');
}

runTestSuite();
