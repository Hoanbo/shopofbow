# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.6

## Vercel Authenticated Target Deployment & Artifact Verification

**Report ID:** `BOW-P72-STEP10R6-VERCEL-AUTH-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Target Shop SHA:** `65505c41901be0ec99f11840f5430e187c974c1b`  
**Target Agent SHA:** `48602221e054877f51a4e564b77712d8f5b27f75`  
**Status:** **BLOCKED — target Git commit contains the known-bad artifact**

## Executive Summary

Vercel access is now authenticated and the correct project was identified. Production environment variable names for Supabase are present. However, the exact target Shop commit is not deployable as a repaired release: read-only inspection of `65505c...` shows that it still contains the `mock.supabase.co` fallback and legacy V2 UI labels. The fixes exist only as uncommitted working-tree changes.

Step 10R.6 explicitly forbids deploying an arbitrary dirty working tree or a known-bad artifact. Therefore no deployment was created, no commit/push was performed, and production remains on the stale artifact. Certification is blocked.

## Vercel authentication and project identity

| Check | Result |
|---|---|
| `npx vercel --version` | PASS — `59.11.0` |
| `npx vercel whoami` | PASS — authenticated account `hoanbo` |
| Vercel project | PASS — `bobowcon/shopofbow` |
| Project ID | `prj_E8fJCZEy7xHTpiuCyBZEeDTFBoRP` |
| Production domain | `shopofbow.vercel.app` |
| Framework | Vite |
| Node.js | 24.x |
| Build command | `npm run build` / `vite build` |
| Production Supabase URL variable | PRESENT |
| Production Supabase anon-key variable | PRESENT |

Only variable names/presence were checked. No environment value was read or included.

## Git baseline

- Branch: `main`.
- Local HEAD: `65505c41901be0ec99f11840f5430e187c974c1b`.
- `origin/main`: `65505c41901be0ec99f11840f5430e187c974c1b`.
- Target exists on `origin/main`: PASS.
- Working tree: dirty; all changes preserved.
- `public/_redirects`: pre-existing owner deletion; not restored or modified.

## Target commit integrity gate

The target commit was inspected without modifying it. It still contains:

- the `mock.supabase.co` Supabase fallback;
- the mock Supabase key fallback;
- `V2 Guided` and `Powered by BOW Agent V2 Engine` labels.

The current local working tree contains the remediation, but those changes are not part of the target commit. Deploying from the dirty working tree would include unrelated user changes and violate the release boundary. Deploying the target commit would reproduce the known production defect. This is the decisive stop condition.

## Existing Vercel deployment

The latest listed production deployment is `Ready` and aliases `shopofbow.vercel.app`, but the CLI inspection did not expose a source Git SHA. Public production inspection remains consistent with the prior stale artifact:

| Check | Actual | Result |
|---|---:|---|
| Production HTTP | `200` | PASS only for availability |
| Active asset | `/assets/index-CkzcUZf7.js` | FAIL — stale |
| `mock.supabase.co` | `1` | FAIL |
| Legacy V2 markers | `2` | FAIL |
| V3.3 markers | `0` | FAIL |

HTTP 200 is not treated as release correctness.

## Local artifact and dependency state

The current local working-tree artifact previously passed typecheck/build and contains zero mock endpoint markers, zero V2 markers, and V3.3 markers. The host remains pinned to `@bow/agent@3.3.0` at commit `48602221e054877f51a4e564b77712d8f5b27f75`; `file:../bow-agent` is absent.

Those local changes cannot be deployed by this step because they are uncommitted and mixed with other pre-existing working-tree changes. No source was edited in Step 10R.6.

## Browser and functional verification

Not executed. The deployment and target-artifact gates failed before browser verification. Agent runtime, live catalog, duration, checkout consistency, desktop, mobile, console, network, and browser secret gates remain uncertified. Authenticated User A/B/Admin QA remains blocked because no approved sessions were available.

No payment, wallet mutation, order, refund, warranty, webhook, or database operation was performed.

## Security

Environment values were not exposed. Historical credential rotation remains `NOT CONFIRMED`. No credential was rotated automatically, and no secret was printed or copied into the repository/report.

## Required next action

The release owner must decide how to publish the already-present remediation safely: create a narrowly scoped release commit containing only authorized changes and push it through the approved workflow, or otherwise make the corrected source available to the Vercel Git integration. That action is outside this Step because the current instructions prohibit creating/ pushing unrelated changes. Afterward, re-run deployment metadata and artifact verification, requiring:

```text
Git SHA = Vercel Deployment SHA = Production Artifact
mock.supabase.co = 0
V2 markers = 0
V3.3 marker >= 1
```

## Final matrix

| Gate | Result |
|---|---|
| Git SHA | PASS |
| Origin SHA | PASS |
| Vercel CLI | PASS |
| Vercel authentication | PASS |
| Correct Vercel project | PASS |
| Deployment created | BLOCKED |
| Vercel SHA | BLOCKED |
| SHA equality | BLOCKED |
| Local typecheck | PASS — prior local verification |
| Local build | PASS — prior local verification |
| Production HTTP | PASS — `200` |
| New production asset | FAIL |
| Stale asset removed | FAIL |
| Mock Supabase | FAIL |
| V2 markers | FAIL |
| V3.3 markers | FAIL |
| Browser boot | BLOCKED |
| Agent V3.3 | BLOCKED |
| Live catalog | BLOCKED |
| YouTube 6 months | BLOCKED |
| YouTube 24 months | BLOCKED |
| Checkout | BLOCKED |
| Desktop | BLOCKED |
| Mobile | BLOCKED |
| Browser secrets | BLOCKED |
| Security rotation | NOT CONFIRMED |
| User A/B | BLOCKED |
| Admin | BLOCKED |
| Payment | NOT EXECUTED |
| Wallet | NOT EXECUTED |
| Database changes | `0` |
| Migration changes | `0` |

## Changed files

Created only:

- `reports/agent-v3/STEP_10R6_VERCEL_AUTHENTICATED_DEPLOYMENT_REPORT.md`

No source, package, database, migration, `bow-agent`, or `public/_redirects` file was modified by Step 10R.6.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.6
VERCEL AUTHENTICATED TARGET DEPLOYMENT
============================================================

TARGET SHOP SHA:
65505c41901be0ec99f11840f5430e187c974c1b

VERCEL AUTH:
PASS

VERCEL PROJECT:
bobowcon/shopofbow

VERCEL SHA:
NOT CONFIRMED

SHA MATCH:
BLOCKED

TARGET COMMIT ARTIFACT:
KNOWN BAD — MOCK SUPABASE AND V2 PRESENT

PRODUCTION HTTP:
200

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
BLOCKED

AGENT:
BLOCKED

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
BLOCKED — KNOWN-BAD TARGET COMMIT CANNOT BE DEPLOYED SAFELY

============================================================
```
