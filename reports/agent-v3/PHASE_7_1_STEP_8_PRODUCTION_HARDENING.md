# BOW AGENT V3.3 — PHASE 7.1 STEP 8

## Production Hardening, Deployment Validation & Observability

**Status: FAIL — not certified**  
**Date:** 2026-09-01  
**Host:** `C:\BOW\shopofbow`  
**Standalone package:** `C:\BOW\bow-agent` (`@bow/agent` 3.3.0)

## Executive Summary

Step 8 validation was continued from the existing Step 7 state. TypeScript compilation, host production build, package tarball creation, ESM import after hardening, import-boundary checks, failure isolation D1–D8, and PII sanitization checks passed.

Certification is **not granted** because the dedicated suite still has genuine failures: telemetry injection and provider-spy tests do not match the current API, measured live-provider latency is 14–28 seconds, and the historical regression registry was not rerun to completion in this pass.

## Changes made

- Synchronized `shopofbow/package-lock.json` with the already-declared `file:../bow-agent` dependency. `npm ci --dry-run --ignore-scripts --offline` passed.
- Normalized relative internal imports in `bow-agent/src` to explicit `.js` ESM specifiers and changed barrel imports to `contracts/index.js`.
- Rebuilt `bow-agent` and `shopofbow`.

The ESM change fixed a real deployment defect: a clean tarball install previously failed with `ERR_UNSUPPORTED_DIR_IMPORT` at `dist/contracts`.

## Validation results

| Area | Result | Evidence |
|---|---|---|
| Standalone typecheck | PASS | `npx tsc -b --noEmit` |
| Host typecheck | PASS | `npm run typecheck` |
| Host production build | PASS | `npm run build` |
| Tarball packaging | PASS | `npm pack --dry-run` and tarball install |
| Clean package install | PASS | isolated `npm install` from tarball with dependencies |
| ESM runtime resolution | PASS | isolated `import('@bow/agent')` → `ESM_IMPORT_OK` |
| Production import audit | PASS | modal routes through `AgentHostBridge`; local core retained rollback-only |
| Failure isolation D1–D8 | PASS | dedicated Step 8 suite |
| PII sanitization | PASS | phone, email, password, token, API-key and auth-header cases |
| Telemetry assertion E1 | FAIL | test expects unsupported `track` capture; current provider contract is `recordEvent` |
| User-provider spy F4 | FAIL | test passes unsupported per-call `{ adapter }` argument; active adapter is registry-based |
| Performance H1–H3 | FAIL | live provider calls measured approximately 14–28 seconds |
| Historical regression | NOT COMPLETE | long-running live-provider suite stopped before registry completion |

## Deployment and ESM finding

The original generated package used extensionless internal imports. Node 24 ESM could not load the packed package. After explicit specifier normalization, the packed package installed and imported successfully in an isolated directory without the development junction.

The host still declares `@bow/agent` as `file:../bow-agent`. This is valid for the checked-out sibling-directory simulation but is not independently deployable when a platform receives only `shopofbow`. Final package consolidation or private registry publication is intentionally outside this Step 8 pass and must be resolved before a platform-only deployment claim.

## Security and transaction boundary

No database schema, migration, pricing, warranty, negative-policy, autonomous-order, wallet-deduction, or refund behavior was changed. Browser/Node boundary scans remained clean for React, Supabase, `window`, `document`, storage globals, and `shopofbow` imports in the standalone source.

## Files modified

- `package-lock.json` in `shopofbow`.
- Existing user changes in `package.json`, bridge/UI, adapter/contracts, and archived local-agent files were preserved.
- `bow-agent/src` relative import specifiers were normalized for Node ESM; `bow-agent/dist` was rebuilt.

## Files created / deleted / moved / renamed

- Created: this report only as part of this Step 8 continuation.
- Deleted: none.
- Moved: none.
- Renamed: none.
- Temporary tarball, deployment sandbox, and npm cache used for validation were removed.

## Database and business behavior

- Database changes: **0**.
- Migration changes: **0**.
- Local Agent Core deletion: **0**.
- `bow-robot` changes: **0**.
- Material business behavior changes: **0**.

## Remaining risks

1. The host dependency remains sibling-path based and needs a deployment packaging decision.
2. The Step 8 harness needs adapter injection aligned with the registry/API contract before certification.
3. Live provider latency violates the current synthetic threshold; a deterministic offline adapter or a separately measured provider timeout budget is required.
4. Full historical regression must complete before certification.

## Recommendation

Do not proceed to Step 9. First resolve the deployment packaging decision, correct the Step 8 harness/API mismatch, establish deterministic performance fixtures, then rerun the complete historical and Step 8 registries.

## Certification

```text
PHASE 7.1 STEP 8
STATUS: FAIL
ESM PACKAGED IMPORT: PASS
TYPECHECK/BUILD: PASS
DATABASE CHANGES: 0
MIGRATION CHANGES: 0
BOW-ROBOT CHANGES: 0
CERTIFICATION: NOT GRANTED
```
