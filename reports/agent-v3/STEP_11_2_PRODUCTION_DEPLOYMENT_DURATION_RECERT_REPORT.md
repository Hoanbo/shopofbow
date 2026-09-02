# BOW AGENT V3.3 — PHASE 7.2 — STEP 11.2

## Production Deployment Completion, Immutable SHA Verification & Production Duration Re-certification

**Report ID:** `BOW-P72-STEP11-2-PRODUCTION-DURATION-RECERT-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Standalone Agent:** `C:\BOW\bow-agent`  
**Production:** `https://shopofbow.vercel.app`  
**Status:** **PASS — production deployment and duration re-certification verified**

## Executive summary

The Step 11.1 commit was deployed automatically by Vercel Git Integration. The production deployment reached `READY`, and its explicit Git SHA exactly matches the host `HEAD` and `origin/main`. Remote package metadata and the deployed source commit prove that production consumes `@bow/agent@3.3.0` at immutable SHA `47d6432c…`.

A fresh isolated Chrome/CDP session independently verified all six production duration cases. Five valid durations selected the correct YouTube Premium plan and price. The critical 24-month case preserved the requested duration and displayed the authoritative available plans without silent downgrade. No checkout, payment, wallet, order, refund, warranty, webhook, or database mutation was executed.

## Git proof

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `4ac892d3cc085af0fced5c2a7c92645f701fa7b0` |
| origin/main | `4ac892d3cc085af0fced5c2a7c92645f701fa7b0` |
| Required host commit | MATCH |
| Working tree | Dirty only with preserved owner/untracked report changes |
| Unrelated files in release commit | `0` |

Remote `package.json` and `package-lock.json` both contain the new agent SHA `47d6432c1366226eaa5143e06ff6efa58aacdcee`.

## Agent and host verification

- Standalone `bow-agent` HEAD/origin: `47d6432c1366226eaa5143e06ff6efa58aacdcee`.
- Standalone working tree: clean.
- Host installed package: `@bow/agent@3.3.0`, resolved to the same SHA.
- Installed generated resolver returned `1 tháng`, `6 tháng`, `12 tháng`, `1 năm`, `6 tháng`, and `24 tháng` for the six corresponding inputs.
- Prior standalone regression: `126/126 PASS`.

## Vercel deployment proof

| Field | Result |
|---|---|
| Deployment URL | `https://shopofbow-bk64uxwf8-bobowcon.vercel.app` |
| Target | `production` |
| State | `READY` |
| Vercel Git SHA | `4ac892d3cc085af0fced5c2a7c92645f701fa7b0` |
| SHA equality | PASS — Git = Vercel |
| Commit message | `fix(agent): pin host to corrected duration resolver` |
| Git Integration | PASS — automatic deployment |
| Manual deployment | Not performed |

## Build and production artifact

Host typecheck/build passed before release. Production read-only verification returned HTTP `200`, active asset `/assets/index-XUAMEgnT.js`, and:

| Scan | Result |
|---|---|
| `mock.supabase.co` | `0` |
| Legacy V2 markers | `0` |
| `dotenv` / `configDotenv` | `0` |
| `process.cwd` / `path.resolve` | `0` |
| V3.3 markers | present |

## Production browser baseline

A fresh isolated Chrome `152.0.7977.65` profile with localhost CDP `127.0.0.1:9224` was used. Each case independently navigated to the production URL, opened the Agent, entered one query, and captured the visible response. The application rendered with React and V3.3 branding. No fatal console/runtime failure or blank page was observed. CDP recorded one `Network.loadingFailed` event during the first navigation; the event was not user-visible and no failed application flow was reproduced, so it is recorded rather than hidden.

## Production duration matrix

