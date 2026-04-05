# Generation Pipeline Continuation: Compatibility Retirement (2026-04-05)

Last updated: 2026-04-05  
Status: Active
Parent plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`
Tracker index: `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`

## Purpose
This subplan removes fallback behavior after the canonical path is stable.

## Scope
In scope:
1. metadata fallback reads
2. legacy direct submit
3. request-id repair that exists only to cover old split authority
4. compatibility metadata on status and projection surfaces
5. projection/publication cleanup that no longer protects the forward path
6. compatibility-only status/repair branches that still exist only because older rows are present

Out of scope:
1. new lifecycle authority
2. client demotion work
3. Reference Grid presentation cleanup unless it is directly tied to removing compatibility

## Keep
These surfaces stay in place as migration or shared helpers:
1. `frontend/lib/server/api/generationProjection.ts`
2. `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
3. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`

## Execution Rows
| Row ID | Work Item | Before / After | Entry Gate | Exit Gate | Targeted Validation | Full Gates | Rollback Note | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CR-01` | Lock compatibility-retirement contract | Before: fallbacks are described as part of the shared plan. After: they are isolated as temporary seams with deletion triggers. | Master plan published; server authority cutover stable | Compatibility seams are labeled and bound to deletion criteria | docs review; fallback inventory check | `npm -C frontend run docs:check` | Revert planning edits only | `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md` | Complete |
| `CR-02` | Remove direct-submit legacy path | Before: submit can still bridge old and new behavior. After: the canonical submit path is the only forward path. | Canonical path populated; read stability evidenced | Legacy direct submit is no longer needed for live user-facing flows | metadata-fallback regression tests; submit-path coverage | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Re-enable only the smallest necessary compatibility seam | `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/generationSubmitPersistence.ts` | Temporary keep |
| `CR-03` | Retire metadata fallback reads and repair-only seams | Before: status and projection surfaces still fall back to legacy metadata or repair old split authority. After: canonical outputs are primary and compatibility is bounded. | Canonical path populated; read stability evidenced | Remaining fallback reads are historical-only, not forward-path protection | historical-row coverage; status-read regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Keep canonical path live | `frontend/lib/server/api/falStatusPersistedResults.ts`, `frontend/lib/server/api/generationProjection.ts`, `frontend/lib/server/api/generationBilling/settlementService.ts` | Temporary keep |
| `CR-04` | Keep shared helper layers narrow and reversible | Before: the plan risked treating shared media/read-model helpers as deletion targets. After: those helpers remain keep-only while compatibility retirement focuses on actual fallback branches. | Status/read cutover stable; canonical output read path evidenced | Shared helper surfaces stay in place and do not grow new fallback behavior | helper inventory check; read-model regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Keep the canonical path live | `frontend/lib/server/api/generationProjection.ts`, `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` | Complete |
| `CR-05` | Validate and close out | Before: compatibility retirement is still in progress. After: remaining compatibility seams are explicitly time-bound or removed. | Main compatibility removals complete | The remaining seams are only historical-read compatibility | end-to-end flow validation; docs/SOP parity checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Roll back the smallest cutover last | `docs/sops/sop_generation_recovery_diagnostics.md` | In progress |

## Bucket Rules
1. Do not keep a fallback just because it is familiar.
2. Delete compatibility seams only after the live user-facing flow is stable without them.
3. Never reclassify a compatibility seam as permanent authority.

## Current Audit Notes
1. The legacy direct-submit seam is explicitly compatibility-only and the runtime fails closed by default when no queued path is selected unless the legacy fallback is deliberately re-enabled.
2. The remaining legacy terminal-failure fallback in `falStatusPersistedResults.ts` is still needed for historical rows that may lack projection-backed failure coverage.
3. No further compatibility-retirement code cut is justified from repo evidence alone; the next deletion decisions require operational/runtime evidence rather than more local cleanup.

## Runtime Evidence Snapshot (2026-04-05)
Read-only staging snapshot taken from local workspace credentials:
1. legacy direct-submit rows are still present in the live dataset:
   - last 7 days: `16`
   - last 30 days: `16`
   - last 90 days: `16`
2. sampled failed `ai_generations` rows still lack projection-backed failure coverage at meaningful volume:
   - failed rows sampled: `354`
   - sampled rows without projection-backed failure coverage: `353`
   - uncovered rows in last 7 days: `9`
   - uncovered rows in last 30 days: `78`
3. interpretation:
   - direct-submit fallback is not deletable yet from repo changes alone because it is still present in recent runtime data
   - legacy terminal-failure fallback is still carrying historical read compatibility and cannot be retired safely without a separate backfill/runtime cleanup lane
