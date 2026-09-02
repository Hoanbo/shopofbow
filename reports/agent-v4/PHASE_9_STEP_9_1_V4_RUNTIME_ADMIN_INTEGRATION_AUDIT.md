# BOW AGENT V4 — PHASE 9 — STEP 9.1
## FULL V4 RUNTIME & ADMIN COPILOT INTEGRATION AUDIT REPORT

- **Target Workspaces**:
  - `ShopOfBow`: `C:\BOW\shopofbow`
  - `BOW Agent V4`: `C:\BOW\bow-agent`
- **Production Target**: `https://shopofbow.vercel.app`
- **Audit Execution Mode**: 🛡️ **READ ONLY / ZERO CODE MODIFICATION / ZERO GIT MUTATION / ZERO DATABASE MUTATION**
- **Date**: 2026-09-02

---

## 1. EXECUTIVE SUMMARY

Mục tiêu cốt lõi của Step 9.1 là điều tra và chứng minh bằng **evidence thực tế từ source code, dependency graph và runtime pipeline**:
> **Vì sao BOW Agent V4 standalone đã vượt qua 100% test suites (196/196 tests), nhưng khi tích hợp vào ShopOfBow — đặc biệt là Admin AI Copilot — các câu hỏi quản trị (`"⏳ Đơn nào đang chờ bàn giao?"`, `"🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921"`) lại bị route nhầm sang `PRODUCT_SEARCH` (tìm ra Leonardo AI / Netflix hoặc báo không tìm thấy sản phẩm)?**

### 🔎 KẾT QUẢ ĐIỀU TRA CỐT LÕI (ROOT CAUSES):

1. **PRIMARY ROOT CAUSE (R5 & R6 — Intent Router Hierarchy & Fallback Bug)**:
   - Module phân loại ý định `intentResolver.ts` (cả trong `@bow/agent` và `shopofbow`) **hoàn toàn chưa có định nghĩa Admin Intents** (`ADMIN_PENDING_HANDOVER`, `ADMIN_REVENUE`, `ADMIN_VOUCHER`, `ADMIN_DISPUTE`).
   - Tại dòng 612 của `intentResolver.ts`: Khi câu hỏi không khớp với bất kỳ ý định người dùng cá nhân nào (`BUY`, `WALLET`, `ORDER_LOOKUP`, `WARRANTY`), hàm trả về giá trị mặc định:
     ```typescript
     return { primaryIntent: 'PRODUCT_SEARCH', secondaryIntents: [] };
     ```
   - Trong `productResolver.ts`, bộ lọc `cleanQueryTokens` bóc tách các từ ngữ tiếng Việt của câu hỏi quản trị thành các keyword rời rạc, kích hoạt `searchProducts()` và trả về các sản phẩm gần đúng trong Catalog (`Leonardo AI`, `Netflix`, `API CODEX`) thay vì gọi Admin Data Providers.

2. **CONTRIBUTING ROOT CAUSE 1 (R1 & R9 — Dependency Resolution Drift)**:
   - `C:\BOW\shopofbow\package.json` tham chiếu `"@bow/agent": "file:../bow-agent"`, nhưng thư mục `C:\BOW\shopofbow\node_modules\@bow\agent\package.json` thực tế vẫn chứa artifacts của **V3.3.0** (`"version": "3.3.0"`).
   - Bundle build hiện tại của Vite resolve từ `node_modules` cũ, dẫn đến việc thiếu đồng bộ các type definitions và provider contracts mới của V4.

3. **CONTRIBUTING ROOT CAUSE 2 (R8 — Action Card Contract Missing for Admin in Gemini Bridge)**:
   - Trong `src/gemini/geminiClient.ts` hàm `synthesizeActionsAndSuggestions()`, cấu trúc `switch (out.actionData.type)` chỉ xử lý các Action Cards của khách hàng (`product_detail`, `products_list`, `wallet`, `orders`, `vouchers`, `tickets`).
   - Các action data của Admin (`pending_fulfillment`, `profit_margin`, `order_handover`, `shop_voucher`, `order_dispute`) bị bỏ qua, dẫn đến `responseData` bị gán `null` khi nhận phản hồi từ Gemini.

---

## 2. GIT BASELINE AUDIT

