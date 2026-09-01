# BOW AGENT V3.3 — PHASE 7.1 STEP 0
# PRE-EXTRACTION BASELINE & SAFETY SNAPSHOT REPORT

**Report ID:** `BOW-P71-BASELINE-20260901`  
**Phase:** 7.1 Step 0 — Pre-Extraction Baseline & Safety Snapshot  
**Repository Location:** `C:\BOW\shopofbow` (Junction: `C:\Web\shopofbow`)  
**Target Future Package:** `C:\BOW\bow-agent`  
**Downstream Robot Project:** `C:\BOW\bow-robot`  
**Timestamp:** 2026-09-01T14:35:00+07:00  
**Status:** **BASELINE VERIFIED — 100% PASS — EXTRACTION READY**

---

## 1. Executive Summary

This report establishes the complete pre-extraction architectural inventory, dependency graph, coupling map, and safety baseline for **BOW Agent V3.3** prior to any physical extraction into a standalone package (`C:\BOW\bow-agent`).

In strict accordance with the **Phase 7.1 Step 0 Safety Directives**, **ZERO code modifications, file renames, file moves, or deletions** were performed during this step. All validation suites were executed against live, unmodified code.

### Baseline Validation Results:
- **Historical Regression Test Suites:**
  - Phase 6.7 Knowledge Intelligence: **104 / 104 PASS (100%)**
  - Phase 6.8 Knowledge Action Center: **116 / 116 PASS (100%)**
  - Phase 6.9 Governance & Autonomous QA: **128 / 128 PASS (100%)**
  - Phase 7.0 Production Scaling & Safety: **128 / 128 PASS (100%)**
  - **Total Baseline Assertions:** **476 / 476 PASS (0 Failures)**
- **TypeScript Typecheck (`npx tsc -b --noEmit`):** **0 Errors (Exit code 0)**
- **Production Build (`npm run build`):** **Successful in 8.38s (Exit code 0)**

---

## 2. Architectural Inventory (Sections A through O)

### A. Current Architecture
Currently, the BOW Agent is embedded directly inside the monolithic frontend application `shopofbow` (`C:\BOW\shopofbow`). It executes primarily in the browser runtime (Vite + React 18), communicating with:
1. **Supabase PostgreSQL & Realtime**: Direct client-side SDK calls (`@supabase/supabase-js`) for catalog, orders, tickets, FAQs, negative policies, and `agent_analytics_events`.
2. **Upstream Gemini LLM**: Dual-path routing — direct via `@google/generative-ai` in browser when configured, or proxied through `api/agent-gemini.ts` (Vercel serverless function).
3. **Shop Frontend UI**: Dispatches actions that open client modals (`CheckoutModal`, `UserOrderDetailModal`, `DepositModal`, `CreateTicketModal`).

### B. Agent-Related Directories
- `src/services/agent/`: Core orchestrator, intent resolvers, action planners, tools, response formatters.
- `src/services/agent/gemini/`: Gemini client, tools declaration bridge, prompt definitions, config.
- `src/services/agent/knowledge/`: Knowledge gap detector, review service, negative policies, drift service, anomaly detector, autonomous QA runner, alert manager, action center, intelligence service, governance service.
- `src/services/agent/monitoring/`: Event store (`agentEvents.ts`), analytics dispatcher (`agentAnalytics.ts`), PII sanitizer, demand aggregator, types.
- `src/services/agent/production/`: Production telemetry sliding buffer, SLO evaluator, circuit breaker, graceful fallback generator, progressive rollout controller, rollback engine, capacity guard, incident manager, health scoring.
- `src/components/agent/`: `BowAgentChatModal.tsx` (Customer chat UI).
- `src/pages/admin/components/`: `ProductionControlCenter.tsx` (Admin SRE dashboard).
- `src/pages/admin/analytics/`: `AgentDemandTab.tsx`, `AgentEventsTab.tsx`, `SessionForensicDrawer.tsx`.
- `api/agent-gemini.ts`: Serverless proxy function.

