# Generation Pipeline Rebuild Compatibility Retirement Classification (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This document completes `GPR-CR-S2` by classifying the remaining compatibility paths named in the inventory.

It answers:
1. which paths are acceptable bounded carry-forward
2. which should be retired in a later explicit cleanup lane
3. whether any path still blocks the broader rebuild from being called done at the current checkpoint

## Classification
| Surface | File | Disposition | Why |
| --- | --- | --- | --- |
| Recovery lookup `request_id` fallback | `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts` | Keep as bounded compatibility | It is still useful for older/transitional rows, but it no longer acts as the primary lifecycle authority |
| Internal source compatibility hint URL | `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts` | Keep as bounded compatibility | It is identity-gated and no longer upgrades raw generated payload URLs into durable reuse authority |
| Download fallback to storage/saved media ids | `frontend/features/ai-studio/logic/referenceDownload.ts` | Keep as bounded compatibility | It preserves older or partially persisted output downloads without displacing canonical output linkage when available |
| Preview-only generated render fallback | `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` | Keep as bounded compatibility | View-only rendering for preview-only generated outputs is intentional and does not imply durable reusable authority |
| Admin generation trace legacy lookups | `frontend/pages/api/admin/generation-trace.ts` | Keep as diagnostic compatibility | Operator usefulness across mixed historical rows is still worth preserving |
| Admin user health schema fallback reads | `frontend/pages/api/admin/user-health.ts` | Keep as diagnostic compatibility | These warnings and fallback reads are diagnostic and do not compete with runtime authority |

## Retirement Posture
### Keep now
The following paths should remain in place at the current checkpoint:
1. `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`
2. `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
3. `frontend/features/ai-studio/logic/referenceDownload.ts`
4. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
5. `frontend/pages/api/admin/generation-trace.ts`
6. `frontend/pages/api/admin/user-health.ts`

### Retire later
No inventoried path should be retired immediately inside the rebuild closeout lane.

If a future cleanup/removal lane opens, the strongest first retirement candidate is:
1. `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts` request-id fallback

But only after:
1. historical containment evidence is sufficient
2. recovery lookup no longer needs to protect transitional rows
3. a rollback packet exists for the removal

### Retire now
None.

## Closeout Interpretation
This classification means:
1. the rebuild does not need more authority refactoring to be considered complete at the current checkpoint
2. the remaining compatibility logic is intentionally bounded and mostly read-only or diagnostic
3. future deletion/removal work should be treated as a separate cleanup lane, not a prerequisite for rebuild completion

## Rebuild Done-State Decision
At the current checkpoint, the broader rebuild can be considered done if we accept the following statement:
1. canonical request/attempt/output authority is the primary runtime model
2. historical and preview-only compatibility remains bounded behind explicit non-primary paths
3. remaining compatibility logic is intentional carry-forward, not unresolved authority drift
4. any future deletion/removal work is optional cleanup unless a new concrete risk appears
