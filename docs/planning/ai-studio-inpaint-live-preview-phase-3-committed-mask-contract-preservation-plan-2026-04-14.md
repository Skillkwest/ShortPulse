# AI Studio Inpaint Live Preview Phase 3: Committed Mask Contract Preservation Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Preserve the existing committed-mask, export, history, and submission contracts while the transient preview layer is introduced.

## Why This Phase Exists
The biggest implementation risk in this program is accidental drift between transient preview state and the authoritative committed-mask path. This phase exists to keep preview ownership additive rather than invasive.

## Scope
1. keep the committed-mask overlay responsible for tint and marching ants,
2. keep mask snapshot, restore, clear, invert, and export behavior unchanged,
3. keep inpaint history behavior unchanged.

## Primary Files
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskOverlay.ts`
3. `frontend/features/ai-studio/components/edit/useExpertEditStageHistory.ts`
4. `frontend/features/ai-studio/components/edit/expertEditStageExport.ts`

## Entry Criteria
1. Immediate preview path exists.
2. The transient preview layer is visually separate from committed-mask rendering.

## Exit Criteria
1. Committed tint and marching ants still render from the authoritative mask path.
2. Exported masks remain unchanged.
3. Undo/redo and selection actions remain unchanged.
4. No preview-only state leaks into committed snapshot state.

## Work Items
1. Keep transient preview state separate from authoritative mask-canvas state.
2. Confirm commit-time transitions still analyze and render the committed mask path.
3. Confirm history baselines and finalize paths still snapshot the authoritative mask.
4. Avoid widening scope into submission/provider behavior.

## Risks
1. Preview-only geometry could accidentally pollute snapshot/export state.
2. Commit-time render sequencing could break if preview teardown and analysis sequencing are reordered incorrectly.
3. History baselines could capture stale or partially applied preview state if boundaries are not explicit.

## Non-Goals
1. No provider lane changes.
2. No export camera redesign.
3. No history model redesign.

## Validation
1. Run snapshot/export/history tests for touched seams.
2. Verify clear/invert/undo/redo behaviors still operate on committed mask state only.

## Rollback Note
If this phase reveals committed-mask drift, roll back the preview-state separation changes and restore the previous authoritative-mask-only control flow before continuing.

## Stop Rule
Stop this phase once transient preview and committed mask paths have cleanly separated ownership.
