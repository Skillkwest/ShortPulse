# Generation Pipeline Rebuild Master Roadmap (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This roadmap defines the remaining rebuild lanes after Phase 3 runtime-authority hardening.

It is intentionally lightweight. It exists to:
1. lock sequencing
2. prevent adjacency drift
3. define stop/go gates between lanes

## Remaining Lanes
### Lane 1: Request/Attempt State Machine
Goal:
1. replace the current split lifecycle authority with one server-owned request/attempt model

Primary surfaces:
1. `frontend/lib/server/api/falSubmitProxy.ts`
2. `frontend/lib/server/api/generationBilling.ts`
3. `frontend/lib/server/api/generationQueue/dispatch.ts`
4. `frontend/lib/server/api/generationQueue/service.ts`
5. `frontend/lib/server/falIntegration/recoveryExecution.ts`
6. `frontend/lib/server/api/falStatusProxy.ts`

Exit gate:
1. request state, attempt lineage, and billing linkage are modeled explicitly enough that submit, queue, webhook, recovery, and status no longer act as competing lifecycle authorities

### Lane 2: Historical Backfill And Legacy Fallback Retirement
Goal:
1. make historical success generations and saved outputs converge into canonical `ai_generation_outputs`
2. retire legacy output-authority fallbacks safely

Primary surfaces:
1. `sql/migrations/022_generation_persist_idempotency.sql`
2. `frontend/lib/server/api/falStatusPersistedResults.ts`
3. `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`
4. `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
5. `frontend/pages/api/media/copy-from-url.ts`
6. admin/trace tooling and backfill scripts to be introduced

Exit gate:
1. historical generations can be read from canonical output rows with bounded, explicit fallback only where backfill has not yet completed

### Lane 3: Delivery And Read-Model Cutover
Goal:
1. make canonical output records and storage-backed media the main reusable/readable authority across user-facing surfaces

Primary surfaces:
1. Reference Grid read model
2. drag/drop and reuse contracts
3. generated download/export resolution
4. any remaining generated-output preview/detail derivations

Exit gate:
1. generated output display, reuse, and drag/drop rely on canonical output/storage authority rather than mixed heuristics

### Lane 4: Migration Safety, Ops, And Cleanup
Goal:
1. finish the rebuild with safe rollout, traceability, cleanup, and legacy removal

Primary surfaces:
1. operator SOPs
2. admin trace/health views
3. canary/backfill validation
4. compatibility-path decommission

Exit gate:
1. old compatibility paths can be removed intentionally with rollback evidence and operator clarity

## Sequencing Rules
1. Lane 1 comes first.
2. Lane 2 must not begin implementation until Lane 1 has a locked target model.
3. Lane 3 must not become a broad UI refactor before Lane 2 has historical canonical coverage.
4. Lane 4 is continuous for validation, but final cleanup belongs last.

## Stop Rules
Stop the current lane when:
1. the next step does not materially close that lane's exit gate
2. the next step would widen into another lane
3. the remaining work becomes operational backfill/governance rather than implementation in the active lane

## Immediate Next Move
1. advance Lane 1 into `GPR-L1-S3` and define target schema deltas plus compatibility posture with `ai_generations`
2. do not open Lane 2 migration work until the request/attempt target model is locked
