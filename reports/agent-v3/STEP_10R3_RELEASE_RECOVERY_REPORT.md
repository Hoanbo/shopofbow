# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.3

## Release Recovery, Vercel Deployment Verification & Production Browser Re-certification

**Report ID:** `BOW-P72-STEP10R3-RELEASE-RECOVERY-20260902`  
**Date:** 2026-09-02  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Status:** **FAIL — production artifact remains stale; certification stopped**

## Executive Summary

The local source and build are correct, but the public Vercel deployment was not repaired in this step. Production still serves the previously observed stale bundle `/assets/index-CkzcUZf7.js`, which contains one `mock.supabase.co` occurrence, two legacy V2 markers, and no V3.3 marker. Production returns HTTP 200, but HTTP 200 alone is insufficient evidence of a correct deployment.

The required equality cannot be established:

```text
Git SHA = 65505c41901be0ec99f11840f5430e187c974c1b
Vercel deployment SHA = NOT CONFIRMED
Production artifact = STALE
```

No source files were changed in Step 10R.3. No commit, push, deploy, database operation, migration, `public/_redirects` restoration, or credential operation was performed. The previously applied local remediation changes remain uncommitted and must not be accidentally included with unrelated working-tree changes.

## Baseline

| Test ID | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| STEP10R3-001 | HEAD equals origin/main | Both `65505c41901be0ec99f11840f5430e187c974c1b` | PASS | Git refs |
| STEP10R3-002 | Clean source audit/build | Typecheck PASS; build PASS with elevated local process permission | PASS | `npm run typecheck`, `npm run build` |
| STEP10R3-003 | Local mock endpoint absent | `0` in current `dist` | PASS | Generated artifact scan |
| STEP10R3-004 | Local V2 markers absent | `0` in current `dist` | PASS | Generated artifact scan |
| STEP10R3-005 | Vercel deployment available | Vercel CLI not installed; no deployment performed | BLOCKED | `vercel` not found |
| STEP10R3-006 | Exact Vercel SHA | Not confirmed | BLOCKED | Public response exposes no deployment SHA |
| STEP10R3-007 | Production HTTP 200 | `200` | PASS | Read-only GET |
| STEP10R3-008 | Current production asset | Current observed asset is `/assets/index-CkzcUZf7.js` | FAIL | Production HTML |
| STEP10R3-009 | Production mock endpoint absent | `1` occurrence | FAIL | Production bundle scan |
| STEP10R3-010 | Production V2 markers absent | `2` occurrences | FAIL | Production bundle scan |
| STEP10R3-011 | Production V3.3 marker present | `0` occurrences | FAIL | Production bundle scan |
| STEP10R3-012 | Real Supabase browser requests | Not re-certified; stale artifact gate failed first | BLOCKED | Deployment gate |
| STEP10R3-013 | Console clean | Not re-certified for repaired artifact | BLOCKED | Deployment gate |
| STEP10R3-014 | Agent open/close | Not re-certified on repaired artifact | BLOCKED | Deployment gate |
| STEP10R3-015 | Agent V3.3 UI | Local source/dist PASS; production FAIL | FAIL | Local and production scans |
| STEP10R3-016 | Catalog query | Not re-certified on current artifact | BLOCKED | Deployment gate |
| STEP10R3-017 | YouTube 6-month plan | Local duration regression PASS; production not certified | BLOCKED | Local regression / stale production |
| STEP10R3-018 | 24-month no downgrade | Local regression PASS; production not certified | BLOCKED | Local regression / stale production |
| STEP10R3-019 | Checkout consistency | Not executed against stale production | BLOCKED | No transaction test |
| STEP10R3-020 | Desktop browser | Not re-certified after local changes | BLOCKED | Deployment gate |
| STEP10R3-021 | Mobile browser | Not re-certified after local changes | BLOCKED | Deployment gate |
| STEP10R3-022 | Browser secret exposure | Not re-certified for repaired artifact | BLOCKED | Deployment gate |
| STEP10R3-023 | Agent regression | Prior evidence `126/126` | PASS — prior evidence | Step 10 validation |
| STEP10R3-024 | Shop typecheck/build | PASS/PASS | PASS | Local commands |

## Local artifact verification

Current local `dist` contains `dist/index.html`, zero `mock.supabase.co` occurrences, zero active V2 markers, and four V3.3 markers. The local host typecheck passed. The local production build passed after retrying with the required process permission; the initial `spawn EPERM` was an execution-environment restriction, not an application error.