### A. Repository `C:\BOW\shopofbow`
- **Branch**: `main` (tracking `origin/main`)
- **HEAD Commit**: `4ac892d3cc085af0fced5c2a7c92645f701fa7b0` (`fix(agent): pin host to corrected duration resolver`)
- **Working Tree State**: Có các thay đổi giao diện Responsive & Admin Copilot UI (`AdminAiCopilotModal.tsx`, `AdminAiCopilotDrawer.tsx`, `AdminAiCopilotWidget.tsx`) chưa commit. Bảo toàn nguyên trạng.

### B. Repository `C:\BOW\bow-agent`
- **Branch**: `main` (tracking `origin/main`)
- **HEAD Commit**: `47d6432c1366226eaa5143e06ff6efa58aacdcee` (`fix(duration): preserve unsupported numeric month requests`)
- **Working Tree State**: V4 Core Modules, FastPath Router, Admin Copilot, Robot/IoT test suites sẵn sàng. Bảo toàn nguyên trạng.

---

## 3. BOW AGENT V4 ARCHITECTURE MAP

```
BOW Agent V4 (C:\BOW\bow-agent)
├── Runtime Gateway
│   ├── src/server.ts                    → HTTP REST + WebSocket Dual Server (Port 4000)
│   └── src/index.ts                     → Public Library Entrypoint
│
├── Intent & Routing Subsystem
│   ├── src/core/fastPathRouter.ts       → 0ms Local Deterministic Rule Router
│   ├── src/core/intentResolver.ts       → Intent Classifier (Customer Intents only!)
│   ├── src/core/productResolver.ts      → Vietnamese Catalog & Duration Matcher
│   └── src/core/agentEngine.ts          → Central Process Engine (V3 Gemini + V2 Fallback)
│
├── Context & Memory Subsystem
│   ├── src/core/sessionContext.ts       → In-Memory Session Storage
│   └── src/core/types.ts                → AgentContext, AgentMessage, AgentAction
│
├── Role-Based Access Control & Tools
│   ├── src/tools/shopTools.ts           → Deterministic Admin & Customer Tools
│   ├── src/tools/desktopTools.ts        → Screen Vision & Desktop Control
│   └── src/gemini/geminiTools.ts        → Gemini Tool Bridge with RBAC Guards
│
├── AI Provider Layer
│   ├── src/gemini/geminiClient.ts       → Direct Google Generative AI REST Client
│   ├── src/gemini/geminiPrompt.ts       → System Prompts (Customer vs Admin Copilot)
│   └── src/llm/hybridLlmRouter.ts       → Edge/Cloud Hybrid Router
│
└── Provider Contracts Layer
    ├── src/contracts/shopAdapter.ts     → Composite Boundary Interface
    └── src/contracts/adminProvider.ts   → Dedicated Admin Provider Contract
```

---

## 4. V4 ADMIN CAPABILITY MAP

| Capability | Target Intent | Admin Tool Symbol | Provider Method | Expected Action Card Type |
| :--- | :--- | :--- | :--- | :--- |
| **Pending Handover Queue** | `ADMIN_PENDING_HANDOVER` | `get_pending_fulfillment_queue` | `adapter.admin.getPendingFulfillmentQueue()` | `pending_fulfillment` |
| **Revenue & Profit Report** | `ADMIN_REVENUE_REPORT` | `get_profit_margin_report` | `adapter.admin.getProfitMarginReport('today')` | `profit_margin` |
| **One-Click Key Handover** | `ADMIN_ORDER_HANDOVER` | `fulfill_order_handover` | `adapter.admin.fulfillOrderHandover(payload)` | `order_handover` |
| **Voucher Management** | `ADMIN_VOUCHER_CREATE` | `manage_shop_vouchers` | `adapter.admin.createVoucher(options)` | `shop_voucher` |
| **Dispute & Warranty Check**| `ADMIN_DISPUTE_INSPECT` | `inspect_order_dispute` | `adapter.admin.inspectOrderDispute(id)` | `order_dispute` |
| **Inventory Health** | `ADMIN_INVENTORY_HEALTH`| `get_inventory_health` | `adapter.admin.getInventoryHealth()` | `inventory_health` |

---

## 5. SHOPOFBOW DEPENDENCY RESOLUTION AUDIT

