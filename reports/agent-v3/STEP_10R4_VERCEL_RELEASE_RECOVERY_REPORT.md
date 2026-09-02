# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.4

## Vercel Release Recovery & Exact Commit Deployment Verification

**Report ID:** `BOW-P72-STEP10R4-VERCEL-RECOVERY-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Target Shop commit:** `65505c41901be0ec99f11840f5430e187c974c1b`  
**Target Agent commit:** `48602221e054877f51a4e564b77712d8f5b27f75`  
**Status:** **FAIL — stale production artifact remains active**

## Executive Summary

Step 10R.4 did not deploy or modify source. The Git target is valid and synchronized, and the local production artifact is correct. However, the public Vercel site still serves the stale asset `/assets/index-CkzcUZf7.js` identified in Step 10R.3.

The live asset contains one `mock.supabase.co` occurrence, two legacy V2 markers, and zero V3.3 markers. Production responds with HTTP 200, but that does not establish a correct release. Vercel CLI is unavailable, so the deployment SHA and exact Git-to-Vercel equality cannot be confirmed.

Per the hard-stop rule, browser re-certification was not continued. Final certification is `FAIL`, not `PARTIAL`, because the production artifact itself remains defective.

## Git baseline

| Check | Result |
|---|---|
| Branch | `main` |
| Local HEAD | `65505c41901be0ec99f11840f5430e187c974c1b` |
| `origin/main` | `65505c41901be0ec99f11840f5430e187c974c1b` |
| Target on remote main | PASS |
| Working tree | Dirty; all changes preserved |
| Commit/push in Step 10R.4 | None |
| `public/_redirects` | Remains a pre-existing owner deletion; not restored or modified |

The working tree includes pre-existing changes and prior local remediation changes. No unrelated working-tree content was deployed or committed.

## Vercel authentication and deployment

- `vercel` CLI: not found.
- Vercel authentication: `BLOCKED`.
- Deployment command: not run.
- Deployment ID/timestamp/branch: not confirmed.
- Vercel source SHA: not confirmed.

No credential or token was requested, printed, or invented.

## Local release artifact

Local checks completed:

| Check | Result |
|---|---|
| Typecheck | PASS |
| Production build | PASS |
| `dist/index.html` | Present |
| Local `mock.supabase.co` | `0` |
| Local active V2 markers | `0` |
| Local V3.3 markers | `4` |
| Local `dotenv` marker | `0` |
| Local `configDotenv` marker | `0` |
| Local `process.cwd` marker | `0` |
| Local `path.resolve` marker | `0` |

The local artifact therefore satisfies the static artifact gates. This is not evidence that Vercel has deployed it.

## Production HTML and artifact

Read-only production verification:

| Check | Actual | Result |
|---|---:|---|
| Production HTTP | `200` | PASS |
| Active JS asset | `/assets/index-CkzcUZf7.js` | FAIL |
| Stale asset removed | No; still active | FAIL |
| Production `mock.supabase.co` | `1` | FAIL |
| Production legacy V2 markers | `2` | FAIL |
| Production V3.3 markers | `0` | FAIL |
| Production `dotenv` markers | `3` | FAIL / not certifiable |

This is the required hard-stop condition. The production artifact is not the current local release artifact.

## Dependency and architecture audit

- Host pin: `@bow/agent@3.3.0`.
- Immutable agent pin: `48602221e054877f51a4e564b77712d8f5b27f75`.
- `file:../bow-agent`: absent from active host manifests.
- AgentHostBridge: unchanged by this step; source audit remains PASS.
- No `bow-agent` source modification.
- No database, migration, pricing, wallet, order, refund, warranty, payment, webhook, or business-policy change.

## Browser and functional gates

The browser gates were intentionally not run after the artifact hard stop. The following are therefore not certified for the current production release: browser boot, console health, real Supabase requests, Agent V3.3 behavior, catalog query, YouTube six-month resolution, 24-month no-downgrade, checkout consistency, desktop, mobile, and browser secret audit.

Authenticated QA remains blocked because no approved User A, User B, or Admin sessions were available. Payment and wallet mutations were not executed.

## Security rotation

The historical credential issue remains separate from deployment recovery. The local working-copy credential was previously removed, but rotation/revocation has not been confirmed. This is recorded as `NOT CONFIRMED`; no credential value is included here.

## Required next action

An authorized Vercel operator must deploy only the target release and provide verifiable deployment metadata. Then confirm:

```text
Git SHA = Vercel Deployment SHA = Production Artifact
```

The new production entry asset must be different from `/assets/index-CkzcUZf7.js`, contain zero mock endpoint and V2 markers, and contain a V3.3 marker. Only after those checks pass should real Chrome/CDP browser certification proceed.

## Required final matrix

| Gate | Result |
|---|---|
| Git SHA | PASS |
| Origin SHA | PASS |
| Vercel authentication | BLOCKED |
| Vercel deployment | BLOCKED |
| Vercel SHA | BLOCKED |
| SHA equality | BLOCKED |
| Local typecheck | PASS |
| Local build | PASS |
| Production HTTP | PASS |
| Production asset | FAIL |
| Stale asset removed | FAIL |
| Production mock Supabase | FAIL |
| Production V2 markers | FAIL |
| Production V3.3 marker | FAIL |
| Browser boot | BLOCKED |
| Agent V3.3 | BLOCKED |
| Live catalog | BLOCKED |
| YouTube 6 months | BLOCKED |
| YouTube 24 months | BLOCKED |
| Checkout consistency | BLOCKED |
| Desktop | BLOCKED |
| Mobile | BLOCKED |
| Browser secrets | BLOCKED |
| Security rotation | NOT CONFIRMED |
| User A/B | BLOCKED |
| Admin | BLOCKED |
| Payment mutation | NOT EXECUTED |
| Wallet mutation | NOT EXECUTED |
| Database changes | `0` |
| Migration changes | `0` |

## Changed files

Created:

- `reports/agent-v3/STEP_10R4_VERCEL_RELEASE_RECOVERY_REPORT.md`

No production source, package manifest, lockfile, database, migration, `bow-agent`, or `public/_redirects` file was modified by Step 10R.4.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.4
RELEASE RECOVERY FINAL RESULT
============================================================

TARGET SHOP SHA:
65505c41901be0ec99f11840f5430e187c974c1b

VERCEL SHA:
NOT CONFIRMED

SHA MATCH:
BLOCKED

PRODUCTION ASSET:
/assets/index-CkzcUZf7.js

STALE ASSET:
STILL ACTIVE

MOCK SUPABASE:
1

V2 MARKERS:
2

V3.3 MARKERS:
0

BROWSER:
BLOCKED — HARD STOP

6 MONTHS:
BLOCKED

24 MONTHS:
BLOCKED

CHECKOUT:
BLOCKED

DESKTOP:
BLOCKED

MOBILE:
BLOCKED

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