### C. Shop-Related Directories
- `src/pages/`: Customer and admin shop pages (`Home`, `Products`, `Orders`, `Dashboard`, `Checkout`, `Auth`, `Reviews`, `Tickets`, `Settings`, `Coupons`, `Affiliates`, `Users`, `AuditLogs`).
- `src/components/`: Shop UI components (`Header`, `Footer`, `CheckoutModal`, `OrderDeliveredModal`, `OrderRenewalModal`, `ReviewModal`, `Toast`, `AppLogo`).
- `src/context/`: `AuthContext.tsx`, `FavoritesContext.tsx`.
- `src/data/`: `catalog.ts` (Local catalog helpers and formatting).
- `src/hooks/`: Custom React hooks (`useTheme`, `useDebounce`, etc.).
- `src/lib/`: `supabase.ts` (Shared Supabase client instance).
- `api/`: Shop serverless functions (`cron-expiry.ts`, `email-notify.ts`, `sepay-webhook.ts`, `telegram-notify.ts`, `upload.ts`).

### D. Shared Infrastructure
- TypeScript configuration: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`.
- Bundler & Dev Server: Vite 5.4.8 with React plugin and dev proxy middlewares.
- Package Manager & Runtime: Node.js, npm, `@types/node`.
- TailwindCSS 3.4.13 with PostCSS and Autoprefixer.

### E. Supabase Dependencies
The embedded agent directly accesses Supabase via `import { supabase } from '../../lib/supabase'` across exactly 9 files:
1. `src/services/agent/tools.ts`: Queries `products`, `plans`, `orders`, `categories`, `coupons`, `wallets`, `tickets`, `faqs`.
2. `src/services/agent/categoryResolver.ts`: Queries `categories`.
3. `src/services/agent/monitoring/agentEvents.ts`: Inserts and selects from `agent_analytics_events`.
4. `src/services/agent/knowledge/knowledgeReviewService.ts`: Queries and updates `faqs`.
5. `src/services/agent/knowledge/negativePolicyService.ts`: Queries `negative_policies`.
6. `src/services/agent/knowledge/knowledgeIntelligenceService.ts`: Reads `faqs` and `negative_policies`.
7. `src/services/agent/knowledge/knowledgeGovernanceService.ts`: Reads `faqs` and `negative_policies`.
8. `src/services/agent/knowledge/knowledgeDriftService.ts`: Reads `faqs` and `negative_policies`.
9. `src/services/agent/knowledge/knowledgeActionService.ts`: Reads `faqs` and `negative_policies`.

### F. Environment Dependencies
- `VITE_GEMINI_API_KEY` / `GEMINI_API_KEY`: API key for upstream Gemini LLM.
- `GEMINI_MODEL_NAME`: Target model (defaults to `gemini-2.0-flash`).
- `VITE_SUPABASE_URL` / `SUPABASE_URL`: Supabase endpoint URL.
- `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`: Client access token.
- `import.meta.env.DEV`: Debug logging flags.

### G. Browser / UI Dependencies
- `BowAgentChatModal.tsx`: React hooks (`useState`, `useEffect`, `useRef`), Tailwind CSS classes, Lucide/custom SVG icons.
- Window events & DOM: `window.dispatchEvent` for opening shop modals (`OPEN_CHECKOUT_MODAL`, `OPEN_DEPOSIT_MODAL`, etc.).

### H. Node / Server Dependencies
- `api/agent-gemini.ts`: `@vercel/node`, `@google/generative-ai`.
- Offline QA scripts in `scratch/`: `node --env-file=.env ./node_modules/tsx/dist/cli.mjs`.

### I. Agent → Shop Coupling Points
1. **Catalog & Plan Invariants**: Hardcoded prices and plan IDs for YouTube (`35.000đ`, `280.000đ`, `450.000đ`), Spotify, etc. inside `intentResolver.ts` and `productResolver.ts`.
2. **Action Dispatching**: `actionPlanner.ts` outputs `AgentActionType` enum matching shop modal triggers (`NAVIGATE_CHECKOUT`, `NAVIGATE_ORDER_DETAIL`, `NAVIGATE_DEPOSIT`, `NAVIGATE_TICKET`).
3. **Database Schema Assumptions**: Direct knowledge of table column names (`products.starting_price`, `orders.payment_code`, `wallets.balance`).

### J. Shop → Agent Coupling Points
1. **Header & Floating Widget**: `Header.tsx` or `App.tsx` renders `<BowAgentChatModal />`.
2. **Checkout Event Tracking**: `CheckoutModal.tsx` imports `agentAnalytics` and `getSessionContext` to track checkout conversion lifecycle.
3. **Admin Knowledge & SRE Hub**: `KnowledgeHub.tsx` imports `ProductionControlCenter`, `runKnowledgeQaSuite`, `getIntelligenceDashboardSummary`, `getGovernanceDashboardSummary`, `acknowledgeAlert`, etc.
4. **Admin Analytics Dashboard**: `AgentAnalytics.tsx`, `AgentDemandTab.tsx`, `AgentEventsTab.tsx` import analytics types and event aggregation methods.

### K. Existing Tests
- `scratch/test_phase6_7_knowledge_intelligence.ts` (104 assertions)
- `scratch/test_phase6_8_action_center.ts` (116 assertions)
- `scratch/test_phase6_9_governance.ts` (128 assertions)
- `scratch/test_phase7_0_production.ts` (128 assertions)
- Historical test suites: `test_phase6_0` through `test_phase6_6`, `test_v3_1`, `test_v3_2`, `test_v3_3`.

### L. Existing Reports
- 24 chronological architecture reports stored in `reports/agent-v3/`:
  - `PHASE_6_0_PRODUCTION_OBSERVABILITY_REPORT.md`
  - `PHASE_6_6_NEGATIVE_POLICY_REPORT.md`
  - `PHASE_6_7_KNOWLEDGE_INTELLIGENCE_REPORT.md`
  - `PHASE_6_8_ACTION_CENTER_REPORT.md`
  - `PHASE_6_9_GOVERNANCE_REPORT.md`
  - `PHASE_7_0_PRODUCTION_REPORT.md`

### M. Current Build / Typecheck Status
- `npx tsc -b --noEmit` &rarr; **0 compilation errors (Exit code 0)**.
- `npm run build` &rarr; **Built in 8.38s with Vite (Exit code 0)**.

### N. Current Production Invariants
1. **Zero Auto-Mutation**: Agent never writes or modifies FAQs, policies, or catalog items without explicit human Admin action.
2. **Transaction Boundary**: Purchase and deposit queries route strictly to transaction handlers; never intercepted by knowledge gap detection or circuit breaking.
3. **Duration Invariant**: 1m, 6m, 12m durations are parsed distinctly; YouTube pricing is strictly 35k/280k/450k.
4. **Product Demand Boundary**: Non-catalog requests (e.g. "Canva Pro") route to `PRODUCT_DEMAND`; zero auto-creation of product records.
5. **Warranty Boundary**: Cancelled/disputed orders receive in-place text confirmation with exactly 1 ticket icon `🎫`, zero action modals.
6. **Negative Policy Loop Prevention**: Negative policy matches classify as `SUPPORTED_NEGATIVE_POLICY`, preventing gap creation loops.
7. **Zero Synchronous Telemetry Overhead**: Metric recording executes via asynchronous microtasks (0.00ms synchronous latency).
8. **Hard Cap Rule**: Any invariant failure strictly caps the Health Score at max 40 and forces status to `CRITICAL`.

### O. Risks for Extraction
1. **Direct Supabase Imports**: 9 files import `{ supabase } from '../../lib/supabase'`. If moved without an adapter interface, queries will break.
2. **Client-Side Event Dispatching**: Modals rely on custom browser window events; standalone package must use clean callbacks or action interfaces.
3. **Shared Type Leaks**: Types in `analyticsTypes.ts` are consumed by both Admin UI components and Agent core.
4. **Directory Junction on Windows**: Both `C:\BOW\shopofbow` and `C:\Web\shopofbow` point to the same filesystem; paths must remain consistent.

---

## 3. Classification of Discovered Files (Categories A through J)

| Category | Description | File Paths |
| :--- | :--- | :--- |
| **CATEGORY A: Pure Agent Core** | Domain logic, pipeline orchestration, intent resolution, prompt definitions, session memory | - `src/services/agent/agentEngine.ts`<br>- `src/services/agent/intentResolver.ts`<br>- `src/services/agent/sessionContext.ts`<br>- `src/services/agent/types.ts`<br>- `src/services/agent/responseFormatter.ts`<br>- `src/services/agent/permissions.ts`<br>- `src/services/agent/gemini/geminiClient.ts`<br>- `src/services/agent/gemini/geminiPrompt.ts`<br>- `src/services/agent/gemini/config.ts` |
| **CATEGORY B: Agent Knowledge** | Gap detection, review workflow, negative policies, intelligence | - `src/services/agent/knowledge/knowledgeGapDetector.ts`<br>- `src/services/agent/knowledge/knowledgeGapAggregator.ts`<br>- `src/services/agent/knowledge/negativePolicyService.ts`<br>- `src/services/agent/knowledge/knowledgeReviewService.ts`<br>- `src/services/agent/knowledge/knowledgeIntelligenceService.ts` |
| **CATEGORY C: Agent Governance** | Drift analysis, autonomous QA runner, anomaly detection, alert management, action center | - `src/services/agent/knowledge/knowledgeGovernanceService.ts`<br>- `src/services/agent/knowledge/knowledgeDriftService.ts`<br>- `src/services/agent/knowledge/knowledgeQaService.ts`<br>- `src/services/agent/knowledge/knowledgeAnomalyService.ts`<br>- `src/services/agent/knowledge/knowledgeAlertService.ts`<br>- `src/services/agent/knowledge/knowledgeActionService.ts` |
| **CATEGORY D: Agent Production Runtime** | Telemetry buffer, SLO evaluation, circuit breaker, fallback, rollout, rollback, capacity, incidents, health score | - `src/services/agent/production/productionTelemetryService.ts`<br>- `src/services/agent/production/productionSloService.ts`<br>- `src/services/agent/production/productionCircuitBreaker.ts`<br>- `src/services/agent/production/productionFallbackService.ts`<br>- `src/services/agent/production/productionRolloutService.ts`<br>- `src/services/agent/production/productionRollbackService.ts`<br>- `src/services/agent/production/productionCapacityService.ts`<br>- `src/services/agent/production/productionIncidentService.ts`<br>- `src/services/agent/production/productionHealthService.ts` |
| **CATEGORY E: Agent Tools / Actions** | Tool schemas, action synthesis, action parameter validation | - `src/services/agent/actionPlanner.ts`<br>- `src/services/agent/actionValidator.ts`<br>- `src/services/agent/gemini/geminiTools.ts` |
| **CATEGORY F: Shop-Specific Adapters** | Catalog fuzzy matching, plan resolution, order warranty retrieval | - `src/services/agent/productResolver.ts`<br>- `src/services/agent/categoryResolver.ts`<br>- `src/services/agent/tools.ts` |
| **CATEGORY G: Supabase / Data Adapters** | Direct database client queries and analytics table writes | - `src/services/agent/monitoring/agentEvents.ts`<br>- `src/services/agent/monitoring/agentAnalytics.ts`<br>- `src/services/agent/monitoring/demandAggregator.ts` |
| **CATEGORY H: UI / Admin-Specific Code** | React components, modals, tabs, and dashboard views | - `src/components/agent/BowAgentChatModal.tsx`<br>- `src/pages/admin/components/ProductionControlCenter.tsx`<br>- `src/pages/admin/KnowledgeHub.tsx`<br>- `src/pages/admin/AgentAnalytics.tsx`<br>- `src/pages/admin/analytics/AgentDemandTab.tsx`<br>- `src/pages/admin/analytics/AgentEventsTab.tsx`<br>- `src/pages/admin/analytics/SessionForensicDrawer.tsx` |
| **CATEGORY I: Shared Utilities** | Event definitions, sanitizers, serverless proxies | - `src/services/agent/monitoring/analyticsTypes.ts`<br>- `src/services/agent/monitoring/analyticsSanitizer.ts`<br>- `api/agent-gemini.ts` |
| **CATEGORY J: Unknown / Requires Review** | Documentation, historical declaration, backup files | - `src/services/agent/README.md`<br>- `src/services/agent/V2.1-FROZEN.md`<br>- `src/pages/admin/KnowledgeHub.backup.tsx` |

---

## 4. Target Architecture (`shopofbow` &rarr; `bow-agent` &rarr; `bow-robot`)

The goal of future phases is to decouple the agent into a standalone, autonomous intelligence layer:

```
+-------------------------------------------------------------+
|                      C:\BOW\shopofbow                       |
|                 (E-commerce Web Application)                |
+-------------------------------------------------------------+
                              |
                              | ShopAdapter (Catalog, Orders, Wallets)
                              v
