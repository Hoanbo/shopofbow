# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.2

## Security, Supabase Configuration & Browser Runtime Verification

**Report ID:** `BOW-P72-STEP10R2-SECURITY-SUPABASE-BROWSER-20260902`  
**Date:** 2026-09-02  
**Host:** `C:\BOW\shopofbow`  
**Status:** **BLOCKED — production defect remains and credential rotation is unconfirmed**

## Executive Summary

Step 10R.2 investigated the local mock Supabase endpoint and verified the currently deployed public Vercel bundle. The local source fallback to `https://mock.supabase.co` was removed and the local production build contains zero occurrences of that endpoint.

The live production URL responds with HTTP 200, but its deployed JavaScript bundle is still the older bundle `/assets/index-CkzcUZf7.js`. A read-only bundle scan found one `mock.supabase.co` occurrence and two legacy V2 UI occurrences; the current local V3.3 source is therefore not deployed. This is a production deployment defect, so certification is blocked.

The earlier hard-coded credential in `CLAUDE-CODE-CLI.bat` was removed from the working copy, but historical exposure was found and rotation/revocation has not been confirmed. No credential value is included in this report. Authenticated QA was not performed because no approved authenticated session was available.

## Findings

### Mock Supabase root cause

The source fallback was in `src/lib/supabase.ts`: missing runtime configuration silently selected `https://mock.supabase.co` and a mock key. It was changed to fail fast with a configuration error when the required Supabase URL or key is absent.

Validation after the change:

| Check | Result |
|---|---|
| Current source mock endpoint count | `0` |
| Local `dist` mock endpoint count | `0` |
| Local typecheck | PASS |
| Local production build | PASS |
| Production HTTP response | `200` |
| Production bundle mock endpoint count | `1` |
| Production bundle legacy V2 marker count | `2` |
| Production bundle current V3.3 marker count | `0` |

The mock endpoint was therefore not test-only in the deployed artifact; it remains present in the live production bundle. The production bundle must be rebuilt and deployed from the current GitHub source before release certification can continue.

### Security

The local hard-coded credential-bearing default in `CLAUDE-CODE-CLI.bat` was removed. Historical Git inspection found the file in earlier commits with a credential literal. Rotation/revocation status is **UNKNOWN / REQUIRED REVIEW**. No automatic rotation, history rewrite, force push, or credential disclosure was performed.

Tracked release-file checks found no current credential literal, private-key literal, or tracked environment file. The local secret backup remains outside the repository and was not inspected, copied, or printed.

### Production deployment

Production URL: `https://shopofbow.vercel.app`  
HTTP status: `200`  
Observed deployed asset: `/assets/index-CkzcUZf7.js`  
Deployment commit metadata was not available from the public HTML response. The deployed bundle does not match the current local V3.3 source fingerprint; exact Vercel deployment commit could not be independently confirmed in this read-only pass.

## Repository and dependency state

- GitHub source: `https://github.com/Hoanbo/shopofbow.git`
- Local `HEAD`: `65505c41901be0ec99f11840f5430e187c974c1b`
- `origin/main`: `65505c41901be0ec99f11840f5430e187c974c1b`
- Git sync: PASS
- Host pin: `@bow/agent@3.3.0`
- Immutable agent commit: `48602221e054877f51a4e564b77712d8f5b27f75`
- `file:../bow-agent`: absent
- AgentHostBridge source architecture: unchanged; local engine remains rollback-only

The working tree contains pre-existing user changes and the local remediation changes. No commit, push, deploy, database operation, or `public/_redirects` restoration was performed in Step 10R.2.

## Functional and regression validation

- Local host typecheck: PASS.
- Local host build: PASS.
- Standalone agent typecheck/build: PASS from the preceding Step 10 validation.
- Standalone agent regression: `126/126` from the preceding Step 10 validation.
- Duration regression: PASS for 1, 6, and 12 months; 1 year maps to 12 months; 24 months is unavailable; no-duration requests do not silently downgrade.
- UI labels: current source uses V3.3 labels.
- Authenticated login/session/protected-route QA: NOT RUN — approved session unavailable.
- Real production agent/product/payment smoke certification: BLOCKED because the deployed artifact is stale and authenticated QA is unavailable.
- Database/migration/schema changes: `0`.
- Business, pricing, wallet, order, refund, warranty, payment, webhook, and negative-policy changes: `0`.

