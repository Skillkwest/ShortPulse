# ADR 0032: AI Studio Media Library Target UX And Folder-Canvas Domains

## Status
Accepted

## Date
2026-03-11

## Context
The AI Studio Media Library panel required a single durable UX contract spanning:
- root-folder behavior (`all_items` / `All Media`) as the user’s master media set,
- folder membership semantics without duplicate underlying rows,
- consistent visual behavior for prompts/images/videos in `All Media`,
- direct ingestion actions from Media Library to Reference Grid,
- future folder-scoped canvas spaces with independent state boundaries.

Previous docs described current runtime behavior but did not fully codify this target interaction model or its persistence boundaries.

## Decision
Adopt the following Media Library target architecture contract:
1. `All Media` is immutable root and master set.
2. Folder operations are membership-based:
   - root -> custom: assign membership,
   - custom -> custom: move membership,
   - custom -> root: unassign membership.
3. `All Media` visual contract is sectioned:
   - prompts as text reference cards,
   - images in masonry preserving true aspect ratio,
   - videos in masonry preserving true aspect ratio.
4. Right-click media in `All Media` dispatches that media to Reference Grid.
5. Media Library folder canvases are independent domains per `user + folder` with:
   - independent scene/camera state,
   - durable persistence across sessions,
   - `Shift`-modified drag export to resolve pan-vs-drag gesture conflicts,
   - right-click copy-to-Reference-Grid behavior.
6. Documentation governance for this surface uses `Target Contract + Current Runtime Delta` until all implementation gaps close.

## Consequences
### Positive
- One canonical UX contract across SOPs, route docs, API inventory, and ADRs.
- Clear separation between master media data and folder organization semantics.
- Reduced ambiguity for implementation and QA around root-folder behavior and drag/right-click interactions.
- Explicit persistence boundary for future folder-canvas rollout.

### Tradeoffs
- Docs may intentionally describe target behavior ahead of implementation; deltas must be maintained actively.
- Additional QA matrix size for gesture combinations (pan/zoom/shift-drag/right-click) across multiple canvas domains.

## Related
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `docs/sops/sop_media_library_ui.md`
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
- `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
- `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`
