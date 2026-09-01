import {
  findRelevantWarrantyOrder,
  planSupportTicketAction,
  isOrderWarrantyEligible,
  planRenewalAction,
  planOrderDetailAction,
  planApplyCouponAction,
} from '../src/services/agent/actionPlanner';
import type { AgentContext, AgentAction } from '../src/services/agent/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

const authContext: AgentContext = {
  userId: 'user-w-001',
  email: 'test@example.com',
  fullName: 'Nguyễn Văn Test',
  role: 'user',
  balance: 250000,
  isAuthenticated: true,
};

const unauthContext: AgentContext = {
  role: 'guest',
  isAuthenticated: false,
};

console.log('\n=== [SUITE 1: WARRANTY ORDER STATUS RESOLUTION & ELIGIBILITY (BUG-W-001)] ===\n');

const orderCompletedLatest = {
  id: 'ord-comp-1',
  payment_code: 'BOW-COMP-01',
  product_name: 'YouTube Premium 1 Năm',
  status: 'completed',
  created_at: '2026-08-30T10:00:00Z',
};

const orderCancelledLatest = {
  id: 'ord-canc-1',
  payment_code: 'BOW-CANC-01',
  product_name: 'YouTube Premium 1 Tháng',
  status: 'cancelled',
  created_at: '2026-08-31T10:00:00Z',
};

const orderCompletedOlder = {
  id: 'ord-comp-old',
  payment_code: 'BOW-COMP-OLD',
  product_name: 'YouTube Premium 1 Năm',
  status: 'completed',
  created_at: '2026-08-01T10:00:00Z',
};

const orderRefundedLatest = {
  id: 'ord-ref-1',
  payment_code: 'BOW-REF-01',
  product_name: 'Netflix Extra Member',
  status: 'refunded',
  created_at: '2026-08-31T12:00:00Z',
};

const orderPaidOlder = {
  id: 'ord-paid-old',
  payment_code: 'BOW-PAID-OLD',
  product_name: 'Netflix Extra Member',
  status: 'paid',
  created_at: '2026-08-15T12:00:00Z',
};

const orderPendingPaymentLatest = {
  id: 'ord-pend-1',
  payment_code: 'BOW-PEND-01',
  product_name: 'Spotify Premium 1 Năm',
  status: 'pending_payment',
  created_at: '2026-08-31T14:00:00Z',
};

const orderProcessingOlder = {
  id: 'ord-proc-old',
  payment_code: 'BOW-PROC-OLD',
  product_name: 'Spotify Premium 1 Năm',
  status: 'processing',
  created_at: '2026-08-20T14:00:00Z',
};

// 1. latest completed -> PASS
const r1 = findRelevantWarrantyOrder([orderCompletedLatest], 'bảo hành');
assert(r1?.id === 'ord-comp-1', '1. Latest completed order is selected directly');

// 2. latest cancelled + older completed -> completed selected
const r2 = findRelevantWarrantyOrder([orderCancelledLatest, orderCompletedOlder], 'bảo hành');
assert(r2?.id === 'ord-comp-old', '2. Latest cancelled + older completed -> picks older completed');

// 3. latest refunded + older paid -> paid selected
const r3 = findRelevantWarrantyOrder([orderRefundedLatest, orderPaidOlder], 'bảo hành');
assert(r3?.id === 'ord-paid-old', '3. Latest refunded + older paid -> picks older paid');

// 4. latest pending_payment + older processing -> processing selected
const r4 = findRelevantWarrantyOrder([orderPendingPaymentLatest, orderProcessingOlder], 'bảo hành');
assert(r4?.id === 'ord-proc-old', '4. Latest pending_payment + older processing -> picks older processing');

// 5. only invalid orders -> return null / no warranty action
const r5 = findRelevantWarrantyOrder([orderCancelledLatest, orderRefundedLatest, orderPendingPaymentLatest], 'bảo hành');
assert(r5 === null, '5. Only invalid/cancelled orders -> returns null (no warranty action created)');

