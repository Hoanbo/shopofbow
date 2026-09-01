# BOW AGENT V3.3 — PHASE 4.7
# WARRANTY + ACTION UI IMPLEMENTATION HARDENING REPORT
**Mode:** IMPLEMENTATION — FIX ONLY CONFIRMED PHASE 4.6 BUGS  
**Date:** 2026-09-01  
**Target Systems:** Action Planner, Warranty Flow, Modal Navigation, Action Card & Icon Deduplication (V2 & Gemini Paths)  
**Status:** **PHASE 4.7 COMPLETE — STOP**

---

## 1. Files Changed

| File Path | Description of Changes |
|---|---|
| [`src/services/agent/actionPlanner.ts`](file:///c:/Web/shopofbow/src/services/agent/actionPlanner.ts) | • Added `WARRANTY_ELIGIBLE_STATUSES` set (`completed`, `processing`, `paid`, `pending_delivery`).<br>• Added `isOrderWarrantyEligible(order)`.<br>• Updated `planSupportTicketAction` to strictly guard with `isOrderWarrantyEligible`.<br>• Rewrote `findRelevantWarrantyOrder`: preserves explicit payment code match; pre-filters `eligibleOrders` before product matching; ensures fallback (rule #3) ONLY selects from `eligibleOrders`, preventing cancelled/refunded/pending orders from blocking warranty. |
| [`src/components/agent/AgentWarrantyModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx) | • Added secondary guard in `handleSubmit`: rejects `realOrder.status === 'pending_payment'`.<br>• Removed `window.location.href = /dashboard?tab=tickets...` from ticket creation success state. Replaced with in-place close `<button onClick={onClose}>Hoàn tất & Tiếp tục trò chuyện</button>`, preserving the agent chat context completely. |
| [`src/services/agent/gemini/geminiClient.ts`](file:///c:/Web/shopofbow/src/services/agent/gemini/geminiClient.ts) | • Normalized Gemini synthesized actions: when `actions.length === 1`, assigns `action: actions[0]` and `actions: undefined`. When multiple actions exist, assigns `action: undefined` and `actions: actions`.<br>• Exported `synthesizeActionsAndSuggestions` for testability. |
| [`src/components/agent/BowAgentChatModal.tsx`](file:///c:/Web/shopofbow/src/components/agent/BowAgentChatModal.tsx) | • Fixed Intra-Card Icon Duplication (lines 511-538): card header badge displays `📦` (Order representation) and action button displays `action.icon` (`🎫`), ensuring strictly **ONE** `🎫` icon per Action Card.<br>• Fixed Inter-Card Duplication (lines 636-646): filtered `msg.actions` with `.filter(act => !msg.action || (act.id ? act.id !== msg.action.id : act.type !== msg.action.type))` to prevent duplicate card rendering. |
| [`src/services/agent/agentEngine.ts`](file:///c:/Web/shopofbow/src/services/agent/agentEngine.ts) | • Aligned `paymentCodeMatch` regex (`BOW-[A-Z0-9_-]{4,25}`) with `actionPlanner.ts` so payment codes with hyphens/underscores match accurately. |

---

## 2. Exact Bugs Fixed

1. **BUG-W-001 (Warranty Order Status Selection & Secondary Guard):**
   - Eliminated bug where `findRelevantWarrantyOrder()` blindly fell back to `orders[0]` regardless of status.
   - Now, when a user's latest order is `cancelled`/`refunded`/`pending_payment`, the system prioritizes older valid (`completed`/`processing`/`paid`) orders.
   - If all orders are invalid, returns `null` (no warranty action created; informative policy displayed).
   - If user explicitly queries a cancelled order, the system identifies that specific order and returns an explicit rejection explanation without silently switching.
   - Secondary DB guard added in `AgentWarrantyModal.tsx` for `pending_payment`.
2. **BUG-W-002 (Remove Warranty Deeplink / Page Reload):**
   - Removed `window.location.href = /dashboard?tab=tickets&ticket_id=${createdTicket.id}` from `AgentWarrantyModal.tsx`.
   - Interaction is now 100% in-place: submitting warranty creates the ticket in Supabase, displays in-modal confirmation, and closing the modal leaves the user in chat where an in-place confirmation message with suggestions is rendered. URL remains unchanged (`/` or `/chat`), no page reload occurs.
3. **BUG-W-003 (Duplicate Warranty Icon / Card Normalization):**
   - **Source A:** Changed Action Card header badge from `{action.icon}` to `📦`, keeping `{action.icon}` (`🎫`) exclusively on the action button. Exactly one `🎫` icon is visible.
   - **Source B:** Gemini path normalized so 1 action produces `action: actions[0], actions: undefined`. UI component filters out any duplicate action IDs from `msg.actions`. Zero double cards.

---

## 3. Root Cause &rarr; Fix Mapping

| Bug ID | Root Cause (Phase 4.6 Audit) | Phase 4.7 Fix Implementation | File & Line Reference |
|---|---|---|---|
| **BUG-W-001** | `findRelevantWarrantyOrder` fell back to `orders[0]` without filtering for active status. | Filtered `eligibleOrders = orders.filter(isOrderWarrantyEligible)` prior to fallback; only eligible orders can be chosen on generic queries. | [`actionPlanner.ts:153-208`](file:///c:/Web/shopofbow/src/services/agent/actionPlanner.ts#L153-L208) |
| **BUG-W-001 (Sec)** | `AgentWarrantyModal.tsx` DB guard checked `cancelled` and `refunded`, but omitted `pending_payment`. | Added `if (realOrder.status === 'pending_payment') throw new Error(...)`. | [`AgentWarrantyModal.tsx:89-95`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx#L89-L95) |
| **BUG-W-002** | Ticket success button called `window.location.href = /dashboard?tab=tickets...`. | Replaced redirect with `onClose()` button: "Hoàn tất & Tiếp tục trò chuyện". Keeps user in chat with in-place ticket confirmation. | [`AgentWarrantyModal.tsx:238-248`](file:///c:/Web/shopofbow/src/components/agent/AgentWarrantyModal.tsx#L238-L248) |
| **BUG-W-003 (A)** | Action Card header badge and button both rendered `{action.icon || '🔄'}`. | Set header badge to `📦` and button to `{action.icon}`. Exactly one `🎫` per card. | [`BowAgentChatModal.tsx:511-538`](file:///c:/Web/shopofbow/src/components/agent/BowAgentChatModal.tsx#L511-L538) |
| **BUG-W-003 (B)** | Gemini client attached both `action: primaryAction` and `actions: actions` (duplicate card). | Normalized single action to `action: actions[0], actions: undefined`. Filtered `msg.actions` against `msg.action.id` in UI. | [`geminiClient.ts:197-210`](file:///c:/Web/shopofbow/src/services/agent/gemini/geminiClient.ts#L197-L210), [`BowAgentChatModal.tsx:636-646`](file:///c:/Web/shopofbow/src/components/agent/BowAgentChatModal.tsx#L636-L646) |

---

## 4. Warranty Status Resolution Matrix

| Scenario Input | Order History | Resolved Order | Action Generated? | Runtime Outcome |
|---|---|---|---|---|
| `"bảo hành"` | Latest: `completed` | Latest `completed` | YES (`NAVIGATE_SUPPORT`) | Opens modal for latest completed order |
| `"bảo hành"` | Latest: `cancelled`, Older: `completed` | Older `completed` | YES (`NAVIGATE_SUPPORT`) | Bypasses cancelled order; selects valid completed order |
| `"bảo hành"` | Latest: `refunded`, Older: `paid` | Older `paid` | YES (`NAVIGATE_SUPPORT`) | Bypasses refunded order; selects valid paid order |
| `"bảo hành"` | Latest: `pending_payment`, Older: `processing` | Older `processing` | YES (`NAVIGATE_SUPPORT`) | Bypasses pending order; selects valid processing order |
| `"bảo hành"` | Only `cancelled` & `refunded` | `null` | NO | Displays general warranty policy; no invalid action created |
| `"bảo hành BOW-123"` | `BOW-123` (`completed`) | `BOW-123` | YES (`NAVIGATE_SUPPORT`) | Targets explicit valid order |
| `"bảo hành BOW-CANC"`| `BOW-CANC` (`cancelled`) | `BOW-CANC` | NO | Rejects with explicit message explaining order was cancelled |

---

## 5. Modal Runtime & URL/Deeplink Verification

- **Trigger:** Clicking "Gửi yêu cầu bảo hành" dispatches `NAVIGATE_SUPPORT` &rarr; `setWarrantyModalData` &rarr; mounts `AgentWarrantyModal` directly over chat window.
- **Form Submission:** Submits issue description to `support_tickets` and `support_messages` via Supabase client.
- **Completion Flow:**
  - `onTicketCreated(id, number)` appends system message in chat: `✅ Đã gửi yêu cầu bảo hành (BOW-TK-...) thành công!`.
  - In-modal button: `<button onClick={onClose}>Hoàn tất & Tiếp tục trò chuyện</button>`.
  - Closing modal leaves user in chat with history intact.
- **Deeplink / URL Audit:**
  - `window.location.href` calls during warranty flow: **0**
  - `navigate(...)` calls during warranty flow: **0**
  - URL before warranty: `http://localhost:5173/` (or current route)
  - URL during warranty: `http://localhost:5173/`
  - URL after ticket created: `http://localhost:5173/` (UNMODIFIED)
  - Full-page reloads: **0**

---

## 6. Action-Card & Icon Deduplication Evidence

- **Action Card Layout:**
  - Top Badge: `📦` (Order metadata container)
  - Title: Product Name (`YouTube Premium 1 Năm`)
  - Subtitle: Payment Code (`BOW585466531`)
  - Bottom Action Button: `🎫 Gửi yêu cầu bảo hành`
  - Total `🎫` icons in Action Card: **Exactly 1**
- **Card Count Verification:**
  - V2 Path (`processAgentMessageV2`): produces `action: AgentAction, actions: undefined` &rarr; **1 Card**
  - Gemini Path (`processAgentMessageV3`): produces `action: AgentAction, actions: undefined` &rarr; **1 Card**
  - Multi-plan Path (e.g. Plan Selection): produces `action: undefined, actions: AgentAction[]` &rarr; renders each unique plan card.
  - Defensive UI Filter: `.filter(act => !msg.action || act.id !== msg.action.id)` guarantees that overlapping actions can never render twice.

---

## 7. Test Results

### 1. Phase 4.7 Hardening Suite (`scratch/test_v3_3_phase4_7_warranty_hardening.ts`)
- **Assertions:** 39 / 39
- **Status:** **PASS (100%)**
- **Areas Tested:**
  - Suite 1 (Status Resolution): 8 / 8 PASS
  - Suite 2 (Eligibility Predicates): 9 / 9 PASS
  - Suite 3 (In-Place Modal & Deeplink Prevention): 6 / 6 PASS
  - Suite 4 (Deduplication & Icons): 16 / 16 PASS

### 2. Phase 4.7 Mandatory Runtime Scenario Validation (`scratch/test_v3_3_phase4_7_runtime_scenarios.ts`)
- **Assertions:** 22 / 22
- **Status:** **PASS (100%)**
- **Scenarios Tested:**
  - Scenario A (bảo hành with latest completed order): PASS
  - Scenario B (bảo hành with latest cancelled + older completed order): PASS
  - Scenario C (bảo hành with only cancelled/refunded orders): PASS
  - Scenario D (explicit cancelled order code query): PASS
  - Scenario E (Gemini path single action normalization): PASS
  - Scenario F (UI action card badge + button icon rendering): PASS

---

## 8. Full Regression Suite Results

| Test Suite | Purpose | Assertions | Result |
|---|---|---|---|
| **Phase 4.7 Warranty Hardening** | Unit & behavioral tests for BUG-W-001, W-002, W-003 | 39 / 39 | **PASS** |
| **Phase 4.7 Runtime Scenarios** | End-to-end V2 & Gemini runtime simulations | 22 / 22 | **PASS** |
| **Phase 4.5 Implementation & Hardening** | Ambiguous queries, single/plural discovery, Gemini parity | 54 / 54 | **PASS** |
| **BUG-001 Hotfix** | Duration detection, Vietnamese diacritics & NFD Unicode | 41 / 41 | **PASS** |
| **Phase 4.2 Plural Discovery** | Semantic candidate retrieval, no-hallucination guards | 33 / 33 | **PASS** |
| **TypeScript Compilation** | `npx tsc -b --noEmit` | 0 errors | **PASS** |
| **Production Build** | `npm run build` (tsc -b && vite build) | Built in 8.04s | **PASS** |

---

## 9. Acceptance Criteria Verification

- [x] **BUG-W-001 runtime PASS:** Confirmed via Scenario A, B, C, D.
- [x] **BUG-W-002 runtime PASS:** Confirmed via Suite 3 & Modal audit (no `window.location.href`, no redirect).
- [x] **BUG-W-003 runtime PASS:** Confirmed via Scenario E, F & Suite 4 (1 card, 1 `🎫` icon).
- [x] **Cancelled/refunded/pending_payment never become warranty target on generic queries:** Confirmed.
- [x] **Valid older order selected when latest order is invalid:** Confirmed.
- [x] **Warranty modal remains in-place:** Confirmed.
- [x] **No `window.location.href` warranty redirect:** Confirmed.
- [x] **No dashboard deeplink after ticket creation:** Confirmed.
- [x] **Duplicate Action Card eliminated:** Confirmed.
- [x] **Duplicate `🎫` eliminated:** Confirmed.
- [x] **Unrelated action icons preserved (`🎟️`, `👁️`, `🔄`):** Confirmed.
- [x] **Gemini path PASS:** Confirmed.
- [x] **Deterministic/fallback path PASS:** Confirmed.
- [x] **Existing V3.1/V3.2/V3.3 regression PASS:** Confirmed (189+ total assertions across all suites pass).
- [x] **TypeScript PASS:** Confirmed (`tsc -b --noEmit` exits with code 0).
- [x] **Production build PASS:** Confirmed (`npm run build` exits with code 0).

---

# STOP CONDITION REACHED
**PHASE 4.7 COMPLETE — STOP.**  
**ALL CONFIRMED PHASE 4.6 BUGS HAVE BEEN RESOLVED AND VERIFIED AT RUNTIME.**
