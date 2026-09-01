# BOW AGENT V3.3 — PHASE 7.1 STEP 8.1

## Deployment Packaging & Repository Decoupling

**Status: PASS**  
**Date:** 2026-09-01  
**Host:** `C:\BOW\shopofbow`  
**Agent source:** `https://github.com/Hoanbo/bow-agent.git`  
**Pinned commit:** `0e297dcb7cefbaced2924fb6446fd1dbfa0bc3fc`

## Result

`shopofbow` no longer depends on the sibling path `file:../bow-agent`. The host now consumes `@bow/agent` from its standalone GitHub repository, pinned to the existing immutable commit. No source code was copied into the host.

## Validation

| Check | Result |
|---|---|
| `file:../bow-agent` removed from package manifests | PASS |
| GitHub dependency pinned to commit `0e297dc` | PASS |
| Lockfile records standalone package version 3.3.0 | PASS |
| Fresh `npm ci` without sibling dependency | PASS |
| Fresh npm cache install | PASS |
| Installed package is not a junction | PASS |
| Standalone ESM import | PASS (`SIM_ESM_IMPORT_OK`) |
| Host typecheck | PASS |
| Host production build | PASS |
| AgentHostBridge architecture | unchanged and intact |

The isolated install used `C:\BOW\shopofbow-step8-1-sim`, containing only copied host manifests and no dependency on `C:\BOW\bow-agent`. It installed 260 packages successfully with a fresh npm cache.

## Scope protection

- No `bow-agent` history was recreated, reset, force-pushed, or modified.
- No database schema or migration changed.
- No business, pricing, warranty, negative-policy, transaction, or UI behavior changed.
- No `bow-robot` change.
- Step 9 was not performed.
- Step 8 remediation items were not changed.

## Known npm audit output

The existing dependency tree reports 15 vulnerabilities (6 moderate, 9 high). `npm audit fix` was intentionally not run because it could change versions and behavior outside this packaging task.

## Certification

```text
PHASE 7.1 STEP 8.1
STATUS: PASS
DEPENDENCY SOURCE: GitHub standalone repository
PINNED COMMIT: 0e297dc
SIBLING DIRECTORY REQUIRED: NO
FRESH INSTALL: PASS
TYPECHECK: PASS
PRODUCTION BUILD: PASS
DATABASE CHANGES: 0
BUSINESS BEHAVIOR CHANGES: 0
STEP 9: NOT STARTED
```
