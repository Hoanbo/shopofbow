# BOW AGENT V3.3 — PHASE 7.2 STEP 10R.15

## Vite Dev-Mode Root-Cause Investigation

**Report ID:** `BOW-P72-STEP10R15-VITE-DEV-ROOT-CAUSE-20260902`  
**Host:** `C:\BOW\shopofbow`  
**Production:** `https://shopofbow.vercel.app`  
**Status:** **PASS — root cause proven; no source fix required**

## Executive Summary

The apparent difference between the working production-style environment and `npm run dev` was caused by how local environment variables were supplied, not by Vite startup, HMR, AgentHostBridge, or Agent V3.3. When the required Supabase variables were absent from the Node process, `src/lib/supabase.ts` correctly failed fast. When the approved external local environment was loaded into the process, the import succeeded and `npm run dev` started normally.

No source modification was applied in Step 10R.15. The fail-fast security behavior remains unchanged. Production was not deployed or modified.

## npm run dev result

Command:

```text
npm run dev
```

Working directory: `C:\BOW\shopofbow`  
Vite mode: `development`  
Local URL: `http://localhost:5173/`  
Startup result: **PASS**  
Startup errors: none observed.

Vite itself did not fail. The earlier missing-configuration error was an application import-time failure when the process had no required env variables.

## First failure and reproduction

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` absent from the process, importing `src/lib/supabase.ts` produced:

```text
[BOW] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Configure the environment before starting the application.
NO_ENV_EXIT=7
```

Reproduction: **YES**, deterministic.  
Failure stage: **Supabase initialization/import**, before AgentHostBridge or Agent V3.3.

With the approved external environment loaded only into the process, the same import returned:

```text
IMPORT_OK
```

## Vite configuration and environment comparison

The existing Vite config uses `defineConfig(({ mode }) => ...)` and `loadEnv(mode, process.cwd(), '')`. The project root is the current working directory and no alternate `envDir` was configured. The script is exactly `"dev": "vite"`.

Safe presence comparison with the approved process configuration:

| Value | Result |
|---|---|
| `process.env.VITE_SUPABASE_URL` | PRESENT |
| `process.env.VITE_SUPABASE_ANON_KEY` | PRESENT |
| Vite `loadEnv('development', cwd, '')` URL | PRESENT |
| Vite `loadEnv('development', cwd, '')` anon key | PRESENT |
| Process cwd | `C:\BOW\shopofbow` |
| `.env` in repository | ABSENT |
| `.env.local` in repository | ABSENT |
| `.env.development` in repository | ABSENT |
| `.env.development.local` in repository | ABSENT |
| Approved external backup | PRESENT |

No environment value was printed or copied into the repository.

## Build comparison

With the approved process environment, local typecheck/build passed and the generated artifact remained clean:

| Check | Result |
|---|---|
| Host typecheck | PASS |
| Host production build | PASS |
| `dist/index.html` | PRESENT |
| `mock.supabase.co` | `0` |
| Legacy V2 markers | `0` |
| V3.3 markers | `4` |
| `dotenv` | `0` |
| `configDotenv` | `0` |
| `process.cwd` | `0` |
| `path.resolve` | `0` |

## Browser and HMR

Chrome was present, but no reachable CDP endpoint was available at `127.0.0.1:9222`. Therefore local React/browser runtime, console, network, Agent UI, HMR behavior, and browser functional paths were not certified. No browser result was inferred from server startup.

Classification of the observed failure is startup/import-time environment-dependent, not HMR-only. HMR remains `NOT EXECUTED` because the browser endpoint was unavailable.

## Working mode identification

The working reference is the deployed Vercel production application. It has Vercel-provided configuration and is known to serve the clean artifact. The local `npm run dev` process differs because the repository intentionally has no local env file and Vite cannot discover the approved backup outside the repository unless the operator loads it into the process.

## Agent and dependency analysis

- `@bow/agent@3.3.0`.
- Agent SHA: `48602221e054877f51a4e564b77712d8f5b27f75`.
- `file:../bow-agent`: absent.
- AgentHostBridge: unchanged.
- No agent package/import defect was reproduced.
- No standalone source change.

## Root cause decision

**ROOT CAUSE CLASS: PROCESS ENV PROPAGATION / VITE ENV LOADING**

The fail-fast Supabase implementation is correct. `npm run dev` succeeds when the required variables are present in the process; it fails before application runtime when they are not. Production succeeds because Vercel injects its Production configuration during deployment/build.

## Minimal safe fix recommendation

Use an approved local process wrapper or terminal setup that loads the external local env backup before `npm run dev`, tests, and builds. Do not create `.env` in the repository, copy production secrets, alter Vite config, or restore a mock endpoint.

## Changes applied

No application or configuration source change was applied in Step 10R.15. Only this report was created. The local process environment used for diagnosis was temporary and not persisted in the repository.

## Production and Git safety

- Production read-only HTTP check: `200`.
- Deployments: `0`.
- Database changes: `0`.
- Migration changes: `0`.
- Financial mutations: `NOT EXECUTED`.
- Working-tree owner changes preserved.
- No staging, commit, push, reset, restore, clean, or force push.
- `public/_redirects` was not restored or modified.

## Remaining blockers

Real browser certification requires a reachable Chrome/CDP endpoint. Authenticated QA remains unavailable without approved sessions. Historical credential rotation remains `NOT CONFIRMED`.

## Final Certification

```text
============================================================
BOW AGENT V3.3 — STEP 10R.15
VITE DEV-MODE ROOT-CAUSE INVESTIGATION
============================================================

PRODUCTION:
WORKING — PROTECTED

npm run dev:
PASS

VITE STARTUP:
PASS

VITE ENV:
PASS — loadEnv receives process configuration

PROCESS ENV:
PASS with approved process environment

IMPORT.META.ENV:
PASS by Vite loadEnv diagnostic

SUPABASE IMPORT:
PASS with env; fail-fast without env as designed

BROWSER:
BLOCKED — CDP ENDPOINT UNAVAILABLE

FIRST CONSOLE ERROR:
NOT AVAILABLE — BROWSER NOT CONNECTED

HMR:
NOT EXECUTED

WORKING MODE:
Vercel production with injected environment

ROOT CAUSE:
LOCAL ENVIRONMENT / PROCESS ENV PROPAGATION

WHY WORKING MODE SUCCEEDS:
Vercel provides Production VITE_* configuration

WHY npm run dev FAILS:
Missing local process variables causes intentional Supabase fail-fast

SOURCE CHANGES:
0

BOW-AGENT SOURCE CHANGES:
0

DEPLOYMENTS:
0

DATABASE CHANGES:
0

MIGRATION CHANGES:
0

FINANCIAL MUTATIONS:
NOT EXECUTED

PRODUCTION CHECK:
PASS — HTTP 200

REPORT:
reports/agent-v3/STEP_10R15_VITE_DEV_ROOT_CAUSE_REPORT.md

FINAL:
PASS — ROOT CAUSE PROVEN

============================================================
```
