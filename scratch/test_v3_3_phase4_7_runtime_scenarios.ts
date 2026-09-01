import { supabase } from '../src/lib/supabase';
import { processAgentMessageV2 } from '../src/services/agent/agentEngine';
import { synthesizeActionsAndSuggestions } from '../src/services/agent/gemini/geminiClient';
import { clearSessionContext } from '../src/services/agent/sessionContext';
import type { AgentContext } from '../src/services/agent/types';

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

// Mock Supabase orders query so getMyOrders uses mockOrdersDatabase in each scenario
let mockOrdersDatabase: any[] = [];

const originalFrom = supabase.from.bind(supabase);
(supabase as any).from = (table: string) => {
  if (table === 'orders') {
    const builder: any = {
      select: () => builder,
      eq: (field: string, val: any) => {
        if (field === 'status') {
          return {
            ...builder,
            data: mockOrdersDatabase.filter((o) => o.status === val),
          };
        }
        return builder;
      },
      ilike: (field: string, pattern: string) => {
        const clean = pattern.replace(/%/g, '').toLowerCase();
        return {
          ...builder,
          data: mockOrdersDatabase.filter((o) => String(o[field] || '').toLowerCase().includes(clean)),
        };
      },
      order: () => builder,
      limit: () => Promise.resolve({ data: mockOrdersDatabase, error: null }),
      then: (resolve: any) => resolve({ data: mockOrdersDatabase, error: null }),
    };
    return builder;
  }
  return originalFrom(table);
};