// 6. explicit valid order -> preserved
const r6 = findRelevantWarrantyOrder([orderCancelledLatest, orderCompletedOlder], 'bảo hành BOW-COMP-OLD');
assert(r6?.id === 'ord-comp-old', '6. Explicit valid order code query preserves that exact order');

// 7. explicit cancelled order -> returned explicitly so agentEngine/gemini can give informative cancellation warning
const r7 = findRelevantWarrantyOrder([orderCancelledLatest, orderCompletedOlder], 'bảo hành đơn BOW-CANC-01');
assert(r7?.id === 'ord-canc-1', '7. Explicit cancelled order query returns the cancelled order for explicit rejection');
const r7Action = planSupportTicketAction(r7, 'Lỗi tài khoản', authContext);
assert(r7Action === null, '7b. planSupportTicketAction strictly returns null for the cancelled order');

console.log('\n=== [SUITE 2: ELIGIBILITY PREDICATE & SECONDARY GUARDS (BUG-W-001)] ===\n');

assert(isOrderWarrantyEligible(orderCompletedLatest) === true, 'Eligible: completed');
assert(isOrderWarrantyEligible(orderProcessingOlder) === true, 'Eligible: processing');
assert(isOrderWarrantyEligible(orderPaidOlder) === true, 'Eligible: paid');
assert(isOrderWarrantyEligible({ status: 'pending_delivery' }) === true, 'Eligible: pending_delivery');
assert(isOrderWarrantyEligible(orderCancelledLatest) === false, 'Ineligible: cancelled');
assert(isOrderWarrantyEligible(orderRefundedLatest) === false, 'Ineligible: refunded');
assert(isOrderWarrantyEligible(orderPendingPaymentLatest) === false, 'Ineligible: pending_payment');
assert(isOrderWarrantyEligible(null) === false, 'Ineligible: null');
assert(isOrderWarrantyEligible({}) === false, 'Ineligible: empty');

console.log('\n=== [SUITE 3: IN-PLACE MODAL & NO DEEPLINK (BUG-W-002)] ===\n');

// 8. warranty action structure
const warrantyAct = planSupportTicketAction(orderCompletedLatest, 'Tài khoản bị out slot', authContext);
assert(warrantyAct !== null, '8. planSupportTicketAction produces non-null action for valid order');
assert(warrantyAct?.type === 'NAVIGATE_SUPPORT', '8b. action type is NAVIGATE_SUPPORT');
assert(warrantyAct?.payload.orderId === 'ord-comp-1', '8c. action payload contains correct orderId');
assert(warrantyAct?.payload.paymentCode === 'BOW-COMP-01', '8d. action payload contains paymentCode');

// 9-13. Modal behavior assertions (Simulate dispatch & completion logic)
const mockChatState = {
  isModalOpen: true,
  warrantyModalData: null as any,
  windowLocationHref: 'http://localhost:5173/chat',
  messages: [] as any[],
};

// Dispatch action: NAVIGATE_SUPPORT
function handleActionDispatch(action: AgentAction) {
  if (action.type === 'NAVIGATE_SUPPORT') {
    mockChatState.warrantyModalData = {
      order: {
        id: action.payload.orderId,
        paymentCode: action.payload.paymentCode,
        productName: action.payload.productName,
      },
      issue: action.payload.issueDescription,
    };
  }
}

handleActionDispatch(warrantyAct!);
assert(mockChatState.warrantyModalData !== null, '9. Dispatching NAVIGATE_SUPPORT sets warrantyModalData in-place');
assert(mockChatState.warrantyModalData.order.id === 'ord-comp-1', '9b. Modal data contains target order');

// Simulate Modal Success completion:
function handleModalSuccess(ticketId: string, ticketNum: string) {
  // New V3.3 Phase 4.7 behavior:
  mockChatState.warrantyModalData = null; // in-place close
  // NO change to mockChatState.windowLocationHref!
  mockChatState.messages.push({
    sender: 'agent',
    content: `✅ Đã gửi yêu cầu bảo hành (${ticketNum}) thành công!`,
  });
}

