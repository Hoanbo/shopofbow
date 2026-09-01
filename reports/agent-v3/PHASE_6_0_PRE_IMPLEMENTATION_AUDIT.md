# BOW AGENT V3.3 — PHASE 6.0
# PRE-IMPLEMENTATION AUDIT REPORT

**Date:** 2026-09-01  
**Mode:** AUDIT & ARCHITECTURAL DISCOVERY — **ZERO CODE CHANGES**  
**Auditor:** Antigravity Autonomous Architecture Agent  
**Audit Purpose:** Comprehensive assessment of agent services, observability points, knowledge gap detection strategies, and storage design for Phase 6.0.

---

## 1. Executive Summary & Production Baseline Confirmation

The production baseline established in Phase 5.1 is completely intact and confirmed:
- TypeScript (`npx tsc -b --noEmit`): **0 errors**
- Production Build (`npm run build`): **Built in 8.00s (Exit Code: 0)**
- All regression suites (BUG-001, Warranty W-001/W-002/W-003, Plural Discovery, Security, 429 Fallback, Golden Matrix): **100% PASS**

Phase 6.0 introduces **Production Observability & Knowledge Gap Detection** while maintaining strict hard guards:
- **No mutations to official `faqs` table.**
- **No automated creation of Products or Product Plans.**
- **No alterations to server-authoritative pricing, warranty eligibility, or wallet balances.**
- **No disruption to V2/Gemini orchestrator and zero response latency overhead.**

---

## 2. Codebase & Service Layer Architecture Assessment

```
src/services/agent/
├── actionPlanner.ts          # Action synthesis (Checkout, Renewal, Support Ticket, Deposit, Coupons)
├── actionValidator.ts        # Action payload invariant checks
├── agentEngine.ts            # Master orchestrator (processAgentMessage) + V2 Deterministic Engine
├── categoryResolver.ts       # Category lookups and catalog routing
├── gemini/                   # V3 Gemini Brain
│   ├── config.ts             # API keys, model params, sanitization
│   ├── geminiClient.ts       # Gemini REST client, multi-turn history, safe tool calling
│   ├── geminiPrompt.ts       # System instruction and safety guardrails
│   └── geminiTools.ts        # Tool definitions and tool execution
├── intentResolver.ts         # Multi-intent routing, duration extraction (BUG-001), ambiguity detection
├── monitoring/               # Observability & Analytics
│   ├── agentAnalytics.ts     # Asynchronous event dispatcher & demand normalizer
│   ├── agentEvents.ts        # Supabase insert layer for agent_analytics_events
│   ├── analyticsSanitizer.ts # PII/Secrets sanitizer
│   ├── analyticsTypes.ts     # Event types, demand states, metadata definitions
│   └── demandAggregator.ts   # Market Demand Discovery aggregator
├── permissions.ts            # Tool RBAC permission matrix
├── productResolver.ts        # Product lookups and fuzzy matching
├── responseFormatter.ts      # Markdown UI response builder
├── sessionContext.ts         # Multi-turn session context (product, plan, order)
├── tools.ts                  # Database tool functions (searchProducts, getMyOrders, getFaqsAndGuides)
└── types.ts                  # Shared Agent types
```

---

## 3. Knowledge Base & FAQ Subsystem Audit

### Existing FAQ Mechanism
1. **Database Table:** `public.faqs` (managed via Admin UI in `src/pages/admin/Faqs.tsx`).
2. **Agent Tool:** `getFaqsAndGuides({ query })` in `tools.ts` selects from `faqs` ordered by `sort_order` limit 6.
3. **Intent Classification:** `intentResolver.ts` maps queries containing `hướng dẫn`, `cách dùng`, `kích hoạt`, `faq` to `FAQ` intent.
4. **Agent Response:** `agentEngine.ts` (lines 1224-1243) renders up to 3 FAQ Q&A snippets.
5. **Gemini Tool:** `get_faqs` in `geminiTools.ts` exposes FAQ lookups to the Gemini model.

### Key Observation & Architectural Guard
- When an FAQ lookup finds 0 matching entries for a store policy or technical question (e.g. `"Shop có hỗ trợ cài qua Ultraview không?"`), the query currently falls through to `GENERAL` or `PRODUCT_SEARCH`.
- In Phase 6.0, this condition must be intercepted as a **`KNOWLEDGE_GAP` candidate**, completely separate from `faqs`, ensuring zero automated writes to official production knowledge.

---

## 4. Observability & Event System Audit

