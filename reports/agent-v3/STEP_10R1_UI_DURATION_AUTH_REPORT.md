# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.1

## UI Version Alignment, Duration Repair & Authenticated Capability Verification

**Report ID:** `BOW-P72-STEP10R1-UI-DURATION-AUTH-20260902`  
**Date:** 2026-09-02  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Shop HEAD:** `65505c41901be0ec99f11840f5430e187c974c1b`  
**Agent:** `@bow/agent@3.3.0` at `48602221e054877f51a4e564b77712d8f5b27f75`  
**Status:** **FAIL — security defect detected; authenticated verification remains blocked**

## Executive Summary

The UI version defect and duration-selection defect were reproduced and repaired locally. The UI now identifies the runtime as `BOW Agent V3.3`. Duration matching is data-driven through the authoritative plan `duration`/name labels, maps `6 tháng` to the matching plan, and refuses to silently downgrade an unavailable duration such as `24 tháng`.

The remediation cannot be certified or deployed because the tracked `CLAUDE-CODE-CLI.bat` contained a hard-coded API credential. The literal value was removed from the working tree without printing it, but credential rotation/ownership review is still required. Authenticated user A/B and admin QA sessions were also unavailable, so those gates remain blocked.

## Baseline and Root Causes

- Git baseline: `shopofbow/main` at `65505c4`, matched `origin/main`; pre-existing reports/cache changes were preserved.
- Standalone agent: `main` at `4860222`, matched `origin/main`, clean.
- Host pin: immutable `48602221e054877f51a4e564b77712d8f5b27f75`; no `file:../bow-agent` or old `0e297dc` active pin.
- UI root cause: `BowAgentChatModal.tsx` still contained legacy visible labels `V2 Guided` and `Powered by BOW Agent V2 Engine`.
- Duration root cause: `extractDuration` had a bare `thang` regex alternative, causing `24 tháng` to match the 1-month branch; plan matching also relied on text substring matching and could fall through to a different plan.

## Fixes Applied

1. Replaced visible labels with `V3.3` and `Powered by BOW Agent V3.3`.
2. Added canonical month comparison for user duration and authoritative plan labels (`tháng`, `năm`, `ngày`, `nửa năm`, `cả năm`, `1 quý`).
3. Removed the bare `thang` parser fallback and preserved explicit numeric months.
4. Added an explicit unavailable-duration response listing available plans; no silent downgrade.
5. Removed the hard-coded API credential default from `CLAUDE-CODE-CLI.bat`; no secret value is included here.

## Duration Regression Matrix

| Test | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| `1 tháng` | Slot 1 month | Slot 1 month | PASS | in-memory fixture |
| `6 tháng` | Slot 6 month | Slot 6 month | PASS | in-memory fixture |
| `12 tháng` | Slot 12 month | Slot 12 month | PASS | in-memory fixture |
| `1 năm` | Slot 12 month | Slot 12 month | PASS | canonical 12-month comparison |
| `6 thang` | Slot 6 month | Slot 6 month | PASS | accent-free parser |
| `24 tháng` | unavailable, no downgrade | unavailable | PASS | no matching fixture selected |
| no duration | no forced plan | no matching plan | PASS | in-memory fixture |
| `1 tuần` | preserve week parser | `1 tuần` | PASS | regression check |

The original live-adapter test also reproduced the old failure before the fix, but it could not use production Supabase data because the local test environment had no Supabase variables. No production data was changed.

## Build and Security

- Host `npm run typecheck`: PASS.
- Host `npm run build`: PASS.
- Standalone typecheck/build: PASS.
- Standalone `test:all`: PASS `126/126`.
- Standalone `npm pack --dry-run`: PASS.
- Old UI labels in `src`: `0`.
- Secret scan after remediation: no credential pattern found in tracked release files scanned; actual values were never printed.
- Production URL prior runtime evidence remains Step 9.7: HTTP 200, Chrome/CDP `32/32`, `11/11` critical gates. This remediation was not deployed.

## Authenticated and Environment Verification

| Area | Result | Evidence |
|---|---|---|
| User A isolation | BLOCKED | authorized QA session unavailable |
| User B isolation | BLOCKED | authorized QA session unavailable |
| authenticated orders/expiry/wallet | BLOCKED | no QA session; no private data accessed |
| admin boundary | BLOCKED | no admin + normal-user comparison session |
| checkout state isolation | BLOCKED | authenticated multi-session test unavailable |
| support/ticket ownership | BLOCKED | QA session unavailable |
| coupon/warranty scoped reads | BLOCKED | safe fixture/session unavailable |
| notifications/realtime | NOT EXECUTED | no production event generated |
| BOW-TEST diagnosis | NOT EXECUTED | no separate safe test environment supplied |

## Git Integrity and Files Changed

Changed by this remediation: `CLAUDE-CODE-CLI.bat`, `src/components/agent/BowAgentChatModal.tsx`, `src/services/agent/agentEngine.ts`, `src/services/agent/intentResolver.ts`, and this report. A deletion of `public/_redirects` is present in the working tree but was not performed by this remediation; it is preserved and requires owner review because it affects SPA routing. No commit or push was performed. No database, migration, package pin, bow-agent or bow-robot change was made.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — PHASE 7.2 STEP 10R.1
UI VERSION ALIGNMENT + DURATION REPAIR
============================================================

STATUS: FAIL — SECURITY DEFECT DETECTED
UI V2 LABELS: REMEDIATED
DURATION 6 MONTHS: PASS
UNAVAILABLE DURATION NO DOWNGRADE: PASS
TYPECHECK: PASS
BUILD: PASS
BOW-AGENT REGRESSION: 126 / 126
SECRET EXPOSURE: REMEDIATED LOCALLY; ROTATION/REVIEW REQUIRED
AUTHENTICATED QA: BLOCKED
USER A/B ISOLATION: BLOCKED
ADMIN BOUNDARY: BLOCKED
DATABASE CHANGES: 0
MIGRATION CHANGES: 0
PRODUCTION DEPLOYMENT: NOT PERFORMED
CERTIFICATION: FAIL — PRODUCTION RELEASE BLOCKED
STEP 10: NOT CERTIFIED
============================================================
```

## Required Next Steps

Rotate/revoke the exposed credential through its owner, review the pending `public/_redirects` deletion, then provide safe authorized QA sessions for user A, user B and admin. After those gates pass, run browser verification of the repaired UI/duration flow before any commit or deployment.