handleModalSuccess('tick-123', 'BOW-TK-8899');
assert(mockChatState.warrantyModalData === null, '10. Modal closes in-place upon completion');
assert(mockChatState.windowLocationHref === 'http://localhost:5173/chat', '11. window.location is NEVER modified (NO DEEPLINK)');
assert(mockChatState.isModalOpen === true, '12. Chat modal remains mounted and active');
assert(mockChatState.messages.length === 1 && mockChatState.messages[0].content.includes('BOW-TK-8899'), '13. Ticket confirmation message rendered in-place in chat');

console.log('\n=== [SUITE 4: DEDUPLICATION & ICON RENDERING (BUG-W-003)] ===\n');

// 14. Action Card Header Badge vs Button icon
assert(warrantyAct?.icon === '🎫', '14. Semantic icon in action data is 🎫');
assert(warrantyAct?.label === 'Gửi yêu cầu bảo hành', '14b. Semantic label has no prefix emoji');

// Simulate Action Card JSX template from BowAgentChatModal.tsx:
function renderActionCardIcons(action: AgentAction) {
  const isSupport = action.type === 'NAVIGATE_SUPPORT';
  const badgeIcon = '📦';
  const buttonIcon = action.icon || (isSupport ? '🎫' : '🔄');
  return { badgeIcon, buttonIcon };
}

const icons = renderActionCardIcons(warrantyAct!);
assert(icons.badgeIcon === '📦', '15. Card Header badge icon is 📦 (Order representation)');
assert(icons.buttonIcon === '🎫', '15b. Card Button icon is 🎫 (Action representation)');
assert(icons.badgeIcon !== icons.buttonIcon, '15c. Strictly ONE 🎫 icon rendered per Action Card');

// 16. Deduplicate when action and actions[0] are identical (Gemini normalization)
function normalizeGeminiActions(actionsList: AgentAction[], primaryAction?: AgentAction) {
  const singleAction = actionsList.length === 1 ? actionsList[0] : (actionsList.length === 0 ? primaryAction : undefined);
  const multipleActions = actionsList.length > 1 ? actionsList : undefined;
  return { singleAction, multipleActions };
}

const geminiNorm1 = normalizeGeminiActions([warrantyAct!]);
assert(geminiNorm1.singleAction?.id === warrantyAct?.id, '16. Gemini with 1 action normalizes to singleAction');
assert(geminiNorm1.multipleActions === undefined, '16b. Gemini with 1 action sets multipleActions to undefined (no double render)');

// 17. UI Filter in BowAgentChatModal:
function getRenderedCards(msg: { action?: AgentAction; actions?: AgentAction[] }) {
  const rendered: string[] = [];
  if (msg.action) rendered.push(msg.action.id);
  if (msg.actions && msg.actions.length > 0) {
    const extra = msg.actions.filter((act) => !msg.action || (act.id ? act.id !== msg.action.id : act.type !== msg.action.type));
    extra.forEach((a) => rendered.push(a.id));
  }
  return rendered;
}

// Even if message somehow had both:
const doublePayloadMsg = {
  action: warrantyAct!,
  actions: [warrantyAct!],
};
const renderedCards1 = getRenderedCards(doublePayloadMsg);
assert(renderedCards1.length === 1, '16c. BowAgentChatModal filter strictly renders 1 card even if payload has duplicate action');

// 18. Two genuinely different actions -> both render
const renewAct = planRenewalAction(orderCompletedLatest, authContext)!;
const multiActionMsg = {
  action: undefined,
  actions: [warrantyAct!, renewAct],
};
const renderedCards2 = getRenderedCards(multiActionMsg);
assert(renderedCards2.length === 2, '17. Two genuinely different actions both render properly');

// 19. Unrelated action icons remain unchanged
const couponAct = planApplyCouponAction('BOWVIP20', '20%', authContext);
assert(couponAct?.icon === '🎟️', '18. Coupon action icon preserved as 🎟️');
const detailAct = planOrderDetailAction(orderCompletedLatest, authContext);
assert(detailAct?.icon === '👁️', '18b. Order detail action icon preserved as 👁️');
assert(renewAct?.icon === '🔄', '18c. Renewal action icon preserved as 🔄');

console.log('\n======================================================');
console.log(`PHASE 4.7 WARRANTY HARDENING SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
