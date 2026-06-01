> Archived 2026-06-01 during planning cleanup. Reason: superseded by the later continuation-era compatibility-retirement lane (`docs/planning/generation-pipeline-continuation-compatibility-retirement-2026-04-05.md`); retained as historical rebuild closeout context, not active planning authority.

# Generation Pipeline Rebuild Compatibility Retirement Inventory (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document completes `GPR-CR-S1` by inventorying the remaining generation-pipeline compatibility paths that still matter to rebuild closeout.

It does not decide retirement yet.

It names:

1. where compatibility logic still exists
2. whether the path is runtime-critical, diagnostic-only, or bounded user-facing compatibility
3. which paths are candidates for later retirement versus likely long-lived compatibility

## Inventory

| Surface                              | File                                                                                                | Compatibility path                                                                                                                | Current role                      | Why it still exists                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Recovery lookup                      | `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`                                    | Falls back from `generation_attempts.provider_request_id` to `ai_generations.request_id` lookup                                   | Runtime compatibility             | Protects recovery lookup when attempt lineage is absent for older rows or transitional request records               |
| Internal generated source resolution | `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`                      | Keeps `compatibilityHintUrl` bounded behind internal identity for `payload.referenceUrl` / legacy preview URL fallback            | Bounded user-facing compatibility | Allows tracked internal sources to remain viewable/loadable when canonical storage/media evidence is not yet present |
| Reference download                   | `frontend/features/ai-studio/logic/referenceDownload.ts`                                            | Falls back from canonical generation outputs to output storage record and then `savedMediaIds`                                    | Bounded user-facing compatibility | Preserves download behavior for older or partially persisted outputs while canonical output linkage catches up       |
| Reference Grid preview-only fallback | `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` | Allows preview-only generated outputs to render from preview/result URL fallback even when canonical reusable authority is absent | Bounded user-facing compatibility | Viewability remains allowed for preview-only generated outputs without promoting them into durable reuse             |
| Admin generation trace               | `frontend/pages/api/admin/generation-trace.ts`                                                      | Reads `ai_generations.request_id`, metadata trace ids, and legacy source-ref metadata paths                                       | Diagnostic compatibility          | Operators still need to trace historical/transitional rows even when they predate canonical attempt authority        |
| Admin user health                    | `frontend/pages/api/admin/user-health.ts`                                                           | Uses schema-fallback selects and compatibility warnings for `ai_generations`, reservations, and queue reads                       | Diagnostic compatibility          | Health scans must remain useful across mixed-runtime or partially migrated environments                              |

## Path Classes

### 1. Runtime compatibility

These paths still affect forward runtime behavior and therefore matter most for rebuild closeout:

1. `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`

### 2. Bounded user-facing compatibility

These paths still affect what users can see or do, but they are explicitly narrowed:

1. `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
2. `frontend/features/ai-studio/logic/referenceDownload.ts`
3. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`

### 3. Diagnostic compatibility

These paths are primarily for operator/admin usefulness and mixed-schema diagnosis:

1. `frontend/pages/api/admin/generation-trace.ts`
2. `frontend/pages/api/admin/user-health.ts`

## Initial Observations

1. The remaining compatibility paths are concentrated and no longer spread across many uncontrolled mutation surfaces.
2. Most surviving compatibility logic is read-only or view-only, not lifecycle-authority logic.
3. The strongest remaining runtime compatibility path is the recovery lookup fallback from attempt identity to `ai_generations.request_id`.
4. The strongest remaining user-facing compatibility paths are intentionally narrow:
   - preview-only rendering
   - download fallback
   - internal-source bounded compatibility hints
5. Admin compatibility paths should likely be judged separately from runtime retirement because operator usefulness is still valuable even after the rebuild is “done.”

## Implication For Closeout

This inventory suggests the rebuild is closer to done than to another major authority refactor.

The next closeout question is no longer:

1. “what compatibility paths remain?”

It is:

1. which of these paths are acceptable bounded carry-forward
2. which must be retired before the roadmap can be called done
3. which belong to a later cleanup lane rather than rebuild completion itself
