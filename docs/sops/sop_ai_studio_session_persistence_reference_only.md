# SOP: AI Studio Session Persistence (Full Canvas Durability)

## Scope
Operational runbook for AI Studio session persistence with full durability across:
1. workspace settings,
2. outputs/reference projections,
3. agent transcript/input state,
4. canvas scene + main/rail viewport cameras + transient text edit state.

This SOP governs default-on operation, validation, and emergency rollback.

## Prerequisites
1. Session SQL migration `044_add_ai_studio_sessions_persistence.sql` is applied.
2. Hotfix migration `053_fix_ai_studio_session_upsert_ambiguity.sql` is applied.
3. Session APIs are reachable and authenticated in the active environment.

## Runtime Flags
Core flags:
1. `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` (default enabled)
2. `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED` (master client switch; default enabled)
3. `NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED` (default enabled)
4. `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED` (default enabled)
5. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED` (default enabled)
6. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED` (default enabled)
7. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` (default enabled)

Policy note:
1. When `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED=false`, client persistence is fully disabled regardless of scoped per-lane flags.
2. Remote restore/list reads require both restore shadow and remote shadow lanes to be enabled.

## Persistence Contract
1. Snapshot schema version is `2` (V2 write path).
2. V1 snapshots remain readable for backward compatibility.
3. Canvas payload includes:
   - scene items (`image`/`text`),
   - main + right-rail viewport cameras,
   - transient draft/edit sessions and ownership.
4. Media Library target UX extends this with folder-scoped canvas domains:
   - each user-created Media Library folder has an independent canvas scene/camera scope,
   - durability key is `user + folder`,
   - folder-canvas state is distinct from the main/rail shared-scene canvas contract,
   - storage/API boundary is `media_folder_canvas_states` + `/api/ai/media-folder-canvas/[folderId]` + `/api/ai/media-folder-canvas/save`.
5. Hard limits:
   - max canvas items: `300`,
   - max serialized snapshot size: `~900KB`.
6. Non-durable canvas image sources (`blob:`/`data:`) are excluded from durable snapshot writes.

## Workflow
### Write Path
1. Ensure `sid` is present (`/ai-studio?sid=<uuid>`).
2. Build V2 snapshot from workspace + outputs + agent + canvas state.
3. Persist local IndexedDB shadow immediately (debounced write controller).
4. Mirror to `/api/ai/sessions/save` for durable remote persistence.
5. On `visibilitychange/pagehide`, perform best-effort flush (keepalive is fallback, not primary path).

### Restore Path
1. Load local and optional remote candidate for current `sid`.
2. Select freshest candidate by `updatedAt` (remote wins ties).
3. Apply hydration once per `sid` lifecycle:
   - workspace/output state,
   - agent transcript/input (unless agent gate disabled),
   - canvas scene first, then viewport states, then transient draft/edit state.

## Validation Matrix
1. Targeted tests:
   - `sessionSnapshot*.test.ts`
   - `sessionRestoreCandidate.test.ts`
   - `useAiStudioSessionWriteShadow.test.ts`
   - `useAiStudioSessionRestoreHydration.test.ts`
   - canvas interaction/drop tests including hard-cap coverage.
2. `npm -C frontend run build`
3. Manual smoke:
   - create/edit/move canvas items in both main and right-rail canvas,
   - validate folder-canvas persistence isolation across at least two user-created Media Library folders,
   - validate folder-canvas ingest actions that intersect session state (`Shift` drag export, right-click copy-to-Reference Grid),
   - refresh and confirm full restoration,
   - validate cap messaging at 300 items,
   - verify oversize snapshot warning behavior.

## Error Handling
1. Remote save failures:
   - keep local shadow intact,
   - show non-blocking retry warning,
   - retry via write-shadow controller.
2. Oversize snapshot:
   - skip remote write,
   - show deterministic warning with current vs max size,
   - require state reduction before retry.
3. Partial/invalid canvas payload:
   - restore non-canvas state safely,
   - skip invalid canvas sub-sections without crash.

## Rollback
Emergency full rollback:
1. `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED=false`
2. `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED=false`
3. `NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED=false`
4. `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=false`
5. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED=false`
6. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED=false`
7. Restart frontend runtime and re-run smoke checks.

## Maintenance
1. Keep this SOP aligned with:
   - `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`
   - `docs/api/api-internal-routes.md`
2. Record production-impacting persistence incidents in `docs/change_log.md`.
