# BOW AGENT V3.3 — STEP 10R.18

## Final Public Browser Gate Closure

**Report ID:** `BOW-P72-STEP10R18-FINAL-PUBLIC-BROWSER-GATE-CLOSURE-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Date:** 2026-09-02  
**Status:** **FAIL — public browser duration gate failed**

## Executive Summary

Step 10R.18 used independent fresh browser cases rather than reusing the unreliable Step 10R.17 batch harness. Chrome/CDP and local Vite were recovered successfully. React mounted, Agent open/close/reopen worked, V3.3 branding was present, the live catalog was queried, and the 1-, 6-, 12-month and 1-year YouTube cases resolved correctly.

The mandatory negative duration case exposed a real public defect: `Mua YouTube Premium 24 tháng` returned `Slot 1 tháng (1 tháng) — 35.000đ`. This is a silent downgrade and fails the critical gate. Certification stopped immediately; checkout, responsive, HMR, session reset and security-interaction gates were not continued.

## Git baseline and safety

- Branch: `main`.
- Initial/final HEAD: `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec`.
- Initial/final `origin/main`: same SHA.
- Working tree: existing owner changes preserved.
- No commit, push, reset, clean, restore, or deployment.
- No source, package, Vercel, database, migration, or production change.

## Chrome/CDP and local runtime

| Check | Result |
|---|---|
| Chrome executable | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Chrome version | `152.0.7977.65` |
| Isolated profile | PASS |
| CDP | PASS — `127.0.0.1:9223` |
| Vite | PASS — `http://127.0.0.1:5174/` |
| HTTP | `200` |
| React `#root` | PASS |
| Page title | `BOW — Let's Connect` |
| Existing Chrome profile | Preserved |

The approved external environment was loaded only into the Vite child process. No secret value was printed and no repository `.env` was created.

## Browser baseline and Agent UI

| Case | Expected | Actual evidence | Verdict |
|---|---|---|---|
| Open | Modal/V3.3 visible | Agent button opened modal; `BOW Agent`, `V3.3` visible | PASS |
| Close | Modal disappears | Send control/modal content disappeared after close | PASS |
| Reopen | One clean V3.3 modal | Modal reopened with send control and V3.3 branding | PASS |
| Console | No unexpected error | `0` console errors observed in cases | PASS |
| Exceptions | None | `0` uncaught exceptions observed | PASS |
| Network | No failed requests | `0` failed requests observed | PASS |

Legacy V2 branding was absent. The safe catalog action returned a live response reporting 32 products and representative current catalog entries. No duplicate response or mutation was observed.

## Duration matrix — independent cases

Live product selected from the catalog response: **YouTube Premium**. Its live response showed plans: Slot 1 month `35.000đ`, Slot 3 months `189.000đ`, Slot 6 months `280.000đ`, Slot 12 months/1 year `450.000đ`.

| Case | User intent | Product | Requested | Resolved plan | Resolved duration | Price | Verdict |
|---|---|---|---:|---|---:|---:|---|
| 1 | `Mua YouTube Premium 1 tháng` | YouTube Premium | 1 month | Slot 1 tháng | 1 month | 35.000đ | PASS |
| 2 | `Mua YouTube Premium 6 tháng` | YouTube Premium | 6 months | Slot 6 tháng | 6 months | 280.000đ | PASS |
| 3 | `Mua YouTube Premium 12 tháng` | YouTube Premium | 12 months | Slot 12 tháng | 12 months / 1 year | 450.000đ | PASS |
| 4 | `Mua YouTube Premium 1 năm` | YouTube Premium | 1 year | Slot 12 tháng | 12 months / 1 year | 450.000đ | PASS |
| 5 | `Mua YouTube Premium 6 thang` | YouTube Premium | 6 months | Slot 6 tháng | 6 months | 280.000đ | PASS |
| 6 | `Mua YouTube Premium 24 tháng` | YouTube Premium | 24 months | Slot 1 tháng | 1 month | 35.000đ | **FAIL — SILENT DOWNGRADE** |

Required negative behavior for case 6 was unavailable/clarification or an authoritative 24-month plan. Actual behavior silently selected 1 month. `NO SILENT DOWNGRADE: FAIL`.

## Root cause investigation

