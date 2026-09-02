# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.9

## Vercel Deployment Provenance & Production Browser Certification

**Report ID:** `BOW-P72-STEP10R9-PROVENANCE-BROWSER-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Project:** `bobowcon/shopofbow`  
**Deployment:** `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m`  
**Status:** **BLOCKED — exact Vercel Git SHA not exposed**

## Executive Summary

The Git history and public production artifact were rechecked without modifying source or deployment. The release code commit `19e0b962...` is an ancestor of the current `origin/main`; the later `fb1b8a4...` commit changes only the Step 10R.7 report. Vercel authentication, project identity, deployment readiness, production alias, and artifact cleanliness all pass.

The decisive provenance gate remains blocked: Vercel CLI JSON metadata for deployment `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m` contains no `gitCommitSha`, `commitSha`, `sourceCommit`, or `gitSource`. The exact equality `Git SHA = Vercel Deployment SHA = Production Artifact` cannot therefore be proven. Browser certification was not run, as required by Step 10R.9.

## Git provenance

| Check | Result |
|---|---|
| Release code commit | `19e0b96204b552700b7ae3b74e48482f6453330a` |
| Current HEAD | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Current origin/main | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Relationship | `fb1b8a4` is a direct documentation-only descendant of `19e0b962` |
| Working tree | Dirty; preserved unchanged |
| History rewrite/reset/force push | None |

## Vercel deployment provenance

- Authentication: PASS — account `hoanbo`.
- Project: PASS — `bobowcon/shopofbow`.
- Production domain: PASS — `shopofbow.vercel.app`.
- Deployment state: PASS — `READY`.
- Deployment target: `production`.
- Deployment URL: `https://shopofbow-k4cc2wdzf-bobowcon.vercel.app`.
- Production aliases include `shopofbow.vercel.app`.
- Deployment created: 2026-09-02 03:04:23 GMT+0700.
- Exact Vercel Git SHA: **NOT EXPOSED**.

The deployment metadata fields `gitCommitSha`, `commitSha`, `sourceCommit`, and `gitSource` were absent/null. No SHA inference is made from deployment time, URL, or asset filename.

## Production artifact gate

Read-only scan of the active production entry asset:

| Check | Result |
|---|---|
| Production HTTP | `200` |
| Active JS | `/assets/index-oZl7uQfX.js` |
| Known stale asset active | NO |
| `mock.supabase.co` | `0` |
| Legacy V2 markers | `0` |
| V3.3 markers | `2` |
| `dotenv` | `0` |
| `configDotenv` | `0` |
| `process.cwd` | `0` |
| `path.resolve` | `0` |

The public artifact is clean, but artifact cleanliness does not prove the deployment source SHA.

## Supabase and security

Production Supabase configuration variable names were previously verified present; values were not read or printed. No secret appears in this report. Historical credential rotation remains `NOT CONFIRMED` and was not claimed as complete.

## Browser and functional verification

Not executed because SHA provenance did not pass. The following remain uncertified in this step: browser boot, console/network health, real Supabase connectivity, Agent V3.3 interaction, live catalog, YouTube six-month resolution, 24-month no-downgrade, action cards, checkout UI consistency, desktop, mobile, and browser secret inspection.

Authenticated User A/B/Admin QA remains blocked without approved sessions. No payment, wallet, order, refund, warranty, webhook, or database mutation was executed.

## Safety and changed files

- No source modification in Step 10R.9.
- No Vercel deployment modification.
- No database/migration/schema change: `0`.
- No business behavior change: `0`.
- `bow-agent` source/history unchanged.
- `public/_redirects` pre-existing deletion preserved.
- Created: `reports/agent-v3/STEP_10R9_VERCEL_PROVENANCE_BROWSER_REPORT.md`.

## Required next action

Obtain deployment provenance from the Vercel dashboard/API or another trusted deployment metadata source that explicitly binds `dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m` to the intended Git commit. Do not infer it from the clean artifact. Once exact provenance is confirmed, rerun browser certification without changing source.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.9
VERCEL PROVENANCE + PRODUCTION BROWSER CERTIFICATION
============================================================

RELEASE CODE SHA:
19e0b96204b552700b7ae3b74e48482f6453330a

CURRENT HEAD:
fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec

VERCEL AUTH:
PASS

VERCEL PROJECT:
bobowcon/shopofbow

DEPLOYMENT:
READY — dpl_G31iBMb1yjxSrrWf2RkJPizhoz4m

VERCEL SOURCE SHA:
NOT EXPOSED

SHA PROVENANCE:
BLOCKED

PRODUCTION HTTP:
200

ACTIVE ASSET:
/assets/index-oZl7uQfX.js

MOCK SUPABASE:
0

V2 MARKERS:
0

V3.3 MARKERS:
2

BROWSER:
BLOCKED — SHA PROVENANCE GATE

SUPABASE CONNECTIVITY:
NOT EXECUTED

AGENT:
BLOCKED

LIVE CATALOG:
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

AUTHENTICATED QA:
BLOCKED

FINANCIAL MUTATIONS:
NOT EXECUTED

DATABASE CHANGES:
0

MIGRATION CHANGES:
0

BUSINESS BEHAVIOR CHANGES:
0

FINAL CERTIFICATION:
BLOCKED — EXACT VERCEL GIT SHA NOT EXPOSED

============================================================
```