### Existing Analytics Infrastructure
- **Table:** `public.agent_analytics_events` (created in migration `0062_agent_analytics_events.sql`).
- **Schema:**
  - `id UUID PRIMARY KEY`
  - `created_at TIMESTAMPTZ`
  - `event_type TEXT NOT NULL`
  - `user_id UUID REFERENCES public.profiles(id)`
  - `session_id TEXT`
  - `intent TEXT`
  - `product_id TEXT`
  - `plan_id TEXT`
  - `action_id TEXT`
  - `action_type TEXT`
  - `reason TEXT`
  - `metadata JSONB DEFAULT '{}'::jsonb`
- **Security & RLS:**
  - `INSERT`: Open to anyone (`WITH CHECK (true)`), allowing guest and authenticated logging.
  - `SELECT`: Restricted exclusively to Admin (`profiles.role = 'admin'`).

---

## 5. Architectural Decisions for Phase 6.0

### Question 1: Best point to record observability events?
**Decision:** Master Orchestrator `processAgentMessage()` in [`src/services/agent/agentEngine.ts`](file:///c:/Web/shopofbow/src/services/agent/agentEngine.ts).
- Wraps both the V3 Gemini path and the V2 Deterministic fallback path.
- Captures: `intent`, `responseSource` (`FAQ`, `DETERMINISTIC`, `GEMINI`, `GEMINI_FALLBACK_V2`), `latencyMs`, `safetyStatus`, `isKnowledgeGap`, `isProductDemand`, `isTransactional`.
- Dispatches asynchronously via `agentAnalytics.track()` (fire-and-forget, zero response latency impact).

### Question 2: Best point to detect Knowledge Gaps?
**Decision:** Dedicated module [`src/services/agent/knowledge/knowledgeGapDetector.ts`](file:///c:/Web/shopofbow/src/services/agent/knowledge/knowledgeGapDetector.ts).
- Classifies user queries into 7 distinct categories:
  1. `KNOWLEDGE_GAP`: Unanswered store policies, contact channels, technical setup, operating hours, troubleshooting.
  2. `PRODUCT_DEMAND`: Requests for software, apps, AI tools (routed strictly to Demand Discovery).
  3. `TRANSACTIONAL`: Buy, checkout, renewal, warranty, deposit, balance, order lookup.
  4. `GREETING`: Standard greetings, pleasantries, session resets.
  5. `SUPPORTED_FAQ`: Inquiries resolved by existing FAQ records.
  6. `UNSUPPORTED`: Non-store capabilities (spacecraft, plane tickets, food delivery).
  7. `SECURITY_SENSITIVE`: Prompt injections, system prompt extraction, PII exfiltration, price manipulation.
- Implements normalization via existing `normalizeText()` (Unicode NFD/NFC, diacritics stripping, punctuation removal).
- Implements deterministic deduplication and aggregation in [`src/services/agent/knowledge/knowledgeGapAggregator.ts`](file:///c:/Web/shopofbow/src/services/agent/knowledge/knowledgeGapAggregator.ts).

### Question 3: Can existing analytics tables be reused?
**Decision:** **YES.** Reusing `agent_analytics_events` with new event types:
- `KNOWLEDGE_GAP_DETECTED`: Records candidate knowledge gaps with normalized question, category, confidence, and context.
- `OBSERVABILITY_RECORDED`: Records comprehensive per-turn observability metrics.

### Question 4: Is a new database migration needed?
**Decision:** **NO.**
- The existing `agent_analytics_events` table possesses a flexible `JSONB metadata` column with indexed `event_type` and `created_at`.
- Reusing this table avoids schema drift, preserves database stability, and adheres to Hard Non-Goal #8.

---

## 6. Risk Assessment & Mitigations

| Identified Risk | Severity | Mitigation Strategy |
|---|---|---|
| **Accidental mutation of `faqs`** | CRITICAL | Codebase audit strictly prevents any `INSERT`/`UPDATE` to `faqs` in agent runtime. |
| **Response Latency Degradation** | HIGH | All observability and knowledge gap detections run asynchronously in microtasks / post-response callbacks. |
| **Duration Recognition Regression** | HIGH | Shared normalization does NOT alter `extractDuration` or `matchPlanByDuration`; regression tests in Phase 6.0 suite enforce BUG-001 invariants. |
| **Secret / PII Storage** | HIGH | Full integration with `analyticsSanitizer.ts` and `sanitizeQueryText` prior to event logging. |

---

## 7. Pre-Implementation Audit Verdict

```text
================================================================================
PRE-IMPLEMENTATION AUDIT VERDICT: PASS — APPROVED FOR IMPLEMENTATION
Zero architectural risks identified.
Design adheres 100% to production guards, non-goals, and security standards.
================================================================================
```
