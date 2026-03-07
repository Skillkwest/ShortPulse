# ADR 0030: AI Studio Dual-Canvas Right Rail Shared-Scene Architecture

## Status
Accepted

## Date
2026-03-06

## Context
AI Studio required a second Canvas surface in the right reference rail above Quick Slot Inventory while preserving a single creative workspace model.

Key constraints:
- both Canvas instances must provide identical UX capabilities,
- edits in either Canvas must stay synchronized,
- viewport interactions (pan/zoom) should remain independent per surface,
- right-column drag/drop routing must not regress existing file/media ingestion into Reference Grid.

## Decision
Adopt a shared-scene + separate-camera architecture for dual Canvas instances:
- shared scene state:
  - items, pending items, selection/editing sessions, and scene mutations are centralized,
  - either Canvas instance can mutate shared scene content,
- per-instance viewport state:
  - camera, pointer interaction session, viewport ref, and drop-active visuals are isolated by instance (`main`, `rail`),
- page-level wiring exposes two explicit panel contracts:
  - `mainCanvasProps` for the left Canvas properties panel,
  - `railCanvasProps` for the right-rail Canvas section,
- reference rail layout is split into three stacked zones:
  - `Canvas` (top), `Quick Slot Inventory` (middle), `Reference Grid` (bottom),
- the new top divider is independent from the existing quick-slot/all-refs divider and has distinct ARIA semantics,
- shell DnD capture defers text/internal drops to the rail-canvas viewport when the drop target is inside the rail Canvas surface.

## Consequences
### Positive
- Delivers dual-canvas UX without duplicating or desynchronizing scene content.
- Prevents ref/geometry conflicts that occur with a single shared viewport ref across two mounted panels.
- Keeps split responsibilities modular: scene logic, viewport logic, and rail layout are decoupled.

### Tradeoffs
- Increased composition complexity across page-content/shell/reference-rail contracts.
- Additional split coordination in the reference rail (two independent horizontal split controls).

## Alternatives Considered
- Mounting the same single-instance canvas contract twice.
  - Rejected due shared `viewportRef` and interaction-state collision risk.
- Independent canvas scenes per surface.
  - Rejected because it breaks user expectation of one shared creative workspace.

## Related
- `docs/adr/0014-ai-studio-shell-decoupling-and-event-backpressure.md`
- `docs/adr/0017-ai-studio-curated-reference-split-grid.md`
- `docs/sops/sop_media_performance_operations.md`