The failing browser path uses the standalone package `@bow/agent@3.3.0`, pinned to `48602221e054877f51a4e564b77712d8f5b27f75`. Read-only inspection of installed `node_modules/@bow/agent/dist/core/intentResolver.js` shows:

- the one-month expression includes a broad `thang` alternative, so any unmatched numeric month can resolve to `1 tháng`;
- the package dist does not contain the numeric-month fallback needed to preserve `24 tháng` as an explicit unavailable duration;
- the downstream plan matcher therefore receives/selects the one-month result.

The host archive source has related duration code, but production browser routing remains through `AgentHostBridge` and the standalone package. No speculative fix was applied. A standalone `bow-agent` maintenance/release task is required before recertification.

## Action cards, checkout and mutation safety

The safe catalog action was executed once and passed. Mutation-capable cards were not executed. Checkout UI was not opened because the critical duration gate failed. Payment, wallet, order, refund, warranty, webhook, entitlement and admin mutations were not executed.

## Remaining public gates

Checkout mapping, desktop `1440x900`, mobile `390x844`, HMR, session reset and browser storage/cookie/network secret inspection were not executed after the hard stop. User A, User B and Admin remain blocked without approved sessions. Production was only checked read-only; no deploy or production mutation occurred.

## Production and static invariants

Production HTTP GET returned `200`. Previously verified static artifact invariants remain: `mock.supabase.co = 0`, legacy V2 markers `= 0`, V3.3 markers present, `dotenv = 0`, `configDotenv = 0`, `process.cwd = 0`, `path.resolve = 0`. These do not override the reproduced browser duration defect.

## Hard-coded fallback audit

Product names such as YouTube, Netflix and ChatGPT occur in legitimate UI, resolver aliases, documentation and test/knowledge fixtures. This step did not prove a hard-coded product fallback. The proven failure is duration fallback in the standalone resolver package.

## Cleanup and changed files

Temporary test harness/profile and local test resources were cleaned or stopped where possible; existing user Chrome sessions were not terminated. Only this report was created by Step 10R.18. Source changes `0`; package changes `0`; deployments `0`; database/migration changes `0`.

## Required next action

Create a separately authorized standalone `bow-agent` maintenance task to fix the proven `24 tháng` parsing/downgrade defect, publish/pin the corrected immutable commit, then rerun the independent duration matrix before any final public certification. Do not certify or open checkout testing against the current package behavior.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.18
FINAL PUBLIC BROWSER GATE CLOSURE
============================================================

CHROME:
PASS
CDP:
PASS — 127.0.0.1:9223
LOCAL VITE:
PASS — 127.0.0.1:5174
REACT:
PASS
AGENT OPEN:
PASS
AGENT CLOSE:
PASS
AGENT REOPEN:
PASS
V3.3:
PASS
LEGACY V2:
ABSENT
LIVE CATALOG:
PASS

1 MONTH:
PASS — 1 month, 35.000đ
6 MONTHS:
PASS — 6 months, 280.000đ
12 MONTHS:
PASS — 12 months/1 year, 450.000đ
1 YEAR:
PASS — 12 months equivalent, 450.000đ
6 THANG:
PASS — 6 months, 280.000đ
24 MONTHS:
FAIL — SILENTLY DOWNGRADED TO 1 MONTH
NO SILENT DOWNGRADE:
FAIL

ACTION CARDS:
PASS — SAFE CATALOG ACTION
CHECKOUT UI:
NOT EXECUTED — CRITICAL DURATION FAILURE
DESKTOP 1440x900:
NOT EXECUTED
MOBILE 390x844:
NOT EXECUTED
HMR:
NOT EXECUTED
SESSION RESET:
NOT EXECUTED
BROWSER SECRET SCAN:
NOT EXECUTED

PRODUCTION HTTP:
PASS — 200 READ-ONLY
PRODUCTION MUTATIONS:
0
DATABASE CHANGES:
0
DEPLOYMENTS:
0
USER A:
BLOCKED
USER B:
BLOCKED
ADMIN:
BLOCKED
FINANCIAL MUTATIONS:
NOT EXECUTED
SOURCE CHANGES:
0
BOW-AGENT SOURCE CHANGES:
0

REPORT:
reports/agent-v3/STEP_10R18_FINAL_PUBLIC_BROWSER_GATE_CLOSURE_REPORT.md

FINAL:
FAIL — PUBLIC BROWSER GATE FAILED

============================================================
```