## Required next steps

1. Review and rotate/revoke the historically exposed credential through its owning provider; do not place the replacement in Git.
2. Deploy the current `shopofbow` commit through Vercel and verify the Vercel deployment commit exactly matches `origin/main`.
3. Re-run the production bundle audit and browser smoke test; the live bundle must contain no mock endpoint and must show the current V3.3 artifact.
4. Provide an approved authenticated test session if authenticated QA is required.

## Certification matrix

| Area | Result |
|---|---|
| Git source | PASS |
| Git sync | PASS |
| Vercel deployment | FAIL — stale artifact observed |
| Deployment commit | BLOCKED — exact SHA unavailable |
| Production URL | PASS — HTTP 200 |
| Application loading | PASS at HTTP level; full runtime certification blocked |
| @bow/agent version/pin | PASS locally; production not independently verified |
| AgentHostBridge | PASS by source audit; production not independently verified |
| ESM/dependency boundary | PASS locally |
| Environment configuration | NOT CERTIFIED — production values not exposed/read |
| Secret scan | PASS for current tracked files |
| Bundle audit | FAIL — live bundle contains mock endpoint |
| Authentication | NOT RUN |
| Product | BLOCKED |
| Agent | BLOCKED |
| Wallet/order/refund/warranty safety | PASS by static/invariant scope; no real transaction performed |
| Negative policy | PASS by static/invariant scope |
| Payment/webhook | NOT CERTIFIED |
| Step 8 regression | Prior evidence `50/50`; not rerun in this pass |
| Agent regression | Prior evidence `126/126` |
| Database changes | `0` |
| Migration changes | `0` |
| Business behavior changes | `0` |

## Final Certification

```text
============================================================
BOW AGENT V3.3 — PHASE 7.2 STEP 10R.2
SECURITY, SUPABASE & BROWSER RUNTIME VERIFICATION
============================================================

STATUS: BLOCKED — PRODUCTION DEFECT REMAINS

GITHUB SOURCE: PASS
GIT SYNC: PASS
VERCEL DEPLOYMENT: FAIL — STALE BUNDLE
PRODUCTION URL: HTTP 200
DEPLOYMENT COMMIT: NOT CONFIRMED
COMMIT MATCH: NOT CERTIFIED

PRODUCTION BUNDLE MOCK ENDPOINT: DETECTED
LOCAL SOURCE MOCK ENDPOINT: 0
LOCAL DIST MOCK ENDPOINT: 0
LEGACY V2 UI IN PRODUCTION: DETECTED

@BOW/AGENT:
VERSION: 3.3.0 (LOCAL PIN)
PINNED COMMIT: 48602221e054877f51a4e564b77712d8f5b27f75

AGENTHOSTBRIDGE: PASS — SOURCE AUDIT
ESM: PASS — LOCAL AUDIT
DEPENDENCY BOUNDARY: PASS — LOCAL AUDIT

SECURITY: BLOCKED — ROTATION/REVOCATION UNCONFIRMED
SECRET SCAN: PASS — CURRENT TRACKED FILES
BUNDLE AUDIT: FAIL — LIVE MOCK ENDPOINT
ENVIRONMENT: NOT CERTIFIED

AUTHENTICATION: NOT RUN
PRODUCT: BLOCKED
AGENT: BLOCKED
WALLET/ORDER/REFUND/WARRANTY SAFETY: PASS — NO REAL TRANSACTION
NEGATIVE POLICY: PASS — STATIC/INVARIANT AUDIT
PAYMENT/WEBHOOK: NOT CERTIFIED

DATABASE CHANGES: 0
MIGRATION CHANGES: 0
BUSINESS BEHAVIOR CHANGES: 0
BOW-ROBOT CHANGES: 0

STEP 8 REGRESSION: 50 / 50 PRIOR EVIDENCE
BOW-AGENT REGRESSION: 126 / 126 PRIOR EVIDENCE

PRODUCTION DEPLOYMENT: NOT CERTIFIED
RELEASE SOURCE: 65505c41901be0ec99f11840f5430e187c974c1b
VERCEL SOURCE: NOT CONFIRMED
COMMIT MATCH: NOT CERTIFIED

STEP 10R.2: BLOCKED
STEP 10: NOT CERTIFIED

============================================================
```