| Input | Product | Requested | Visible resolved plan | Price | Verdict |
|---|---|---:|---|---:|---|
| `Mua YouTube Premium 1 tháng` | YouTube Premium | 1 month | `Slot 1 tháng (1 tháng)` | `35.000đ` | PASS |
| `Mua YouTube Premium 6 tháng` | YouTube Premium | 6 months | `Slot 6 tháng (6 tháng)` | `280.000đ` | PASS |
| `Mua YouTube Premium 12 tháng` | YouTube Premium | 12 months | `Slot 12 tháng (1 năm)` | `450.000đ` | PASS |
| `Mua YouTube Premium 1 năm` | YouTube Premium | 1 year | `Slot 12 tháng (1 năm)` | `450.000đ` | PASS |
| `Mua YouTube Premium 6 thang` | YouTube Premium | 6 months | `Slot 6 tháng (6 tháng)` | `280.000đ` | PASS |
| `Mua YouTube Premium 24 tháng` | YouTube Premium | 24 months | No selected plan; authoritative available list showed 1/3/6/12 months | N/A | PASS — no downgrade |

For the negative case, the visible response preserved `Mua YouTube Premium 24 tháng`, listed the currently available plans, and did not display a “Bạn đang chọn” line for a shorter plan. This is explicit unavailability, not silent fallback.

## Safety and remaining gates

- Checkout CTA was not submitted.
- User A, User B, and Admin authenticated gates remain unexecuted because no approved sessions were provided.
- HMR was not executed; this was outside the production release gate and the working tree contains owner changes.
- No production configuration was changed.
- Database, migration, schema, payment, wallet, order, refund, warranty, and webhook mutations: `0`.
- No secret or environment value was printed.

## Changed files

Created only after the Step 11.1 release commit:

- `reports/agent-v3/STEP_11_2_PRODUCTION_DEPLOYMENT_DURATION_RECERT_REPORT.md`

The report remains uncommitted. No source or configuration file was changed in Step 11.2.

## Final certification

```text
============================================================
BOW AGENT V3.3 — STEP 11.2
PRODUCTION DEPLOYMENT + DURATION RE-CERTIFICATION
============================================================

HOST HEAD:
4ac892d3cc085af0fced5c2a7c92645f701fa7b0

ORIGIN/MAIN:
4ac892d3cc085af0fced5c2a7c92645f701fa7b0

STANDALONE AGENT SHA:
47d6432c1366226eaa5143e06ff6efa58aacdcee

HOST AGENT SHA:
47d6432c1366226eaa5143e06ff6efa58aacdcee

INSTALLED AGENT SHA:
47d6432c1366226eaa5143e06ff6efa58aacdcee

TYPECHECK:
PASS

BUILD:
PASS

ARTIFACT:
PASS

VERCEL DEPLOYMENT:
READY

VERCEL SOURCE SHA:
4ac892d3cc085af0fced5c2a7c92645f701fa7b0

SHA MATCH:
PASS

PRODUCTION HTTP:
PASS — 200

PRODUCTION REACT:
PASS

AGENT UI:
PASS

LIVE CATALOG:
PASS — YouTube Premium

1 MONTH:
PASS — Slot 1 tháng, 35.000đ

6 MONTHS:
PASS — Slot 6 tháng, 280.000đ

12 MONTHS:
PASS — Slot 12 tháng (1 năm), 450.000đ

1 YEAR:
PASS — Slot 12 tháng (1 năm), 450.000đ

6 THANG:
PASS — Slot 6 tháng, 280.000đ

24 MONTHS:
PASS — EXPLICITLY UNAVAILABLE; NO DOWNGRADE

NO SILENT DOWNGRADE:
PASS

CHECKOUT:
NOT SUBMITTED — NO MUTATION

USER A:
BLOCKED — NO APPROVED SESSION

USER B:
BLOCKED — NO APPROVED SESSION

ADMIN:
BLOCKED — NO APPROVED SESSION

HMR:
NOT EXECUTED

SESSION RESET:
PRIOR PUBLIC EVIDENCE PASS

DATABASE CHANGES:
0

MIGRATION CHANGES:
0

PAYMENT MUTATIONS:
0

WALLET MUTATIONS:
0

ORDER MUTATIONS:
0

REFUND MUTATIONS:
0

WARRANTY MUTATIONS:
0

PRODUCTION CONFIG CHANGES:
0

SOURCE CHANGES:
0 IN STEP 11.2

BOW-AGENT SOURCE CHANGES:
0

FINAL CERTIFICATION:
PASS — PRODUCTION DEPLOYMENT AND DURATION RECERTIFICATION VERIFIED

NEXT:
STEP 11.3 — FINAL REMAINING PRODUCTION/AUTHENTICATED BROWSER GATES

============================================================
```
