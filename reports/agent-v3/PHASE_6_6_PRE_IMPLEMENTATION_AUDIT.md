# BOW AGENT V3.3 — PHASE 6.6
# PRE-IMPLEMENTATION AUDIT REPORT: REJECT & REMEMBER DECISION + NEGATIVE FAQ/POLICY + KNOWLEDGE GAP LOOP PREVENTION

**Date:** 2026-09-01  
**Mode:** AUDIT & ARCHITECTURAL DESIGN  
**Target:** Reject & Remember Decision, Negative Policy Resolver, Knowledge Gap Loop Prevention, Conflict Detection & Authorization  
**Auditor:** Antigravity Autonomous Architecture & Knowledge Operations Agent

---

## 1. Executive Summary & Problem Analysis

In the current Phase 6.0 → 6.5 pipeline:
When Admin rejects a Knowledge Gap (e.g. `"Shop có hỗ trợ cài app X không?"`), the event is recorded as `KNOWLEDGE_GAP_REJECTED`. However, if another user (or the same user) asks the same question later, because there is no official FAQ in `public.faqs`, the detector encounters a miss and classifies it again as `KNOWLEDGE_GAP`, creating a repetitive **Knowledge Gap Loop**.

Phase 6.6 resolves this by introducing:
1. **Option C: Reject & Remember Decision (`REJECT_AND_REMEMBER`):**
   - Distinct from a simple `REJECT` (which merely dismisses a single gap).
   - Creates an explicit, Admin-authorized **Negative Policy** representing an un-supported or out-of-scope service, app, or feature.
2. **Negative Policy Resolver in Runtime Pipeline:**
   - In `agentEngine.ts` and `knowledgeGapDetector.ts`, active Negative Policies are checked **before** declaring a `KNOWLEDGE_GAP`.
   - When matched: Returns the official negative answer (`SUPPORTED_NEGATIVE_POLICY`), emits `NEGATIVE_POLICY_MATCHED` telemetry, and **suppresses `KNOWLEDGE_GAP_DETECTED`**, breaking the loop permanently.

---

## 2. Storage & Schema Audit (Zero-Migration Strategy)

We evaluated the schema storage options:
- **`agent_analytics_events` Table:**
  - Has flexible JSONB `metadata`, indexed `event_type`, `user_id`, and `created_at`.
  - Can record `NEGATIVE_POLICY_CREATED`, `NEGATIVE_POLICY_UPDATED`, `NEGATIVE_POLICY_ACTIVATED`, `NEGATIVE_POLICY_DEACTIVATED`, and `NEGATIVE_POLICY_MATCHED`.
- **In-Memory / Service Cache (`negativePolicyService.ts`):**
  - Loads and aggregates active policies in memory.
  - Invalidation hooks trigger on create / update / deactivate / activate.
  - Sub-millisecond lookup latency (< 5ms) on the user query path.
- **Database Migrations:** **ZERO new database migrations required.**

---

## 3. Authority Hierarchy Compliance

Phase 6.6 implements the strict authority hierarchy:
```text
TRANSACTION AUTHORITY (Buy, Order, Warranty, Wallet)
        ↓
PRODUCT / CATALOG AUTHORITY (Canva Pro, Netflix, YouTube)
        ↓
OFFICIAL POSITIVE FAQ (public.faqs)
        ↓
OFFICIAL NEGATIVE POLICY (Active negative policies)
        ↓
KNOWLEDGE GAP (Recorded in Knowledge Hub)
        ↓
AI SUGGESTION (Proposal only, never authoritative)
```

---

## 4. Invariant Protection Checklist

1. **Reject vs Reject & Remember:**
   - `REJECT`: Closes candidate. Does NOT create a negative policy. Future queries may still create a gap if re-asked.
   - `REJECT_AND_REMEMBER`: Creates an active Negative Policy with scope (`APP`, `SERVICE`, `TOPIC`, `PRODUCT`, `GLOBAL`), canonical question, and official response.
2. **No Overgeneralization:**
   - Rejecting `"Shop có hỗ trợ cài app X không?"` creates a policy scoped specifically to `app_x`, never `ALL_APPS_NOT_SUPPORTED`.
3. **Conflict Detection:**
   - If Admin creates a Negative Policy for a topic that already has an active Positive FAQ in `public.faqs`, a conflict warning is surfaced.
4. **Boundary Preservations:**
   - `"Shop có bán Canva Pro không?"` remains `PRODUCT_DEMAND`.
   - `"Mua YouTube 6 tháng"` remains `TRANSACTIONAL` (Slot 6m @ 280.000đ).
   - Warranty BUG-W-001/002/003 and Gemini 429 fallbacks remain 100% intact.
