# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.8

## Vercel Production Deployment & Artifact Verification

**Report ID:** `BOW-P72-STEP10R8-VERCEL-ARTIFACT-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Release code SHA:** `19e0b96204b552700b7ae3b74e48482f6453330a`  
**Current repository HEAD:** `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec`  
**Status:** **BLOCKED — exact Vercel SHA equality is not certifiable**

## Executive Summary

Vercel authentication and project identity passed. Git Integration created a new Ready Production deployment after the release push, and the live production artifact is now new and clean. However, Step 10R.8 requires the exact equality `Git release = Vercel deployment SHA = production artifact`.

The code release commit `19e0b962...` was followed by a documentation-only commit `fb1b8a470...`; the current `HEAD` and `origin/main` are therefore `fb1b8a470...`, not the Step 10R.8 expected baseline `19e0b962...`. Vercel CLI inspect metadata does not expose a Git source SHA, so the deployment cannot be independently bound to either exact SHA. No reset, amend, force push, or duplicate deployment was performed.

## Git release verification

| Check | Result |
|---|---|
| Branch | `main` |
| Current HEAD | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Current `origin/main` | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Step 10R.8 expected SHA | `19e0b96204b552700b7ae3b74e48482f6453330a` |
| Release code commit exists on remote | PASS — ancestor of `origin/main` |
| HEAD equals expected SHA | FAIL |
| Working tree | Dirty with preserved owner changes |

This mismatch is recorded without altering history.

## Vercel access and project

- `npx vercel whoami`: PASS — authenticated account `hoanbo`.
- Project: PASS — `bobowcon/shopofbow`.
- Project ID: `prj_E8fJCZEy7xHTpiuCyBZEeDTFBoRP`.
- Production alias: `https://shopofbow.vercel.app`.
- Framework: Vite.
- Production Supabase variable names: PRESENT; values were not read or printed.

## Deployment metadata

The existing Git-triggered deployment was inspected:

- Deployment ID: `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m`.
- Deployment URL: `https://shopofbow-k4cc2wdzf-bobowcon.vercel.app`.
- State: `READY`.
- Target: `production`.
- Production aliases include `shopofbow.vercel.app`.
- Created: 2026-09-02 03:04:23 GMT+0700.
- Vercel source Git SHA: NOT EXPOSED by CLI metadata.

The deployment was created by Git Integration after the release code push, but exact SHA equality is not claimed because the CLI did not expose source commit metadata and the repository subsequently advanced with the documentation commit.

## Local artifact gate

Local validation passed:

| Check | Result |
|---|---|
| Host typecheck | PASS |
| Host build | PASS |
| `dist/index.html` | PRESENT |
| Local `mock.supabase.co` | `0` |
| Local V2 markers | `0` |
| Local V3.3 markers | `4` |
| Local `dotenv` | `0` |
| Local `configDotenv` | `0` |
| Local `process.cwd` | `0` |
| Local `path.resolve` | `0` |

Standalone `bow-agent` regression remains prior evidence: typecheck PASS, build PASS, `test:all = 126/126`, pack dry-run PASS.

## Production HTML and artifact

Read-only production inspection after Git-triggered deployment:

| Check | Result |
|---|---|
| Production HTTP | `200` |
| Active JS asset | `/assets/index-oZl7uQfX.js` |
| Old stale asset active | NO |
| `mock.supabase.co` | `0` |
| Legacy V2 markers | `0` |
| V3.3 markers | `2` |
| `dotenv` | `0` |
| `configDotenv` | `0` |
| `process.cwd` | `0` |
| `path.resolve` | `0` |

The production artifact gates pass, but the release equality gate remains blocked by unavailable exact Vercel SHA and the current repository ref mismatch.

## Browser and public functional verification

Per Step 10R.8, browser certification was not performed because the exact SHA gate was not satisfied. Agent UI, live catalog, YouTube duration behavior, checkout consistency, desktop/mobile responsiveness, console, network, and browser-secret gates are not newly certified by this report. No payment, wallet, order, refund, warranty, webhook, or database mutation was executed.

Authenticated QA remains blocked without approved User A/B/Admin sessions. Historical credential rotation remains `NOT CONFIRMED`.

## Safety and changed files

- Database changes: `0`.
- Migration changes: `0`.
- Business behavior changes in Step 10R.8: `0`.
- `bow-agent` source/history: unchanged.
- `public/_redirects`: pre-existing owner deletion; not restored or modified.
- No application source was modified by Step 10R.8.
- Created: `reports/agent-v3/STEP_10R8_VERCEL_PRODUCTION_ARTIFACT_REPORT.md`.

## Final matrix

| Gate | Result |
|---|---|
| Git release | FAIL — HEAD advanced to documentation commit |
| Vercel authentication | PASS |
| Correct project | PASS |
| Deployment created | PASS — Git Integration |
| Deployment state | PASS — READY |
| Vercel SHA | BLOCKED — not exposed |
| SHA equality | BLOCKED |
| Local typecheck/build | PASS |
| Production HTTP | PASS — `200` |
| New production asset | PASS |
| Stale asset removed | PASS |
| Production mock Supabase | PASS — `0` |
| Production V2 markers | PASS — `0` |
| Production V3.3 marker | PASS — `2` |
| Production browser boot | BLOCKED — SHA hard stop |
| Agent/catalog/duration/checkout | BLOCKED |
| Desktop/mobile | BLOCKED |
| Browser secrets | BLOCKED |
| Authenticated QA | BLOCKED |
| Security rotation | NOT CONFIRMED |
| Payment/wallet mutation | NOT EXECUTED |
| Database changes | `0` |
| Migration changes | `0` |

## Required next action

Use deployment metadata or the Vercel dashboard/API to obtain the exact Git source SHA for `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m`. Do not reset the repository to force the old SHA. If exact SHA equality is confirmed against the intended release, run the remaining browser gates in a subsequent authorized verification step.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.8
VERCEL PRODUCTION DEPLOYMENT + ARTIFACT VERIFICATION
============================================================

RELEASE CODE SHA:
19e0b96204b552700b7ae3b74e48482f6453330a

CURRENT SHOP HEAD:
fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec

VERCEL AUTH:
PASS

VERCEL PROJECT:
bobowcon/shopofbow

DEPLOYMENT:
READY — dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m

VERCEL SHA:
NOT CONFIRMED

SHA MATCH:
BLOCKED

PRODUCTION HTTP:
200

ACTIVE ASSET:
/assets/index-oZl7uQfX.js

STALE ASSET:
REMOVED

MOCK SUPABASE:
0

V2 MARKERS:
0

V3.3 MARKERS:
2

BROWSER:
BLOCKED — EXACT SHA GATE

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
BLOCKED — VERCEL SOURCE SHA NOT CONFIRMED

============================================================
```
