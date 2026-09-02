# BOW AGENT V3.3 — PHASE 7.2 — STEP 10R.20

## Host Agent Pin Update & Public Duration Re-certification

**Report ID:** `BOW-P72-STEP10R20-HOST-PIN-UPDATE-DURATION-RECERT-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Standalone Agent:** `@bow/agent@3.3.0`  
**Status:** **PASS — host consumes fixed Agent and public duration gate passes**

## Executive Summary

The host dependency was updated from standalone Agent SHA `48602221...` to the fixed immutable SHA `47d6432...`. A forced dependency refresh proved that `node_modules/@bow/agent` actually contains the corrected generated resolver; ordinary npm install had initially retained the old cached artifact and was not accepted as proof.

Host typecheck/build passed. The real local browser then executed six independent duration cases using live YouTube Premium data. All six passed, including the critical `24 tháng` case, which returned the available-plan list without selecting or silently downgrading to another duration.

## Git baseline and dependency update

| Check | Result |
|---|---|
| Branch | `main` |
| Initial HEAD | `fb1b8a470ef96d0e9bf6643f2e685cbc70e355ec` |
| Initial `origin/main` | Same SHA |
| Host old Agent SHA | `48602221e054877f51a4e564b77712d8f5b27f75` |
| Host new Agent SHA | `47d6432c1366226eaa5143e06ff6efa58aacdcee` |
| `file:../bow-agent` | Absent |
| Working tree | Existing owner changes preserved |

Only `package.json` and `package-lock.json` were changed for the host pin. No owner changes were reset, cleaned, stashed, or restored.

## Actual resolved package proof

`npm ls @bow/agent --depth=0` reported:

```text
@bow/agent@3.3.0 (git+ssh://git@github.com/Hoanbo/bow-agent.git#47d6432c1366226eaa5143e06ff6efa58aacdcee)
```

Direct import of the installed `dist/core/intentResolver.js` returned:

```text
1 tháng => 1 tháng
6 tháng => 6 tháng
12 tháng => 12 tháng
1 năm => 1 năm
6 thang => 6 tháng
24 tháng => 24 tháng
```

## Host validation and artifact

| Gate | Result |
|---|---|
| Host typecheck | PASS |
| Host production build | PASS |
| `dist/index.html` | Present |
| `mock.supabase.co` | `0` |
| Legacy V2 markers | `0` |
| `dotenv` | `0` |
| `configDotenv` | `0` |
| `process.cwd` | `0` |
| `path.resolve` | `0` |
| V3.3 markers | `4` |

## Chrome/CDP and local runtime

Fresh isolated Chrome was used with a dedicated temporary profile and localhost-only CDP. Chrome version was `152.0.7977.65`, CDP was `127.0.0.1:9223`, and Vite served `http://127.0.0.1:5174/` with HTTP `200`. React mounted and the Agent modal showed V3.3 branding with no legacy V2 branding.

The approved external environment was loaded only into the child process. No repository `.env` was created and no secret value was printed.

## Independent browser duration matrix

Live product selected from the live Agent/catalog response: **YouTube Premium**. The response showed Slot 1 month `35.000đ`, Slot 3 months `189.000đ`, Slot 6 months `280.000đ`, and Slot 12 months/1 year `450.000đ`.

| Case | Input | Requested | Resolved plan | Resolved duration | Price | Evidence | Verdict |
|---|---|---:|---|---:|---:|---|---|
| 1 | `Mua YouTube Premium 1 tháng` | 1 | Slot 1 tháng | 1 tháng | 35.000đ | Visible `Bạn đang chọn: Slot 1 tháng (1 tháng) — 35.000đ` | PASS |
| 2 | `Mua YouTube Premium 6 tháng` | 6 | Slot 6 tháng | 6 tháng | 280.000đ | Visible `Bạn đang chọn: Slot 6 tháng (6 tháng) — 280.000đ` | PASS |
| 3 | `Mua YouTube Premium 12 tháng` | 12 | Slot 12 tháng | 12 tháng / 1 năm | 450.000đ | Visible `Slot 12 tháng (1 năm) — 450.000đ` | PASS |
| 4 | `Mua YouTube Premium 1 năm` | 12 eq. | Slot 12 tháng | 12 tháng / 1 năm | 450.000đ | Visible `Slot 12 tháng (1 năm) — 450.000đ` | PASS |
| 5 | `Mua YouTube Premium 6 thang` | 6 | Slot 6 tháng | 6 tháng | 280.000đ | Visible `Bạn đang chọn: Slot 6 tháng (6 tháng) — 280.000đ` | PASS |
| 6 | `Mua YouTube Premium 24 tháng` | 24 | No plan selected; available-plan list shown | 24 preserved as unavailable | — | Visible list of 1/3/6/12-month plans; no `Bạn đang chọn` 1-month line | PASS |

**NO SILENT DOWNGRADE = PASS.** The 24-month case did not resolve to 1, 3, 6, or 12 months.

## Browser baseline and Agent UI

| Gate | Result |
|---|---|
| React/root/page load | PASS |
| Console errors | `0` |
| Uncaught exceptions | `0` |
| Failed network requests | `0` |
| Agent open/branding | PASS — V3.3 |
| Agent close/reopen | PASS from fresh modal checks |
| AgentHostBridge browser path | PASS — response returned through host Agent path; architecture unchanged |

## Checkout, responsive and other public gates

The `Mua ngay` CTA was clicked read-only after a verified 6-month response. The checkout modal did not become observable in the available unauthenticated local flow, so checkout mapping is `BLOCKED/NOT EXECUTED`; no order or mutation occurred. Desktop and mobile overflow checks passed at `1440x900` and `390x844`, respectively. HMR and session reset were not executed.

Browser storage/cookie secret inspection was not completed; no secret was printed. User A/B/Admin remain blocked because no approved sessions were provided.

## Production safety and invariants

Production was not deployed or modified. No Vercel configuration, Supabase, database, migration, catalog, pricing, payment, wallet, order, refund, warranty, webhook, or authentication behavior was changed. Financial mutations were not executed.

## Changed files

Host files changed by Step 10R.20:

- `package.json`
- `package-lock.json`
- `reports/agent-v3/STEP_10R20_HOST_PIN_UPDATE_DURATION_RECERT_REPORT.md`

Temporary browser/harness resources were removed. Existing owner changes remain untouched and unstaged. No standalone Agent source was modified in this step.

## Remaining blockers

1. Checkout presentation requires a separately authorized/authenticated UI session; no mutation was attempted.
2. HMR, session reset, browser storage/cookie scan, and User A/B/Admin require follow-up evidence.
3. Vercel production must be redeployed/verified against the new host commit and Agent SHA in a separate authorized deployment step.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.20
HOST PIN UPDATE + PUBLIC DURATION RE-CERTIFICATION
============================================================

OLD AGENT SHA:
48602221e054877f51a4e564b77712d8f5b27f75

NEW AGENT SHA:
47d6432c1366226eaa5143e06ff6efa58aacdcee

HOST CONSUMES NEW SHA:
PASS

TYPECHECK:
PASS
BUILD:
PASS
DIST:
PASS — mock 0, V2 0, V3.3 4

CHROME/CDP:
PASS — Chrome 152.0.7977.65 / CDP 9223
LOCAL VITE:
PASS — 127.0.0.1:5174 / HTTP 200
REACT:
PASS
AGENT OPEN/CLOSE/REOPEN:
PASS
AGENTHOSTBRIDGE:
PASS
LIVE CATALOG:
PASS — YouTube Premium

1 MONTH:
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
PASS — EXPLICITLY UNAVAILABLE; NO DOWNGRADE
NO SILENT DOWNGRADE:
PASS

ACTION CARDS:
PASS — READ-ONLY DURATION RESPONSE
CHECKOUT UI:
BLOCKED/NOT EXECUTED — CTA DID NOT OPEN OBSERVABLE MODAL
DESKTOP 1440x900:
PASS — NO HORIZONTAL OVERFLOW
MOBILE 390x844:
PASS — NO HORIZONTAL OVERFLOW
HMR:
NOT EXECUTED
SESSION RESET:
NOT EXECUTED
BROWSER SECRET SCAN:
NOT EXECUTED

USER A/B:
BLOCKED
ADMIN:
BLOCKED
DATABASE CHANGES:
0
MIGRATION CHANGES:
0
VERCEL CHANGES:
0
PRODUCTION MUTATIONS:
0
FINANCIAL MUTATIONS:
NOT EXECUTED
BROWSER:
PASS — DURATION PUBLIC GATES

REPORT:
reports/agent-v3/STEP_10R20_HOST_PIN_UPDATE_DURATION_RECERT_REPORT.md

FINAL CERTIFICATION:
PASS — HOST CONSUMES FIXED AGENT AND DURATION PUBLIC GATE PASSES

============================================================
```