+-------------------------------------------------------------+
|                      C:\BOW\bow-agent                       |
|                  (Autonomous Intelligence Core)             |
|                                                             |
|  +---------------------+  +-------------------------------+ |
|  | AI Runtime Pipeline |  | Knowledge & Governance Engine | |
|  +---------------------+  +-------------------------------+ |
|  | Production Runtime  |  | Memory & Session Context      | |
|  | (Circuit/SLO/Scale) |  |                               | |
|  +---------------------+  +-------------------------------+ |
|  | Tools & Actions     |  | Computer Control Abstraction  | |
|  +---------------------+  +-------------------------------+ |
+-------------------------------------------------------------+
                              |
                              | RobotAdapter (Hardware, Actuators, Telemetry)
                              v
+-------------------------------------------------------------+
|                      C:\BOW\bow-robot                       |
|             (Robotics Hardware & Embedded Control)          |
|                                                             |
|   Sensors | Motors | Camera | Microphone | Speaker | Actuator|
+-------------------------------------------------------------+
```

---

## 5. Extraction Strategy & Risk Assessment

### Files Safe to Extract First:
1. **Category D (Production Runtime)**: All 9 files in `src/services/agent/production/` have **zero** Supabase imports and **zero** shop dependencies. They are pure runtime utilities and can be extracted with zero risk.
2. **Category A (Core Logic)**: `sessionContext.ts`, `responseFormatter.ts`, `permissions.ts`, `intentResolver.ts`, `geminiPrompt.ts`, `config.ts` have no database coupling.
3. **Category C (Governance)**: `knowledgeAnomalyService.ts`, `knowledgeAlertService.ts`, `knowledgeQaService.ts` have no direct database dependencies.

### Files Unsafe to Extract Yet (Require Interface Abstraction):
1. **Category F (`tools.ts`, `productResolver.ts`, `categoryResolver.ts`)**: Tightly coupled to shop catalog schemas and Supabase client.
2. **Category G (`agentEvents.ts`, `agentAnalytics.ts`)**: Direct database write operations to `agent_analytics_events`.
3. **Category B (`knowledgeReviewService.ts`, `negativePolicyService.ts`)**: Direct writes/reads to `faqs` and `negative_policies`.

### Recommended Extraction Order:
- **Phase 7.1 Step 1**: Define abstract storage and shop provider interfaces (`StorageAdapter`, `CatalogProvider`, `ActionHandler`).
- **Phase 7.1 Step 2**: Extract Category D (Production Runtime) and Category I (Types & Sanitizers) into `C:\BOW\bow-agent`.
- **Phase 7.1 Step 3**: Extract Category A (Pure Core) and Category E (Tools Schemas).
- **Phase 7.1 Step 4**: Extract Category C (Governance & QA) and Category B (Knowledge).
- **Phase 7.1 Step 5**: Implement `ShopAdapter` in `shopofbow` fulfilling the agent interfaces.
- **Phase 7.1 Step 6**: Run end-to-end regression validation (476/476 assertions).

### Risk Level:
**MODERATE-HIGH** if attempted in a single monolithic refactor.  
**LOW** if performed strictly via incremental interface-driven extraction using the recommended order above.
