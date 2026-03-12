# ADR 0033: AI Studio Media Library Folder-Canvas Persistence and Gesture V2

- Status: Accepted
- Date: 2026-03-12
- Owners: AI Studio / Media Library

## Context
`ADR 0032` established the target UX contract for Media Library (`All Media` master semantics, drag/drop behavior, right-click ingest, and folder-canvas domains). Runtime still needed implementation boundaries that prevent regressions in existing AI Studio dual-canvas/session behavior.

Key constraints:
1. No coupling between Media Library folder canvases and `sid`-scoped AI Studio session snapshots.
2. Rollout must be reversible and staged.
3. Panel gestures (drag ghost, right-click ingest, root delete) must be independently gated from folder-canvas persistence.

## Decision
1. Implement two independent client flags:
   - `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED`
   - `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_FOLDER_CANVAS_ENABLED` (initial rollout gate; later removed after stabilization)
2. Add dedicated folder-canvas persistence boundary:
   - Table: `public.media_folder_canvas_states` (keyed by `user_id + folder_id`, on-delete cascade from folder ownership).
   - APIs:
     - `GET /api/ai/media-folder-canvas/:folderId`
     - `POST /api/ai/media-folder-canvas/save`
3. Keep AI Studio session persistence unchanged:
   - No `ai_studio_sessions` schema changes for folder-canvas state.
   - Folder-canvas durability is isolated to `user + folder` scope.
4. Ship panel interaction hardening under Gesture V2:
   - custom drag ghost for media/prompt drags,
   - right-click media ingest from `All Media` to Reference Grid,
   - root permanent delete actions for media/prompt rows.
5. Implement custom-folder canvas surfaces:
   - independent camera/scene,
   - right-click copy-to-Reference-Grid,
   - Shift-drag external export via media-library drag payload contract.

## Consequences
Positive:
1. Main/rail canvas/session contracts remain stable and low-risk.
2. Folder-canvas durability can evolve independently (schema/API/versioning).
3. Gesture rollout can be canaryed separately from folder-canvas rollout.

Tradeoffs:
1. Additional API/table lifecycle for folder-canvas persistence.
2. Larger QA matrix for canvas gestures and membership reconciliation.
3. Temporary dual-path UX while flags are staged.

## Links
- `docs/adr/0032-ai-studio-media-library-target-ux-and-folder-canvas-domains.md`
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
- `sql/migrations/063_add_media_folder_canvas_states.sql`