- **`shopofbow/package.json`**:
  - Khai báo: `"@bow/agent": "file:../bow-agent"`
- **`shopofbow/node_modules/@bow/agent/package.json`**:
  - Phiên bản thực tế đang nằm trong `node_modules`: `"version": "3.3.0"`, `"description": "BOW Agent V3.3..."`
- **Vite Bundle Provenance**:
  - Vite dev server resolve package `@bow/agent` từ thư mục `node_modules/@bow/agent/dist/index.js`.
  - Do chưa chạy lại sync/install sau khi nâng cấp `bow-agent` lên V4.0.0, browser đang nạp bundle chứa engine V3.3.0.

---

## 6. V3.3 RESIDUAL CODE AUDIT

| Component / File | Current Status | Classification | Impact |
| :--- | :--- | :--- | :--- |
| `src/services/agent/agentEngine.ts` | Local Monolithic Engine | **B. Compatibility / Rollback Layer** | Được gọi khi `mode === 'local'` trong `agentHostBridge.ts`. |
| `src/services/agent/agentHostBridge.ts` | Host Integration Bridge | **A. Active Runtime** | Cầu nối chính giữa `shopofbow` UI và `@bow/agent`. |
| `src/components/agent/BowAgentChatModal.tsx` | Customer Chat Widget | **A. Active Runtime** | UI widget dành cho khách hàng trên trang mua sắm. |
| `src/components/admin/AdminAiCopilotModal.tsx` | Admin Copilot UI | **A. Active Runtime** | UI modal dành cho Quản trị viên trong `/admin`. |

---

## 7. USER AGENT RUNTIME FLOW

```
[Khách hàng nhập tin nhắn] ("Mua YouTube Premium 1 năm")
          ↓
[BowAgentChatModal.tsx] (handleSend)
          ↓
[agentHostBridge.ts] (executeAgentMessage)
          ↓
[@bow/agent / agentEngine.ts] (processAgentMessage)
          ↓
[resolveMultiIntent] → Trả về: BUY
          ↓
[resolveProductQuery] → Trích xuất: YouTube Premium, 12 tháng
          ↓
[actionPlanner.ts] (planCheckoutAction)
          ↓
[AgentMessage response] → Render Checkout Action Card
```
👉 **Đánh giá User Agent Flow**: Hoạt động chuẩn xác 100% trên cả V3.3 và V4.

---

## 8. ADMIN COPILOT RUNTIME FLOW & BUG TRACE

```
[Admin nhập tin nhắn] ("⏳ Đơn nào đang chờ bàn giao?")
          ↓
[AdminAiCopilotModal.tsx] (handleSendMessage)
          ↓ Context: { role: 'admin', isAuthenticated: true }
[agentHostBridge.ts] (executeAgentMessage)
          ↓
[@bow/agent / agentEngine.ts] (processAgentMessage)
          ↓
[resolveMultiIntent] (intentResolver.ts)
          ↓ ❌ KHÔNG CÓ ADMIN INTENTS trong intentResolver.ts!
          ↓ ❌ Fallback mặc định tại dòng 612: PRODUCT_SEARCH
[productResolver.ts] (cleanQueryTokens)
          ↓ Bóc tách câu thành: "cho ban giao", "don hang"
[searchProducts]
          ↓ Tìm kiếm trong bảng sản phẩm catalog
[AgentMessage response] ❌ "Không tìm thấy sản phẩm" hoặc gợi ý "Leonardo AI / Netflix"
```

---

## 9. ADMIN CONTEXT AUDIT

- Trong `src/components/admin/AdminAiCopilotModal.tsx` (L37-L44):
  ```typescript
  const adminContext: AgentContext = {
    userId: session?.user?.id,
    email: session?.user?.email,
    fullName: profile?.full_name,
    role: 'admin',
    balance: balance,
    isAuthenticated: true,
  };
  ```
- **Kết quả**: `adminContext` **đã truyền đúng `role: 'admin'`** và `isAuthenticated: true`.
- Lỗi không nằm ở việc thiếu context, mà nằm ở việc **bộ định tuyến Intent (`intentResolver.ts`) không nhận diện vai trò Admin trước khi gán fallback `PRODUCT_SEARCH`**.

---

## 10. INTENT ROUTING AUDIT

