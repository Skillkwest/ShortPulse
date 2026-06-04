# SOP: AI Studio Session Persistence (Retired Legacy Lane)

## Scope

Historical runbook for the retired AI Studio legacy session persistence system with former durability across:

1. workspace settings,
   including Create Pulse mode plus active pinned Pulse preset id,
2. outputs/reference projections,
3. agent transcript/input state,
   including derived Pulse workflow session state for active built-in `workflow_gpt` guided workflows (`status`, current step label/prompt, collected user inputs, last artifact when present),
4. canvas scene + main/rail viewport cameras + transient text edit state.

This SOP governs the retired legacy AI Studio session persistence system. That system is no longer available in the shipped product. `sid` remains runtime identity only and no longer restores or saves durable session snapshots.

## Prerequisites

1. Session SQL migration `044_add_ai_studio_sessions_persistence.sql` may still exist in older environments.
2. Hotfix migration `053_fix_ai_studio_session_upsert_ambiguity.sql` may still exist in older environments.
3. The legacy `/api/ai/sessions/*` routes were retired and then removed from the shipped runtime; do not use them for product behavior.

## Runtime Flags

Legacy flags:

1. Historical AI Studio session-persistence env flags are ignored by current runtime policy.
2. The legacy `/api/ai/sessions/*` routes are removed from the shipped runtime and do not persist or restore session data.

## Persistence Contract

1. Snapshot schema version is `2` (V2 write path).
2. V1 snapshots remain readable for backward compatibility.
3. Canvas payload includes:
   - scene items (`image`/`text`),
   - main + right-rail viewport cameras,
   - transient draft/edit sessions and ownership.
4. Current shipped AI Studio persistence has no separate Media Library folder-canvas domain; only the shared main/right-rail canvas scene remains part of the historical session snapshot contract.
5. Hard limits:
   - max canvas items: `300`,
   - max serialized snapshot size: `~900KB`.
6. Non-durable canvas image sources (`blob:`/`data:`) are excluded from durable snapshot writes.

## Runtime Status

1. The shipped product no longer performs durable `sid` session autosave or restore.
2. `/api/ai/sessions/save`, `/api/ai/sessions/:sid`, and `/api/ai/sessions` are removed legacy endpoints.
3. Non-project `sid` values remain runtime identity only.
4. Durable AI Studio persistence now lives on project routes through `/api/projects/:projectId/workspace`.

## Validation Matrix

1. Targeted tests:
   - `sessionSnapshot*.test.ts`
   - `sessionSnapshot*.test.ts`
   - `useAiStudioSessionAutosave.test.ts`
   - `useAiStudioProjectWorkspaceRestoreCandidate.test.ts`
   - canvas interaction/drop tests including hard-cap coverage.
2. `npm -C frontend run build`
3. Manual smoke:
   - create/edit/move canvas items in both main and right-rail canvas,
   - refresh and confirm full restoration,
   - validate cap messaging at 300 items,
   - verify oversize snapshot warning behavior.

## Operator Guidance

1. Do not use this SOP as runtime product guidance for current AI Studio persistence behavior.
2. For live project-owned persistence, use the project workspace docs and routes:
   - `docs/adr/0063-project-workspace-authority.md`
   - `docs/sops/sop_ai_studio_projects_foundation.md`
   - `docs/routes.md`

## Rollback

This retired lane has no supported runtime rollback path. If historical investigation needs to inspect the old implementation, use source history rather than re-enabling retired session endpoints.

## Maintenance

1. Keep this SOP clearly marked as retired historical reference only.
2. Keep `docs/api/api-internal-routes.md` aligned with the retired endpoint status.
