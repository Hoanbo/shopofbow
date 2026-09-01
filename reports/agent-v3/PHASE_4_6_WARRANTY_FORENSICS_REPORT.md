# BOW AGENT V3.3 — PHASE 4.6
# WARRANTY RUNTIME FORENSICS & UI BEHAVIOR AUDIT REPORT
**Execution Mode: HARD STOP — INSPECTION ONLY (NO CODE CHANGES)**  
**Date:** 2026-09-01  
**Target Subsystems:** Warranty Planning, Order Eligibility, Action Dispatch, Modal Execution, Icon Deduplication (V2 & Gemini Paths)

---

## 1. Executive Summary

This forensic audit was commissioned to investigate runtime discrepancies observed during manual testing of the warranty flow:
```text
User: "bảo hành"
Actual:
🛠️ Hỗ trợ bảo hành dịch vụ YouTube Premium
→ order BOW585466531
→ "Gửi yêu cầu bảo hành"
→ vẫn có dấu hiệu deeplink
→ icon 🎫 bị lặp thành 🎫🎫
```

Prior automated validation suites (Phase 4.3 with 34/34 assertions, Phase 4.4 with 114/114 assertions, Phase 4.5 with 54/54 assertions) all reported `PASS`. However, our runtime code trace reveals that the previous unit tests tested functions in isolation with mock parameters, failing to capture end-to-end UI rendering and cross-subsystem state cascades.

### Summary of Audit Verdicts:
- **BUG-W-001 (Cancelled Order Warranty):** **PARTIAL / AT RISK**  
  Static guards exist in `planSupportTicketAction` and `agentEngine.ts`, but order selection in `findRelevantWarrantyOrder` blindly defaults to `orders[0]` without filtering for active/eligible orders. Furthermore, `AgentWarrantyModal.tsx` fails to check `pending_payment` status.
- **BUG-W-002 (Warranty Modal vs Deeplink):** **FAIL**  
  While clicking "Gửi yêu cầu bảo hành" mounts `AgentWarrantyModal` in-place, the completion screen inside `AgentWarrantyModal.tsx` (line 243) triggers a hard browser redirect `window.location.href = /dashboard?tab=tickets...`. Additionally, `NAVIGATE_TICKET_DETAIL` in `BowAgentChatModal.tsx` (line 376) and deep-link query param parsers in `Dashboard.tsx` (lines 874-908) bypass in-place chat workflows.
- **BUG-W-003 (Duplicate Icon 🎫🎫):** **FAIL (CONFIRMED DUAL-SOURCE)**  
  Identified two separate root causes:
  1. In `BowAgentChatModal.tsx` (lines 516 & 534), the Action Card renders `action.icon` (`🎫`) **twice** within the same card: once in the top-left amber badge, and once inside the action button right beneath it.
  2. In `geminiClient.ts` (lines 203-204), Gemini responses attach **both** `action: primaryAction` and `actions: actions`. When `actions.length === 1`, `BowAgentChatModal.tsx` (lines 633 & 636) renders the entire card **twice** on screen.

---

## 2. Forensic Investigation of Primary Objectives

### BUG-W-001 — Cancelled Order Warranty
- **Status:** **PARTIAL / AT RISK**
- **Objective:** Verify if `cancelled`, `refunded`, or `pending_payment` orders can slip into the warranty flow.

#### Trace Matrix:
| Order Status | `agentEngine.ts` (V2) | `geminiTools.ts` (V3) | `planSupportTicketAction` | `AgentWarrantyModal.tsx` | Runtime Result |
|---|---|---|---|---|---|
| `cancelled` | Rejects with warning (line 876) | Rejects with warning (line 496) | Returns `null` (line 116) | Rejects with Error (line 84) | **SAFE** (Blocked) |
| `refunded` | Rejects with warning (line 888) | Rejects with warning (line 510) | Returns `null` (line 116) | Rejects with Error (line 88) | **SAFE** (Blocked) |
| `pending_payment` | Rejects with warning (line 900) | Rejects with warning (line 524) | Returns `null` (line 116) | **MISSED GUARD** (Lines 84-91) | **AT RISK** (Modal DB check misses `pending_payment`) |
| `paid` | Evaluates as valid | Evaluates as valid | Generates `AgentAction` | Generates Ticket | **ELIGIBLE** |
| `completed` | Evaluates as valid | Evaluates as valid | Generates `AgentAction` | Generates Ticket | **ELIGIBLE** |
| `processing` | Evaluates as valid | Evaluates as valid | Generates `AgentAction` | Generates Ticket | **ELIGIBLE** |
| `pending_delivery` | Evaluates as valid | Evaluates as valid | Generates `AgentAction` | Generates Ticket | **ELIGIBLE** |