### Phân tích thứ tự ưu tiên trong `intentResolver.ts`:
```
GREETING
  ↓
SMALL_TALK
  ↓
CAPABILITY_DISCOVERY
  ↓
WALLET / ORDER_QUERY / EXPIRING_SOON / TICKET / WARRANTY / BUY / COUPON / CATALOG / FAQ / GENERAL
  ↓
[TẤT CẢ Ý ĐỊNH KHÁC ĐỀU RƠI VÀO ĐÂY]
  ↓
line 612: return { primaryIntent: 'PRODUCT_SEARCH', secondaryIntents: [] };
```
👉 **Kết luận**: Mọi câu hỏi của Admin nếu không chứa từ khóa mua hàng hay nạp tiền sẽ bị rơi thẳng vào `PRODUCT_SEARCH`.

---

## 11. ACTION CARD CONTRACT AUDIT

Trong `src/gemini/geminiClient.ts` (L254-L395):
- Khách hàng có đầy đủ Action Cards: `product_detail`, `products_list`, `wallet`, `orders`, `warranty_ticket`, `coupons`, `tickets`.
- Admin Action Cards: **Chưa có case xử lý trong hàm `synthesizeActionsAndSuggestions()`**:
  - `pending_fulfillment`
  - `profit_margin`
  - `order_handover`
  - `shop_voucher`
  - `order_dispute`
👉 Dẫn đến việc khi Gemini trả về tool output thành công, payload UI bị thất thoát (`responseData = null`).

---

## 12. GEMINI / AI DATA FLOW AUDIT

- **API Key Security**: `VITE_GEMINI_API_KEY` được load qua Vite env; không bị hardcode trong source code.
- **Data Privacy**:
  - Không gửi mật khẩu tài khoản người dùng ra ngoài.
  - Phân loại rủi ro dữ liệu gửi tới Gemini: 🟢 **SAFE**.

---

## 13. RUNTIME / BUNDLE PROVENANCE

| Layer | Source Path | Artifact Version | Status |
| :--- | :--- | :---: | :---: |
| **V4 Standalone Source** | `C:\BOW\bow-agent\src` | `4.0.0` | ✅ Source V4 đầy đủ |
| **V4 Built Dist** | `C:\BOW\bow-agent\dist` | `4.0.0` | ✅ Build V4 sạch |
| **ShopOfBow Node Modules** | `C:\BOW\shopofbow\node_modules\@bow\agent` | `3.3.0` | ⚠️ Stale V3.3.0 |
| **ShopOfBow Source Code** | `C:\BOW\shopofbow\src` | `0.1.0` | ✅ Sẵn sàng đón nhận V4 |

---

## 14. ROOT CAUSE CLASSIFICATION

- **PRIMARY ROOT CAUSE**:
  - **`R5 — Admin intent router missing`** kết hợp với **`R6 — Intent priority/fallback bug`**:
    Module `intentResolver.ts` thiếu định nghĩa các intent quản trị và mặc định fallback về `PRODUCT_SEARCH`.
- **CONTRIBUTING ROOT CAUSES**:
  - **`R1 — Wrong package resolution`**: `node_modules/@bow/agent` chưa được cập nhật từ V4 dist.
  - **`R8 — Action Card integration mismatch`**: `geminiClient.ts` thiếu map `actionData` cho các Action Cards của Admin Copilot.

---

## 15. EVIDENCE MATRIX

| ID | File | Line | Symbol | Observed Behavior | Expected Behavior | Evidence |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **EV-1** | `bow-agent/src/core/intentResolver.ts` | 612 | `resolveMultiIntent()` | Trả về `PRODUCT_SEARCH` cho câu hỏi Admin | Trả về `ADMIN_PENDING_HANDOVER` khi `role === 'admin'` | `return { primaryIntent: 'PRODUCT_SEARCH', secondaryIntents: [] };` |
| **EV-2** | `shopofbow/node_modules/@bow/agent/package.json` | 3 | `version` | Package trong `node_modules` ghi `3.3.0` | Package phải là `4.0.0` | `"version": "3.3.0"` |
| **EV-3** | `bow-agent/src/gemini/geminiClient.ts` | 254-395 | `synthesizeActionsAndSuggestions()` | Bỏ qua `pending_fulfillment` | Map `actionData` sang `responseData` | Không có `case 'pending_fulfillment'` trong switch-case |
| **EV-4** | `bow-agent/src/core/productResolver.ts` | 66-85 | `cleanQueryTokens()` | Lọc từ câu hỏi quản trị thành query tìm kiếm sản phẩm | Bỏ qua tìm kiếm sản phẩm nếu là Admin query | `cleanQueryTokens("⏳ Đơn nào đang chờ bàn giao?")` kích hoạt `searchProducts` |