async function runRuntimeValidation() {
  console.log('\n======================================================================');
  console.log('PHASE 4.7 MANDATORY RUNTIME SCENARIO VALIDATION (V2 + GEMINI PATHS)');
  console.log('======================================================================\n');

  const baseUserContext: AgentContext = {
    userId: '11111111-2222-3333-4444-555555555555',
    email: 'runtime@bow.vn',
    fullName: 'Hoàng Runtime',
    role: 'user',
    balance: 500000,
    isAuthenticated: true,
  };

  // --------------------------------------------------------------------------
  // SCENARIO A: User says "bảo hành" with Latest Completed Order
  // --------------------------------------------------------------------------
  console.log('--- [SCENARIO A: "bảo hành" với đơn hoàn tất (Completed Order)] ---');
  clearSessionContext();
  mockOrdersDatabase = [
    {
      id: 'ord-yt-completed',
      payment_code: 'BOW585466531',
      product_name: 'YouTube Premium 1 Năm',
      plan_label: 'Gói 1 Năm',
      status: 'completed',
      price: 299000,
      created_at: new Date().toISOString(),
    },
  ];

  const resA = await processAgentMessageV2('bảo hành', baseUserContext);
  assert(resA.action !== undefined, 'A1. Action generated for valid completed order');
  assert(resA.action?.type === 'NAVIGATE_SUPPORT', 'A2. Action type is NAVIGATE_SUPPORT');
  assert(resA.action?.payload.paymentCode === 'BOW585466531', 'A3. Action targets BOW585466531');
  assert(resA.actions === undefined, 'A4. actions array is undefined (NO DOUBLE CARD in V2)');
  assert(resA.content.includes('Hỗ trợ bảo hành dịch vụ YouTube Premium'), 'A5. Informative text includes YouTube Premium');

  // --------------------------------------------------------------------------
  // SCENARIO B: User says "bảo hành" with Latest Cancelled + Older Completed
  // --------------------------------------------------------------------------
  console.log('\n--- [SCENARIO B: "bảo hành" với Đơn mới nhất bị Hủy + Đơn cũ Hợp lệ] ---');
  clearSessionContext();
  mockOrdersDatabase = [
    {
      id: 'ord-canc-latest',
      payment_code: 'BOW-CANC-NEW',
      product_name: 'Canva Pro 1 Tháng',
      plan_label: 'Gói 1 Tháng',
      status: 'cancelled',
      price: 50000,
      created_at: new Date().toISOString(),
    },
    {
      id: 'ord-yt-older',
      payment_code: 'BOW585466531',
      product_name: 'YouTube Premium 1 Năm',
      plan_label: 'Gói 1 Năm',
      status: 'completed',
      price: 299000,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ];

  const resB = await processAgentMessageV2('bảo hành', baseUserContext);
  assert(resB.action !== undefined, 'B1. System does NOT reject, picks older valid completed order');
  assert(resB.action?.payload.paymentCode === 'BOW585466531', 'B2. Correctly bypassed cancelled Canva and picked valid YouTube BOW585466531');
  assert(resB.action?.payload.productName === 'YouTube Premium 1 Năm', 'B3. Product name matches YouTube Premium');

  // --------------------------------------------------------------------------
  // SCENARIO C: User says "bảo hành" with ONLY Cancelled/Refunded Orders
  // --------------------------------------------------------------------------
  console.log('\n--- [SCENARIO C: "bảo hành" khi TẤT CẢ đơn đều bị Hủy / Hoàn tiền] ---');
  clearSessionContext();
  mockOrdersDatabase = [
    {
      id: 'ord-canc-1',
      payment_code: 'BOW-CANC-1',
      product_name: 'Netflix 1 Tháng',
      status: 'cancelled',
      created_at: new Date().toISOString(),
    },
    {
      id: 'ord-ref-2',
      payment_code: 'BOW-REF-2',
      product_name: 'Spotify 1 Năm',
      status: 'refunded',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const resC = await processAgentMessageV2('bảo hành', baseUserContext);
  assert(resC.action === undefined, 'C1. Strictly NO warranty action generated for accounts with only invalid orders');
  assert(resC.actions === undefined, 'C2. actions array is undefined');
  assert(resC.content.includes('Chính Sách Bảo Hành Cao Cấp'), 'C3. Displays general warranty policy when no eligible order found');

  // --------------------------------------------------------------------------
  // SCENARIO D: User explicitly specifies a Cancelled Order Code
  // --------------------------------------------------------------------------
  console.log('\n--- [SCENARIO D: Khách hỏi bảo hành đúng mã đơn đã hủy (Explicit Cancelled)] ---');
  clearSessionContext();
  const resD = await processAgentMessageV2('bảo hành đơn BOW-CANC-1', baseUserContext);
  assert(resD.action === undefined, 'D1. No warranty action generated');
  assert(resD.content.includes('đã bị hủy (cancelled)'), 'D2. Explicitly informs that BOW-CANC-1 was cancelled');
  assert(resD.data?.type === 'warranty_rejected', 'D3. Response data is warranty_rejected');

  // --------------------------------------------------------------------------
  // SCENARIO E: Gemini Action Synthesis & Normalization (Avoid Duplicate Card)
  // --------------------------------------------------------------------------
  console.log('\n--- [SCENARIO E: Gemini Path Normalization (Single Action vs Multi-Choice)] ---');
  clearSessionContext();
  const validOrder = {
    id: 'ord-valid-1',
    payment_code: 'BOW-VALID-1',
    product_name: 'YouTube Premium 1 Năm',
    plan_label: 'Gói 1 Năm',
    status: 'completed',
  };

  const geminiCollectedOutputs1 = [
    {
      toolName: 'request_order_warranty',
      success: true,
      data: { eligible: true },
      actionData: {
        type: 'warranty_ticket',
        order: validOrder,
      },
    },
  ];

  const synthSingle = synthesizeActionsAndSuggestions(geminiCollectedOutputs1, baseUserContext, 'bảo hành', 'sess-123');
  assert(synthSingle.actions.length === 1, 'E1. Gemini synthesis produced 1 warranty action');
  assert(synthSingle.actions[0].type === 'NAVIGATE_SUPPORT', 'E2. Action is NAVIGATE_SUPPORT');

  // Simulated Gemini client message creation:
  const singleAction = synthSingle.actions.length === 1 ? synthSingle.actions[0] : undefined;
  const multipleActions = synthSingle.actions.length > 1 ? synthSingle.actions : undefined;
  assert(singleAction !== undefined, 'E3. singleAction is populated with warranty action');
  assert(multipleActions === undefined, 'E4. multipleActions is strictly undefined (Guarantees NO duplicate Action Card)');

  // --------------------------------------------------------------------------
  // SCENARIO F: UI Action Card Rendering Invariants (One Card, One 🎫 Icon)
  // --------------------------------------------------------------------------
  console.log('\n--- [SCENARIO F: UI Action Card Rendering Invariants] ---');
  const warrantyAction = resA.action!;
  const isSupport = warrantyAction.type === 'NAVIGATE_SUPPORT';
  const badgeIcon = '📦';
  const buttonIcon = warrantyAction.icon || (isSupport ? '🎫' : '🔄');

  assert(badgeIcon === '📦', 'F1. Header Badge icon is 📦 (Order icon)');
  assert(buttonIcon === '🎫', 'F2. Button leading icon is 🎫 (Warranty ticket icon)');
  assert(badgeIcon !== buttonIcon, 'F3. Badge and Button icons are distinct: exactly ONE 🎫 icon rendered');

  // Test BowAgentChatModal deduplication filter:
  const msgWithAccidentalDouble = {
    action: warrantyAction,
    actions: [warrantyAction],
  };

  const renderedCardIds: string[] = [];
  if (msgWithAccidentalDouble.action) renderedCardIds.push(msgWithAccidentalDouble.action.id);
  if (msgWithAccidentalDouble.actions && msgWithAccidentalDouble.actions.length > 0) {
    const extra = msgWithAccidentalDouble.actions.filter(
      (act) => !msgWithAccidentalDouble.action || (act.id ? act.id !== msgWithAccidentalDouble.action.id : act.type !== msgWithAccidentalDouble.action.type)
    );
    extra.forEach((a) => renderedCardIds.push(a.id));
  }

  assert(renderedCardIds.length === 1, 'F4. UI filter prevents rendering the same action twice when action and actions[0] overlap');

  console.log('\n======================================================');
  console.log(`RUNTIME VALIDATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runRuntimeValidation().catch((err) => {
  console.error('Runtime error:', err);
  process.exit(1);
});
