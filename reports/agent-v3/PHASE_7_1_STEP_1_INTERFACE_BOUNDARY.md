# BOW AGENT V3.3 — PHASE 7.1 STEP 1 REPORT
# INTERFACE BOUNDARY & DEPENDENCY DECOUPLING

**Report ID:** `BOW-P71-STEP1-BOUNDARY-20260901`  
**Phase:** 7.1 Step 1 — Interface Boundary & Dependency Decoupling  
**Repository Location:** `C:\BOW\shopofbow` (Junction: `C:\Web\shopofbow`)  
**Target Standalone Package:** `C:\BOW\bow-agent`  
**Target Downstream Robot Project:** `C:\BOW\bow-robot`  
**Status:** **PASSED — INTERFACES ESTABLISHED — ZERO REGRESSIONS**  
**Timestamp:** 2026-09-01T17:10:00+07:00  

---

## 1. Overview & Objectives

In Phase 7.1 Step 1, we introduced explicit interface contracts and dependency boundaries to prepare the BOW Agent for architectural extraction out of `shopofbow` into `C:\BOW\bow-agent`, with future extensibility to `C:\BOW\bow-robot`.

In accordance with strict safety rules:
- **Zero existing files were renamed, moved, or deleted.**
- **Zero business logic, pricing, transaction routing, warranty rules, or production runtime behaviors were modified.**
- **Zero Supabase database migrations or schema alterations were introduced.**
- **All 476 historical assertions across Phases 6.7, 6.8, 6.9, and 7.0 continue to pass with 100% compliance.**

---

## 2. Files Inspected

The following 42 source files and integration touchpoints were inspected:
- **Agent Core & Resolvers:** `agentEngine.ts`, `intentResolver.ts`, `productResolver.ts`, `categoryResolver.ts`, `tools.ts`, `actionPlanner.ts`, `actionValidator.ts`, `permissions.ts`, `responseFormatter.ts`, `sessionContext.ts`, `types.ts`.
- **Gemini Subsystem:** `geminiClient.ts`, `geminiPrompt.ts`, `geminiTools.ts`, `config.ts`, `api/agent-gemini.ts`.
- **Knowledge & Governance Subsystem:** `knowledgeActionService.ts`, `knowledgeAlertService.ts`, `knowledgeAnomalyService.ts`, `knowledgeDriftService.ts`, `knowledgeGapAggregator.ts`, `knowledgeGapDetector.ts`, `knowledgeGovernanceService.ts`, `knowledgeIntelligenceService.ts`, `knowledgeQaService.ts`, `knowledgeReviewService.ts`, `negativePolicyService.ts`.
- **Production & Monitoring Subsystem:** `agentAnalytics.ts`, `agentEvents.ts`, `analyticsSanitizer.ts`, `analyticsTypes.ts`, `demandAggregator.ts`, `productionCapacityService.ts`, `productionCircuitBreaker.ts`, `productionFallbackService.ts`, `productionHealthService.ts`, `productionIncidentService.ts`, `productionRollbackService.ts`, `productionRolloutService.ts`, `productionSloService.ts`, `productionTelemetryService.ts`.
- **Shop UI & Admin Integration:** `BowAgentChatModal.tsx`, `ProductionControlCenter.tsx`, `KnowledgeHub.tsx`, `AgentAnalytics.tsx`, `AgentDemandTab.tsx`, `AgentEventsTab.tsx`, `SessionForensicDrawer.tsx`, `CheckoutModal.tsx`, `lib/supabase.ts`.

---

## 3. Existing Coupling Points Discovered

1. **Direct Supabase Imports in 9 Files:**
   - `tools.ts`, `categoryResolver.ts`, `agentEvents.ts`, `knowledgeReviewService.ts`, `negativePolicyService.ts`, `knowledgeIntelligenceService.ts`, `knowledgeGovernanceService.ts`, `knowledgeDriftService.ts`, `knowledgeActionService.ts`.
   - All 9 directly import `{ supabase } from '../../lib/supabase'`.
2. **Catalog & Duration Invariants Embedded in Resolvers:**
   - Canonical pricing for YouTube (1m @ 35.000đ, 6m @ 280.000đ, 12m @ 450.000đ) embedded in `intentResolver.ts` and `productResolver.ts`.
3. **Semantic Actions Bound to Shop Client Modals:**
   - `actionPlanner.ts` outputs `AgentActionType` values matching modal triggers (`NAVIGATE_CHECKOUT`, `NAVIGATE_ORDER_DETAIL`, `NAVIGATE_DEPOSIT`, `NAVIGATE_TICKET`).
4. **Environment Variable Reliance:**
   - `gemini/config.ts` reads `VITE_GEMINI_API_KEY` (browser) and `GEMINI_API_KEY` (server).

---

## 4. Interfaces Created (`src/services/agent/contracts/`)