#### Critical Flaw in Order Resolution:
In [`src/services/agent/actionPlanner.ts`](file:///c:/Web/shopofbow/src/services/agent/actionPlanner.ts#L141-L170) (`findRelevantWarrantyOrder`):
```ts
// 3. Fallback về đơn được nhắc tới gần nhất hoặc đơn mới nhất
return matchedByProd || lastMentionedOrder || orders[0] || null;
```
- `orders` is passed as the user's unfiltered order history.
- When the user asks general `"bảo hành"` (without specifying product name or payment code), `matchedByProd` is `null`.
- If the user's latest order (`orders[0]`) happens to be `cancelled`, the function returns `orders[0]`.
- `agentEngine.ts` (line 876) sees `status === 'cancelled'` and immediately terminates with an error:
  `"Đơn hàng ... đã bị hủy (cancelled) nên không thể tạo yêu cầu bảo hành."`
- The user is completely blocked from warranty even if `orders[1]` is an active, eligible `completed` order!

---

### BUG-W-002 — Warranty Modal vs Deeplink
- **Status:** **FAIL**
- **Objective:** Verify that clicking "Gửi yêu cầu bảo hành" opens `AgentWarrantyModal` in-place within chat without URL navigation or page reloads.

#### Complete Execution Chain:
1. **User Message:** `"bảo hành"`
2. **Intent Detection:** `intentResolver.ts` &rarr; `primaryIntent: 'WARRANTY'`.
3. **Action Generation:** `actionPlanner.ts#planSupportTicketAction` &rarr;
   ```json
   {
     "type": "NAVIGATE_SUPPORT",
     "label": "Gửi yêu cầu bảo hành",
     "icon": "🎫",
     "payload": { "orderId": "...", "paymentCode": "...", "productName": "..." }
   }
   ```
4. **Action Card Rendered:** `BowAgentChatModal.tsx` (lines 511-537) renders amber Action Card.
5. **Button Click:** Triggers `handleActionDispatch(action)`.
6. **Dispatch Handler:** `BowAgentChatModal.tsx` (lines 362-372):
   ```tsx
   case 'NAVIGATE_SUPPORT': {
     setWarrantyModalData({
       order: { id: action.payload.orderId, paymentCode: action.payload.paymentCode, productName: action.payload.productName },
       issue: action.payload.issueDescription,
     });
     break;
   }
   ```
7. **Modal Rendering:** `AgentWarrantyModal` mounts at lines 743-762 with `isOpen={true}` over chat.
8. **THE DEEPLINK FLAW:**
   Inside [`src/components/agent/AgentWarrantyModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx#L240-L248):
   ```tsx
   <button
     type="button"
     onClick={() => {
       onClose();
       window.location.href = `/dashboard?tab=tickets&ticket_id=${createdTicket.id}`;
     }}
     className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 px-3 text-xs font-bold text-white transition cursor-pointer"
   >
     Xem chi tiết Ticket
   </button>
   ```
   **Evidence:** Line 243 performs a **hard browser navigation (`window.location.href`)**, completely unmounting the agent chat window and reloading the page at `/dashboard?tab=tickets`.
9. **Secondary Deeplink Vectors:**
   - In `BowAgentChatModal.tsx` (lines 374-378), `case 'NAVIGATE_TICKET_DETAIL'` executes `onClose(); navigate('/dashboard?tab=tickets&ticket_id=...')`.
   - In `Dashboard.tsx` (lines 874-908), legacy deep-linking listener `newTicket=1&orderId=...` remains active in production.

---

### BUG-W-003 — Duplicate Icon / Emoji Forensics (🎫 vs 🎫🎫)
- **Status:** **FAIL (DUAL-SOURCE DUPLICATION IDENTIFIED)**
- **Objective:** Determine why `🎫` appears duplicated in the UI.

#### Trace Analysis:
```text
Source 1: Action Card Header Badge (BowAgentChatModal.tsx line 516)
          <span className="bg-amber-500">{action.icon || '🔄'}</span> -> Renders 🎫

Source 2: Action Card Button Leading Icon (BowAgentChatModal.tsx line 534)
          <button>
            <span>{action.icon || '🔄'}</span> -> Renders 🎫
            <span>{cleanActionLabel}</span>    -> "Gửi yêu cầu bảo hành"
          </button>
```

#### Dual-Source Breakdown:
1. **Intra-Card Duplication (Badge + Button):**
   In [`src/components/agent/BowAgentChatModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/BowAgentChatModal.tsx#L511-L537):
   The card displays an amber badge on top containing `{action.icon}` (`🎫`). Immediately below it (separated by only ~20px), the primary button has its own leading `<span>{action.icon}</span>` (`🎫`). The user sees two large `🎫` icons stacked directly on top of each other inside the same card.
2. **Inter-Card Duplication (Gemini Path Double Render):**
   In [`src/services/agent/gemini/geminiClient.ts`](file:///c:/Web/shopofbow/src/services/agent/gemini/geminiClient.ts#L203-L204):
   ```ts
   const agentMessage: AgentMessage = {
     ...
     action: primaryAction,
     actions: actions.length > 0 ? actions : undefined,
   };
   ```
   When `actions` contains 1 action (the warranty action):
   - `agentMessage.action` = `actions[0]`
   - `agentMessage.actions` = `[actions[0]]`
   In `BowAgentChatModal.tsx`:
   - Line 633: `{msg.action && renderActionCard(msg.action)}` &rarr; Renders Card #1.
   - Lines 636-644: `{msg.actions && msg.actions.map(act => renderActionCard(act))}` &rarr; Renders Card #2.
   Both identical cards are displayed in sequence under the same chat bubble, producing 4 `🎫` symbols in total.

---

## 3. V2 (Deterministic) vs Gemini (V3) Path Comparison

| Inspection Point | V2 Deterministic Path | Gemini V3 Tool-Calling Path | Discrepancy / Risk |
|---|---|---|---|
| **Entry Intent** | `resolveMultiIntent(text)` &rarr; `WARRANTY` | LLM selects tool `request_order_warranty` | V2 is keyword-based; Gemini relies on prompt instruction |
| **Order Discovery** | `findRelevantWarrantyOrder(orders, text, lastOrder)` | `findRelevantWarrantyOrder(orders, queryText)` | Both fail to filter out cancelled orders during fallback |
| **Cancelled Guard** | Explicit if-block in `agentEngine.ts` (lines 876-885) | Explicit if-block in `geminiTools.ts` (lines 496-508) | Parity confirmed |
| **Refunded Guard** | Explicit if-block in `agentEngine.ts` (lines 888-897) | Explicit if-block in `geminiTools.ts` (lines 510-522) | Parity confirmed |
| **Pending Guard** | Explicit if-block in `agentEngine.ts` (lines 900-909) | Explicit if-block in `geminiTools.ts` (lines 524-535) | Parity confirmed |
| **Action Generation** | `planSupportTicketAction(order, text, ctx)` | `planSupportTicketAction(order, text, ctx)` | Shared function in `actionPlanner.ts` |
| **Message Attachment** | Sets `action: action` only | Sets **both** `action` and `actions` array | **MAJOR DIVERGENCE**: Gemini triggers double-card rendering |
| **UI Execution** | `BowAgentChatModal.tsx` &rarr; `setWarrantyModalData` | `BowAgentChatModal.tsx` &rarr; `setWarrantyModalData` | Identical |
| **Post-Submit Behavior**| `AgentWarrantyModal.tsx` &rarr; `window.location.href` | `AgentWarrantyModal.tsx` &rarr; `window.location.href` | Both trigger hard page reload |

---

## 4. Complete Runtime Trace

```text
User Input: "bảo hành"
   │
   ├─► [Intent Resolver]
   │     Primary: 'WARRANTY' (confidence: 0.95)
   │
   ├─► [Order Lookup: findRelevantWarrantyOrder]
   │     Query: "bảo hành" (no specific payment code or product in query)
   │     orders[0] selected (unfiltered fallback)
   │
   ├─► [Status Check: relevantOrder.status]
   │     IF 'cancelled'        ──► Return warning text (type: 'warranty_rejected', action: null)
   │     IF 'refunded'         ──► Return warning text (type: 'warranty_rejected', action: null)
   │     IF 'pending_payment'  ──► Return warning text (type: 'warranty_rejected', action: null)
   │     IF 'completed' / etc. ──► Proceed to Action Planner
   │
   ├─► [Action Planner: planSupportTicketAction]
   │     Generates: { type: 'NAVIGATE_SUPPORT', label: 'Gửi yêu cầu bảo hành', icon: '🎫' }
   │
   ├─► [UI Renderer: BowAgentChatModal.tsx]
   │     Renders Action Card:
   │       - Badge: 🎫 (line 516)
   │       - Button: 🎫 Gửi yêu cầu bảo hành (line 534)
   │     (If Gemini path: Renders TWICE due to msg.action + msg.actions)
   │
   ├─► [User Action: Click "Gửi yêu cầu bảo hành"]
   │     handleActionDispatch('NAVIGATE_SUPPORT')
   │     setWarrantyModalData({ order, issue })
   │
   ├─► [Modal Mount: AgentWarrantyModal.tsx]
   │     Modal appears over chat in-place.
   │     User types issue & clicks "Gửi yêu cầu".
   │     Database insert into `support_tickets`.
   │
   └─► [Completion Screen]
         User clicks "Xem chi tiết Ticket"
         `window.location.href = /dashboard?tab=tickets&ticket_id=...` (HARD DEEPLINK!)
```

---

## 5. Root Cause Analysis

### Root Cause 1 (BUG-W-001): Unfiltered Order Selection
- **File:** [`src/services/agent/actionPlanner.ts`](file:///c:/Web/shopofbow/src/services/agent/actionPlanner.ts)
- **Function:** `findRelevantWarrantyOrder` (lines 141-170)
- **Cause:** When falling back to order history (rule #3), it returns `orders[0]` without ensuring that `orders[0]` has an eligible status (`completed`, `processing`, `paid`, `pending_delivery`).
- **Evidence:** Line 170: `return matchedByProd || lastMentionedOrder || orders[0] || null;`

### Root Cause 2 (BUG-W-001): Incomplete Modal DB Validation
- **File:** [`src/components/agent/AgentWarrantyModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx)
- **Function:** `handleSubmit` (lines 84-91)
- **Cause:** DB guard only checks `cancelled` and `refunded`. It forgets to check `pending_payment`.
- **Evidence:** Lines 84-91 contain checks for `cancelled` and `refunded` only.

### Root Cause 3 (BUG-W-002): Hard Browser Redirect on Ticket Creation
- **File:** [`src/components/agent/AgentWarrantyModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx)
- **Function:** Success state button (line 243)
- **Cause:** Uses `window.location.href` to navigate to the ticket page, completely breaking the in-place modal experience.
- **Evidence:** Line 243: `window.location.href = `/dashboard?tab=tickets&ticket_id=${createdTicket.id}`;`

### Root Cause 4 (BUG-W-003): Action Card Double Icon Display
- **File:** [`src/components/agent/BowAgentChatModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/BowAgentChatModal.tsx)
- **Function:** `renderActionButton` (lines 511-537)
- **Cause:** Line 516 puts `{action.icon}` in the card header badge, and line 534 puts `{action.icon}` again in the button.
- **Evidence:** Line 516 has `<span>{action.icon || '🔄'}</span>` and line 534 has `<span>{action.icon || '🔄'}</span>`.

### Root Cause 5 (BUG-W-003): Gemini Dual Action Payload
- **File:** [`src/services/agent/gemini/geminiClient.ts`](file:///c:/Web/shopofbow/src/services/agent/gemini/geminiClient.ts)
- **Function:** `processAgentMessageV3` (lines 203-204)
- **Cause:** Sets both `action: primaryAction` and `actions: actions`. `BowAgentChatModal.tsx` renders `msg.action` and then maps `msg.actions`, duplicating the entire card.
- **Evidence:** Line 203: `action: primaryAction`, line 204: `actions: actions.length > 0 ? actions : undefined`.

---

## 6. Phase 4.3 / 4.5 Claim Verification

| Past Claim | Claimed Status | Actual Runtime Status | Verdict | Evidence |
|---|---|---|---|---|
| **Warranty Status Guard** (Phase 4.3) | PASS | `planSupportTicketAction` returns `null` for cancelled orders, BUT `findRelevantWarrantyOrder` defaults to cancelled `orders[0]`, blocking valid orders. `AgentWarrantyModal` misses `pending_payment`. | **CONTRADICTED BY RUNTIME** | `actionPlanner.ts:170`, `AgentWarrantyModal.tsx:84-91` |
| **In-Place Warranty Modal** (Phase 4.3) | PASS | Modal opens in-place initially, but completion action invokes `window.location.href`, causing a full page redirect. | **CONTRADICTED BY RUNTIME** | `AgentWarrantyModal.tsx:243` |
| **Icon Deduplication** (Phase 4.3) | PASS | Regex sanitizes leading emoji from `action.label`, but UI template renders `{action.icon}` in both badge and button. Gemini path doubles the entire card. | **CONTRADICTED BY RUNTIME** | `BowAgentChatModal.tsx:516, 534`, `geminiClient.ts:203-204` |
| **P2 Gemini Warranty Parity** (Phase 4.5) | PASS | Guards parity confirmed, but payload emission (`action` + `actions`) duplicates cards in chat. | **PARTIALLY CONFIRMED** | `geminiTools.ts:495-535`, `geminiClient.ts:203-204` |

---

## 7. Regression Risk Assessment

Modifying warranty logic in future phases carries the following risks:
1. **BUG-001 Regressions:** The duration/Unicode parser (`6 tháng`, `12 tháng`) in `intentResolver.ts` must remain completely untouched.
2. **Plural & Catalog Discovery Regressions:** Queries like *"có những app xem phim nào"* must not be routed to warranty.
3. **Multi-Intent Continuity:** Inactive ticket/warranty queries should not prematurely invalidate product context.

---

## 8. Recommended Phase 4.7 Fix Scope (PROPOSAL ONLY — NO CODE CHANGES)

The following changes are recommended for Phase 4.7 execution upon user approval:

1. **`findRelevantWarrantyOrder` ([`actionPlanner.ts`](file:///c:/Web/shopofbow/src/services/agent/actionPlanner.ts)):**
   - Filter `orders` to only candidates where `status` is eligible (`completed`, `processing`, `paid`, `pending_delivery`) before applying product matching or fallback to `orders[0]`.
2. **`AgentWarrantyModal.tsx` ([`src/components/agent/AgentWarrantyModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx)):**
   - Add explicit check for `realOrder.status === 'pending_payment'`.
   - In the success state, replace `window.location.href = ...` with an in-place close or an internal chat message linking to the ticket.
3. **`BowAgentChatModal.tsx` ([`src/components/agent/BowAgentChatModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/BowAgentChatModal.tsx)):**
   - For `NAVIGATE_SUPPORT` cards, keep the icon only once (e.g. in the badge or in the button, but not both).
   - In lines 636-644, filter `msg.actions` to exclude `msg.action?.id` to prevent double-card rendering.
4. **`geminiClient.ts` ([`src/services/agent/gemini/geminiClient.ts`](file:///c:/Web/shopofbow/src/services/agent/gemini/geminiClient.ts)):**
   - If `actions.length === 1`, set `action: actions[0]` and leave `actions: undefined`.

---

# STOP CONDITION REACHED
**PHASE 4.6 COMPLETE — INSPECTION ONLY.**  
**NO PRODUCTION CODE, DATABASE, OR MIGRATION MODIFICATIONS WERE PERFORMED.**
