# AI Studio Master Stage Phase 2: Delete Duplicate Stage Surfaces Plan (2026-04-12)

Status: complete  
Owner: Engineering

## Goal
Reduce stage surface area before rebuilding so new work does not attach to dead or duplicate systems.

## Primary Delete Targets
1. legacy edit fallback routing
   - `frontend/features/ai-studio/components/EditPropertiesPanel.tsx`
   - `frontend/features/ai-studio/hooks/useAiStudioEditPanelProps.ts`
2. right-rail canvas duplication
   - `railCanvasProps` threading through page/shell/reference-grid
3. generic Canvas as a primary editor path
   - `frontend/features/ai-studio/components/canvas/*`
4. duplicate inline/modal interaction ownership
   - modal must not remain a separate interaction runtime

## Scope
This phase is allowed to:
1. delete dead entry points,
2. demote generic Canvas to non-canonical status,
3. remove right-rail canvas ownership from the shell,
4. simplify routing so the rebuild has one obvious target surface.

## Explicit Non-Goals
1. No new stage-core implementation yet.
2. No artboard or transform rebuild yet.
3. No export or persistence redesign yet.

## Entry Criteria
1. Phase 1 bakeoff decision is recorded.
2. The team knows which current stage surface is the rebuild foundation.

## Exit Criteria
1. users no longer enter a legacy or duplicate stage path when using the canonical editor flow,
2. `railCanvasProps` no longer acts as a second editor-stage contract in the shell,
3. generic Canvas is either removed from the editor flow or clearly isolated as a non-canonical surface,
4. future stage work only needs to target one path,
5. any surviving expanded modal is explicitly classified as presentation-shell-only.

## Progress Notes
Completed on 2026-04-12:
1. legacy Edit fallback routing was deleted from the canonical AI Studio flow,
2. `railCanvasProps` threading was removed from the live page/shell/reference-rail path,
3. header shortcut behavior and right-column drop routing were updated so the canonical shell no longer exposes or defers to a right-rail Canvas stage,
4. the generic Canvas top-level toolbar entry was removed and stale `selectedTool="canvas"` state now falls back to `create` in the canonical page flow,
5. the main `/ai-studio` page no longer initializes dual-canvas runtime or carries a canonical `propertiesCanvas` panel contract,
6. the temporary inactive page-canvas compatibility hook was deleted after the canonical page stopped depending on it,
7. canonical AI Studio session writes no longer require a canvas payload, and schema v2 writes can omit `canvas` while restore remains backward-compatible with older snapshots,
8. when the expanded Expert Edit markup modal opens, the inline stage now becomes inert so the canonical editor no longer mounts two simultaneously interactive stage surfaces,
9. canonical workflow identity no longer treats `canvas` as a first-class workflow; stale `canvas` tool selections now normalize through the `create` workflow contract while secondary folder-canvas surfaces remain direct-tool compatibility cases,
10. legacy session hydration now demotes persisted `selectedTool="canvas"` to `create`, so the canonical `/ai-studio` page no longer needs a dedicated page-level canvas coercion effect,
11. dead `ReferenceCanvas*`, `referenceCanvas*`, and `handleReferenceCanvasFiles` compatibility aliases were removed from active shared AI Studio/reference-grid code paths so the canonical runtime only exposes `ReferenceGrid` naming,
12. the shared `ReferenceGrid` runtime no longer renders or coordinates the dormant rail-canvas section; `railCanvasProps` is now a compatibility-only no-op field at the type boundary instead of a live secondary editor surface,
13. the remaining `railCanvasProps` compatibility field was deleted, shared panel visibility no longer carries a dead `canvas` slot, and obsolete rail-canvas-focused `ReferenceGrid` coverage was pruned,
14. active docs and focused tests were updated to match the slimmer shell contract,
15. validation exposed a real unrelated-but-adjacent runtime hole in the canonical `voices` workflow path, and a concrete `VoicesPropertiesPanel` surface plus focused tests were added so the properties router no longer points at a missing module,
16. the expanded Expert Edit modal was explicitly retained only as a temporary presentation shell for later Phase 3 cutover work; it is no longer a Phase 2 reason to keep deleting code.

Remaining:
1. none for Phase 2. Additional cleanup is out of scope unless it directly blocks Phase 3 extraction.

## Phase 2 Stop Rule
Phase 2 is complete. Do not continue deleting compatibility seams in this phase unless the next item directly blocks Phase 3 extraction.

## Migration Notes
1. If a legacy path must survive briefly, it must be wrapped as compatibility-only.
2. Compatibility code must have explicit delete ownership and must not accept new behavior work.

## Validation
1. Confirm page routing only mounts the canonical editor path.
2. Confirm right-rail interaction does not still own a duplicate creative workspace.
3. Confirm deleted or demoted paths are reflected in docs and tests.

## Rollback Note
If deletion exposes a missing dependency required for current users, restore only the minimum compatibility adapter needed and carry that adapter explicitly into Phase 3. Do not reopen duplicate-product ownership.
