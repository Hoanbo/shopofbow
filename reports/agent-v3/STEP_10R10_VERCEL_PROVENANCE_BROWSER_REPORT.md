# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.10

## Vercel Provenance Recovery & Production Browser Certification

**Report ID:** `BOW-P72-STEP10R10-PROVENANCE-BROWSER-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Project:** `bobowcon/shopofbow`  
**Deployment:** `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m`  
**Status:** **BLOCKED — exact Vercel Git SHA not proven**

## Executive Summary

Step 10R.10 performed read-only Git, Vercel, and production artifact checks. The target release code commit `19e0b962...` exists and is an ancestor of the current `origin/main`. The descendant `fb1b8a4...` changes only the Step 10R.7 report. Vercel authentication, project identity, deployment readiness, production alias, and the active production artifact all pass their independent checks.

The mandatory provenance gate remains blocked. Vercel deployment JSON contains no usable `gitCommitSha`, `commitSha`, `sourceCommit`, or `gitSource` field. The deployment cannot be explicitly bound to `19e0b962...`; no inference is made from timing, aliases, asset filename, bundle contents, or ancestry. Browser certification was therefore not executed.

## Baseline Git state and ancestry

| Check | Result |
|---|---|
| Branch | `main` |
| Current HEAD | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Current `origin/main` | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Release code SHA | `19e0b96204b552700b7ae3b74e48482f6453330a` |
| Release SHA exists | PASS |
| Release is ancestor of HEAD | PASS |
| Descendant change | Documentation-only Step 10R.7 report |
| Working tree | Dirty; preserved |
| Source changes in Step 10R.10 | `0` |

No reset, restore, checkout, clean, amend, force push, or history rewrite was performed.

## Vercel authentication and project identity

- Authentication: PASS — `npx vercel whoami` returned account `hoanbo`.
- Project: PASS — `bobowcon/shopofbow`.
- Project ID: `prj_E8fJCZEy7xHTpiuCyBZEeDTFBoRP`.
- Production domain: `shopofbow.vercel.app`.
- Framework: Vite.
- Deployment state: `READY`.
- Deployment target: `production`.
- Production aliases include `shopofbow.vercel.app`.

## Deployment provenance metadata

Deployment inspected: `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m`.

The inspected JSON metadata included deployment ID, URL, target, ready state, creation timestamp, aliases, builds, and project context. The following provenance fields were absent or null:

| Field | Result |
|---|---|
| `gitCommitSha` | ABSENT/NULL |
| `commitSha` | ABSENT/NULL |
| `sourceCommit` | ABSENT/NULL |
| `gitSource` | ABSENT/NULL |
| explicit repository/ref binding | NOT EXPOSED |

**SHA provenance: BLOCKED.** The deployment timestamp, URL, alias, asset filename, clean bundle, and Git ancestry are not treated as proof.

## Production artifact audit

The active production entry asset was fetched from the current production HTML:

`/assets/index-oZl7uQfX.js`

| Check | Result |
|---|---|
| Production HTTP | `200` — PASS |
| Known stale asset active | NO — PASS |
| `mock.supabase.co` | `0` — PASS |
| Legacy V2 markers | `0` — PASS |
| V3.3 markers | `2` — PASS |
| `dotenv` | `0` — PASS |
| `configDotenv` | `0` — PASS |
| `process.cwd` | `0` — PASS |
| `path.resolve` | `0` — PASS |

This proves the public artifact is clean, not which exact Git SHA produced it.

## Browser and functional certification

Browser certification was **NOT EXECUTED** because the exact provenance gate failed. The following remain unverified in this step: browser boot, console/network health, real Supabase connectivity, Agent V3.3 interaction, AgentHostBridge runtime path, live catalog, six-month duration, 24-month no-downgrade, action cards, checkout UI, desktop, mobile, and browser security inspection.

Authenticated User A/B/Admin QA remains `BLOCKED` without approved sessions. Financial mutations were `NOT EXECUTED`; no payment, wallet change, order, refund, warranty, webhook, or database mutation occurred.

## Environment and security

Production Supabase variable presence was previously verified without reading values. No environment value, key, token, cookie, or authorization header was printed. Historical credential rotation remains `NOT CONFIRMED`.

## Safety and changed files

- Source changes: `0`.
- Deployment changes: `0`.
- Database changes: `0`.
- Migration changes: `0`.
- Business behavior changes: `0`.
- `bow-agent` source/history: unchanged.
- `public/_redirects`: pre-existing deletion preserved.
- Created only: `reports/agent-v3/STEP_10R10_VERCEL_PROVENANCE_BROWSER_REPORT.md`.
- Step 11: not started.

## Required next action

Obtain explicit deployment provenance from Vercel Dashboard/API or another trusted source that binds `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m` to the intended release SHA. Do not infer it from the clean artifact. After exact provenance is confirmed, rerun the browser gates without modifying source.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.10
VERCEL PROVENANCE + PRODUCTION BROWSER CERTIFICATION
============================================================

RELEASE CODE SHA:
19e0b96204b552700b7ae3b74e48482f6453330a

CURRENT HEAD:
fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec

ORIGIN/MAIN:
fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec

VERCEL AUTH:
PASS

VERCEL PROJECT:
bobowcon/shopofbow

DEPLOYMENT:
dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m

DEPLOYMENT STATE:
READY

VERCEL SOURCE SHA:
NOT EXPOSED

SHA PROVENANCE:
BLOCKED

PRODUCTION HTTP:
PASS — 200

ACTIVE ASSET:
/assets/index-oZl7uQfX.js

MOCK SUPABASE:
0

LEGACY V2:
0

V3.3:
2

DOTENV:
0

PROCESS.CWD:
0

PATH.RESOLVE:
0

BROWSER:
BLOCKED — PROVENANCE NOT PROVEN

AGENT V3.3:
BLOCKED

AGENT HOST BRIDGE:
BLOCKED

LIVE CATALOG:
BLOCKED

6 MONTHS:
BLOCKED

24 MONTHS:
BLOCKED

ACTION CARDS:
BLOCKED

CHECKOUT UI:
BLOCKED

DESKTOP:
BLOCKED

MOBILE:
BLOCKED

BROWSER SECURITY:
BLOCKED

AUTHENTICATED USER A/B:
BLOCKED

ADMIN:
BLOCKED

FINANCIAL MUTATIONS:
NOT EXECUTED

DATABASE CHANGES:
0

MIGRATION CHANGES:
0

SOURCE CHANGES:
0

DEPLOYMENT CHANGES:
0

FINAL CERTIFICATION:
BLOCKED — EXACT VERCEL GIT SHA NOT PROVEN

============================================================
```
