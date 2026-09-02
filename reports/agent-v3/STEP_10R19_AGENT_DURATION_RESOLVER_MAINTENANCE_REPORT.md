# BOW AGENT V3.3 — STEP 10R.19

## Standalone Agent Duration Resolver Maintenance

**Report ID:** `BOW-P72-STEP10R19-AGENT-DURATION-RESOLVER-MAINTENANCE-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Standalone repository:** `C:\BOW\bow-agent`  
**Status:** **PASS — standalone duration resolver fixed and released**

## Executive Summary

Step 10R.19 fixed the reproduced public duration defect in the standalone `@bow/agent` package. Explicit numeric month durations are now parsed before generic aliases, and the generic `thang` fallback that caused unmatched requests to become one month was removed.

The fix is general and is not product-specific. It preserves `24 tháng` as an explicit 24-month request; plan matching can therefore select an authoritative 24-month plan or return unavailable instead of silently downgrading.

## Git baseline

| Check | Result |
|---|---|
| Branch | `main` |
| Old HEAD | `48602221e054877f51a4e564b77712d8f5b27f75` |
| New HEAD | `47d6432c1366226eaa5143e06ff6efa58aacdcee` |
| New `origin/main` | `47d6432c1366226eaa5143e06ff6efa58aacdcee` |
| Working tree after push | Clean |
| History rewrite/force push | None |

`shopofbow` was not modified except for this report. Its existing owner changes were preserved.

## Before reproduction and root cause

The Step 10R.18 browser case observed:

```text
Mua YouTube Premium 24 tháng
→ Slot 1 tháng (1 tháng) — 35.000đ
```

Read-only inspection identified `src/core/intentResolver.ts`, function `extractDuration`, as the root cause. The one-month regex included a bare `thang` alternative. When a numeric duration such as 24 months did not match an earlier supported branch, that broad alias returned `1 tháng`. The downstream matcher then selected the one-month plan.

## Minimal fix

Changed only `src/core/intentResolver.ts`:

1. Added a generic numeric-month capture before supported fixed-duration aliases:

```text
(number) thang → (number) tháng
```

2. Removed the bare generic `thang` alternative from the one-month branch.

Generated `dist/core/intentResolver.js` was rebuilt. No YouTube, Netflix, ChatGPT, catalog, UI, checkout, Supabase, payment, wallet, or production logic was changed.

## Regression matrix

The new resolver test passed `18/18` assertions, including:

| Input family | Result |
|---|---|
| 1 tháng / 1 thang | 1 |
| 3 tháng / 3 thang | 3 |
| 6 tháng / 6 thang | 6 |
| 12 tháng | 12 |
| 1 năm | 12 |
| 24 tháng / 24 thang | 24 |
| Netflix 24 tháng | 24 |
| ChatGPT 24 tháng | 24 |
| Generic product 24 tháng | 24 |
| 24/18/15/9/7 months | exact numeric duration preserved |

## Validation

| Gate | Result |
|---|---|
| Step 10R.19 duration test | PASS — `18/18` |
| Standalone typecheck | PASS |
| Standalone build | PASS |
| Existing regression | PASS — `126/126` |
| Package pack dry-run | PASS |
| Generated dist direct import | PASS — 24, 24, and 6 months preserved |
| Agent source boundary | Unchanged |

## Immutable release

```text
OLD AGENT SHA:
48602221e054877f51a4e564b77712d8f5b27f75

NEW AGENT SHA:
47d6432c1366226eaa5143e06ff6efa58aacdcee

PACKAGE VERSION:
@bow/agent@3.3.0

COMMIT:
fix(duration): preserve unsupported numeric month requests

PUSH:
PASS — origin/main matches new SHA
```

## Host compatibility

Host inspection confirms `shopofbow` remains pinned to the old immutable SHA `48602221...`. The host dependency was intentionally not changed in Step 10R.19 because this task is standalone maintenance only. A separate authorized host pin update and browser recertification are required to consume SHA `47d6432...`.

The public API shape was not changed; the resolver returns the existing canonical string shape, so the fix is backward-compatible at the contract level.

## Production and safety

- Browser testing: not executed; reserved for the next authorized recertification after host pin update.
- Production: protected; no deployment or Vercel change.
- AgentHostBridge: unchanged.
- Frontend changes: `0`.
- Supabase changes: `0`.
- Database/migration/schema changes: `0`.
- Business/catalog/pricing changes: `0`.
- Financial mutations: not executed.

## Changed files

In `bow-agent`:

- `src/core/intentResolver.ts`
- `dist/core/intentResolver.js`
- `tests/test_duration_resolver_10r19.ts`

In `shopofbow`:

- `reports/agent-v3/STEP_10R19_AGENT_DURATION_RESOLVER_MAINTENANCE_REPORT.md`

## Required next step

Authorize a separate host dependency pin update to `47d6432c1366226eaa5143e06ff6efa58aacdcee`, then rerun independent production/local browser duration cases. Do not claim the public production fix until the host pin, Vercel artifact, and browser behavior are reverified.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.19
STANDALONE AGENT DURATION RESOLVER MAINTENANCE
============================================================

STANDALONE AGENT:
@bow/agent@3.3.0

OLD AGENT SHA:
48602221e054877f51a4e564b77712d8f5b27f75

NEW AGENT SHA:
47d6432c1366226eaa5143e06ff6efa58aacdcee

ROOT CAUSE:
Generic bare "thang" alias returned 1 month for unmatched numeric months

BEFORE:
24 MONTHS → 1 MONTH

BEFORE STATUS:
FAIL — SILENT DOWNGRADE

1 MONTH:
PASS
3 MONTHS:
PASS
6 MONTHS:
PASS
12 MONTHS:
PASS
1 YEAR:
PASS
6 THANG:
PASS
24 MONTHS:
PASS — PRESERVED AS 24
24 THANG:
PASS — PRESERVED AS 24
UNSUPPORTED DURATION:
PASS — NO DOWNGRADE
NO SILENT DOWNGRADE:
PASS
YOUTUBE:
PASS — GENERAL RESOLVER TEST
NETFLIX:
PASS — GENERAL RESOLVER TEST
CHATGPT:
PASS — GENERAL RESOLVER TEST
GENERIC PRODUCT:
PASS — GENERAL RESOLVER TEST
REGRESSION TESTS:
PASS — 18/18 NEW; 126/126 EXISTING
NEGATIVE TESTS:
PASS
PACKAGE BUILD:
PASS
DIST:
PASS
HOST COMPATIBILITY:
PASS — READ-ONLY; HOST PIN UPDATE REQUIRED NEXT
AGENTHOSTBRIDGE:
UNCHANGED
FRONTEND CHANGES:
0
SUPABASE CHANGES:
0
DATABASE CHANGES:
0
MIGRATION CHANGES:
0
VERCEL CHANGES:
0
DEPLOYMENTS:
0
PRODUCTION MUTATIONS:
0
FINANCIAL MUTATIONS:
NOT EXECUTED
BROWSER:
NOT EXECUTED — RESERVED FOR NEXT STEP

REPORT:
reports/agent-v3/STEP_10R19_AGENT_DURATION_RESOLVER_MAINTENANCE_REPORT.md

FINAL CERTIFICATION:
PASS — STANDALONE DURATION RESOLVER FIXED

============================================================
```