The local source changes from the previous remediation were not reimplemented or expanded. In particular, `intentResolver.ts`, `agentEngine.ts`, and `BowAgentChatModal.tsx` were not modified in this step.

## Supabase and environment

The local source no longer contains the mock endpoint. Production environment values were not read or printed. Vercel environment configuration was not independently inspectable because the Vercel CLI is unavailable and no authorized deployment API was connected. Therefore production Supabase configuration is **NOT CERTIFIED**.

The local secret backup remains outside the repository. No `.env` value, key, token, cookie, or authorization header was printed. Credential rotation/revocation remains **NOT CONFIRMED** from Step 10R.2.

## Vercel and production artifact

The production URL responds with HTTP 200, but the loaded asset remains `/assets/index-CkzcUZf7.js`. Its scan results are:

| Marker | Result |
|---|---:|
| `mock.supabase.co` | 1 |
| Legacy V2 markers | 2 |
| V3.3 marker | 0 |

The Vercel source SHA is not available from the public HTML and could not be confirmed. Since the active artifact is stale, the browser, network, agent, duration, checkout, desktop, and mobile gates are not certified for the repaired source.

## Architecture and safety

- Host dependency remains pinned locally to `@bow/agent@3.3.0`, commit `48602221e054877f51a4e564b77712d8f5b27f75`.
- `file:../bow-agent` is absent.
- AgentHostBridge remains the production routing architecture by source audit.
- `public/_redirects` remains deleted as a pre-existing owner change; it was not restored or modified.
- No real payment, wallet deduction, order, refund, warranty mutation, webhook, or migration was performed.
- Database changes: `0`.
- Migration changes: `0`.
- Business behavior changes in Step 10R.3: `0`.
- `bow-agent` source was not changed.

## Authenticated QA

Authenticated QA remains blocked because no approved User A, User B, or Admin sessions were available. User isolation, admin boundaries, authenticated orders/wallet, warranty ownership, coupon scope, and checkout state isolation are not claimed as PASS.

## Security status

Current tracked-file security cleanup remains in place, but historical credential exposure was previously identified. Rotation/revocation is not confirmed. Under the Step 10R.3 security rule, this remains `SECURITY ROTATION: NOT CONFIRMED`; it is not converted to PASS.

## Required next action

An authorized release operator must deploy the intended source through the existing Vercel workflow, ensuring that only the intended release commit is deployed. Then verify the Vercel deployment SHA exactly equals `65505c41901be0ec99f11840f5430e187c974c1b`, confirm the new production asset, and rerun the public browser/network gates. Credential rotation/revocation must be confirmed separately. No release certification should be issued before those checks pass.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.3
RELEASE RECOVERY FINAL RESULT
============================================================

SHOP SOURCE SHA:
65505c41901be0ec99f11840f5430e187c974c1b

VERCEL SOURCE SHA:
NOT CONFIRMED

COMMIT MATCH:
NOT CONFIRMED

LOCAL BUILD:
PASS

PRODUCTION ASSET:
/assets/index-CkzcUZf7.js

STALE ASSET:
STILL ACTIVE

MOCK SUPABASE:
1

V2 UI MARKERS:
2

V3.3 MARKER:
ABSENT

PRODUCTION SUPABASE:
NOT CERTIFIED

ERR_NAME_NOT_RESOLVED:
NOT CERTIFIED

PRODUCTION CONSOLE:
NOT CERTIFIED

AGENT:
BLOCKED

DURATION:
BLOCKED — LOCAL PASS, PRODUCTION NOT CERTIFIED

6 MONTHS:
BLOCKED — LOCAL PASS, PRODUCTION NOT CERTIFIED

24 MONTHS:
BLOCKED — LOCAL PASS, PRODUCTION NOT CERTIFIED

CHECKOUT:
BLOCKED

DESKTOP:
BLOCKED

MOBILE:
BLOCKED

BROWSER SECRET EXPOSURE:
NOT CERTIFIED

SECURITY ROTATION:
NOT CONFIRMED

AUTHENTICATED QA:
BLOCKED

USER A/B:
BLOCKED

ADMIN:
BLOCKED

PAYMENT:
NOT EXECUTED

WALLET:
NOT EXECUTED

DATABASE CHANGES:
0

MIGRATION CHANGES:
0

BUSINESS BEHAVIOR CHANGES:
0

BOW-ROBOT CHANGES:
0

FINAL CERTIFICATION:
FAIL — PRODUCTION DEFECT REMAINS

============================================================
```