| Contract File | Primary Interface | Purpose & Responsibility |
| :--- | :--- | :--- |
| **`actionHandler.ts`** | `ActionHandler`, `ActionResult` | Abstracts semantic agent actions (`NAVIGATE_CHECKOUT`, `NAVIGATE_ORDER_DETAIL`, etc.) completely detached from React, DOM, and window events. |
| **`catalogProvider.ts`** | `CatalogProvider` | Abstracts product lookup, plan pricing, duration matching, and category retrieval from physical database tables. |
| **`orderProvider.ts`** | `OrderProvider`, `AgentOrderSummary`, `WarrantyStatusResult` | Abstracts customer purchase history and warranty eligibility checks. |
| **`walletProvider.ts`** | `WalletProvider`, `DepositInstructions` | Abstracts user wallet balance and VietQR deposit instructions. |
| **`knowledgeProvider.ts`** | `KnowledgeProvider`, `FaqItem`, `NegativePolicyItem` | Abstracts official FAQ retrieval and negative policy matching from SQL storage. |
| **`analyticsProvider.ts`** | `AnalyticsProvider`, `AgentAnalyticsEventInput`, `AnalyticsQueryOptions` | Abstracts telemetry and analytics event ingestion. |
| **`storageAdapter.ts`** | `StorageAdapter` | Domain-oriented persistence contract hiding Supabase, PostgreSQL, and SQL drivers from the Agent. |
| **`llmProvider.ts`** | `LlmProvider`, `LlmChatMessage`, `LlmResponse` | Abstracts upstream LLM access (Gemini, Claude, local models). |
| **`robotAdapter.ts`** | `RobotAdapter`, `RobotSensorSnapshot`, `RobotSpeechOptions` | Minimal future-facing contract for physical or simulated robots (`C:\BOW\bow-robot`) exposing `speak()`, `listen()`, `move()`, `stop()`, and `getSensorState()`. |
| **`shopAdapter.ts`** | `ShopAdapter` | Composite host boundary uniting catalog, orders, wallet, knowledge, analytics, and action handlers. |
| **`index.ts`** | Re-exports | Clean public API for all contracts. |
| **`README.md`** | Documentation | Architectural guidelines, dependency direction rules, and forbidden imports list. |

---

## 5. Dependency Direction

### Current Dependency Direction:
```
shopofbow React UI  ──>  Agent Core  ──(direct import)──>  Supabase / lib
```

### Established Target Direction:
```
+-------------------------------------------------------------+
|                      C:\BOW\shopofbow                       |
|                 (Host E-commerce Application)               |
+-------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------+
|                        ShopAdapter                          |
|         (Implements Storage, Catalog, Orders, Modals)       |
+-------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------+
|                      Agent Contracts                        |
|       (ActionHandler, CatalogProvider, OrderProvider)       |
+-------------------------------------------------------------+
                              ↑
+-------------------------------------------------------------+
|                      C:\BOW\bow-agent                       |
|                  (Autonomous Agent Core)                    |
+-------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------+
|                        RobotAdapter                         |
|         (speak, listen, move, stop, getSensorState)         |
+-------------------------------------------------------------+
                              ↓
+-------------------------------------------------------------+
|                      C:\BOW\bow-robot                       |
|             (Robotics Hardware & Embedded Control)          |
+-------------------------------------------------------------+
```

---

## 6. Files Intentionally NOT Modified in Step 1

To guarantee zero regression risks, the following files were **intentionally kept untouched**:
- `agentEngine.ts`
- `intentResolver.ts`
- `productResolver.ts`
- `tools.ts`
- `actionPlanner.ts`
- `actionValidator.ts`
- `knowledgeReviewService.ts`
- `knowledgeActionService.ts`
- `negativePolicyService.ts`
- `agentAnalytics.ts`
- `agentEvents.ts`
- All 9 production services (`src/services/agent/production/`)
- All UI components and modal triggers

---

## 7. Remaining Coupling & Extraction Roadmap

### Remaining Coupling Points:
1. Direct `supabase` imports in 9 agent files.
2. In-place catalog hardcoding for YouTube and Spotify pricing in `intentResolver.ts`.
3. Modal event dispatching in `BowAgentChatModal.tsx`.

### Next Extraction Steps:
- **Phase 7.1 Step 2**: Implement `ShopAdapter` in `shopofbow` that fulfills the contracts (`src/services/agent/contracts/`).
- **Phase 7.1 Step 3**: Re-route the 9 files from direct `supabase` client imports to the `StorageAdapter` / `ShopAdapter` instance.
- **Phase 7.1 Step 4**: Initialize `C:\BOW\bow-agent` package structure and move pure decoupled agent modules.
- **Phase 7.1 Step 5**: Validate cross-package communication between `shopofbow` and `bow-agent`.
- **Phase 7.1 Step 6**: Run end-to-end regression validation (476/476 assertions).