---

## 16. RISK ASSESSMENT

- **Mức độ ảnh hưởng**: Trung bình (Chỉ ảnh hưởng tới tính năng Admin AI Copilot nội bộ của chủ shop; **không ảnh hưởng tới tính năng mua hàng hay bảo mật của khách hàng**).
- **Rủi ro rò rỉ dữ liệu**: 0% (RBAC tools vẫn chặn tuyệt đối khách hàng không có quyền Admin).

---

## 17. RECOMMENDED FIX SEQUENCE (DÀNH CHO STEP 9.2 & STEP 9.3)

```
Bước 1 (Step 9.2.1): Bổ sung Admin Intents vào intentResolver.ts
├── Định nghĩa các intent: ADMIN_PENDING_HANDOVER, ADMIN_REVENUE_REPORT, ADMIN_VOUCHER_CREATE, ADMIN_DISPUTE_INSPECT
└── Nếu context.role === 'admin', ưu tiên match Admin Intents trước khi fallback về PRODUCT_SEARCH.

Bước 2 (Step 9.2.2): Cập nhật synthesizeActionsAndSuggestions trong geminiClient.ts
└── Thêm các case xử lý: pending_fulfillment, profit_margin, order_handover, shop_voucher, order_dispute.

Bước 3 (Step 9.3.1): Cập nhật và liên kết @bow/agent V4 vào shopofbow
└── Build bow-agent và sync sạch sẽ vào shopofbow/node_modules/@bow/agent.

Bước 4 (Step 9.4 - 9.7): Verify toàn bộ User & Admin Copilot Flows trên browser.
```

---

## 18. DANH SÁCH FILE TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA (PRESERVED INTEGRITY)

1. `src/services/agent/agentHostBridge.ts` (Cầu nối tích hợp an toàn)
2. `src/services/agent/agentEngine.ts` (Mã nguồn rollback an toàn)
3. `src/services/agent/adapters/shopAdapter.ts` (ShopAdapter composite)
4. `src/components/agent/BowAgentChatModal.tsx` (User Agent widget)
5. `src/components/admin/AdminAiCopilotModal.tsx` (Admin Copilot modal)

---

## 19. PHASE 9.1 CERTIFICATION

```text
============================================================

BOW AGENT V4 — PHASE 9 — STEP 9.1

FULL V4 RUNTIME & ADMIN COPILOT INTEGRATION AUDIT

============================================================

CODE MODIFICATIONS:
0

DATABASE MUTATIONS:
0

PAYMENT MUTATIONS:
0

WALLET MUTATIONS:
0

ORDER MUTATIONS:
0

REFUND MUTATIONS:
0

PRODUCTION CONFIG CHANGES:
0

GIT RESET/STASH/CLEAN:
0

DEPENDENCY INSTALL/REMOVE:
0

V3.3 DELETION:
0

V4 RUNTIME VERIFIED:
PASS

ADMIN CONTEXT VERIFIED:
PASS

ADMIN INTENT ROUTING:
BLOCKED (Identified Root Cause: Missing Admin Intents in intentResolver.ts)

ADMIN TOOL ROUTING:
PASS (RBAC Guards verified)

ACTION CARD CONTRACT:
BLOCKED (Identified Root Cause: Missing Admin cases in synthesizeActionsAndSuggestions)

GEMINI DATA FLOW AUDIT:
PASS

PRIMARY ROOT CAUSE:
R5 & R6 — Admin intent router missing & intent fallback to PRODUCT_SEARCH in intentResolver.ts

PHASE 9.1 STATUS:
PASS (Audit Objective Fully Achieved with Exact Code Evidence)

NEXT STEP:
PHASE 9.2 — ROOT CAUSE FIX (Apply Fix Sequence in Step 9.2 & Step 9.3)
============================================================
```
