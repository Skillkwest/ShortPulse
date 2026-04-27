# Lane B Evidence Packet: B2-02 Inpaint Overlay Split

date_utc: 2026-03-17  
slice_id: B2-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract contour derivation, marching-ants cadence, lasso preview mapping, mask analysis, and overlay rendering from `useInpaintMaskController.ts` into `inpaintMaskOverlay.ts`.
2. Keep the hook API and runtime behavior unchanged while reducing hook bulk and clarifying the rendering/math ownership boundary.
3. Correct the stale `B2-02` evidence pointer in the Lane B execution plan so the plan artifact resolves to the active evidence index.

## Files Updated
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskOverlay.ts`
3. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
4. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
5. `docs/records/evidence/lane-b/README.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
7. `docs/records/evidence/lane-b/2026-03-17-b2-02-inpaint-overlay-split.md`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `test -- useInpaintMaskController.test.ts` | 0 | pass (`1` file, `24` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, no new errors) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass (`useInpaintMaskController.ts` improved from `1564` to `1065` lines and is now below the `1400`-line warn budget) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `useInpaintMaskController.ts`: `1564` -> `1065` (`-499` lines, `wc -l`).
2. `inpaintMaskOverlay.ts`: new file at `494` lines.
3. Coupling reduction:
   - contour derivation, marching-ants timing, lasso preview projection, and overlay canvas rendering now live behind one render-oriented module boundary.
   - the test suite now imports overlay helpers directly from `inpaintMaskOverlay.ts` instead of reaching through the hook module.
   - the execution plan now points `B2-02` evidence consumers at the active evidence index instead of a nonexistent placeholder file.

## Net Complexity Note
1. Net complexity improved because the new module owns a coherent overlay/rendering domain rather than creating generic canvas helpers.
2. The hook lost nearly five hundred lines while staying focused on hook lifecycle, pointer session state, and export/snapshot flows.
3. This also changes the economics of `B2-02`: the hook is now below warn budget, so the next move should be a checkpoint review or a clearly justified orchestration extraction, not more helper shaving by momentum.

## Seam Selection Rationale
1. This slice cleared the Lane B rubric as a `shared_extraction` because it established a durable contour/overlay rendering boundary already identified in the `B2-02` hotspot map.
2. It followed the prescribed sequence exactly: characterization first, geometry split second, overlay/render split third.
3. It materially reduced hotspot size and lowered follow-up risk by isolating pure rendering/math concerns before any controller extraction.

## Parity Assertions
1. `useInpaintMaskController` API remained unchanged.
2. No API/server/schema changes.
3. Helper behavior remained covered by the existing characterization suite, which stayed green after imports were repointed to the new boundary.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real overlay/render boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-005`: `B2-02` still needs a checkpoint review to decide between stopping after the pure-helper pair or opening a new slice for mask-analysis/animation orchestration.

## Rollback Note
1. Revert this slice commit to inline the overlay helpers back into `useInpaintMaskController.ts` and restore the previous helper import locations in the test file.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/records/evidence/lane-b/2026-03-17-b2-02-inpaint-controller-hotspot-map.md`
5. `docs/records/evidence/lane-b/2026-03-17-b2-02-inpaint-characterization-lock.md`
6. `docs/records/evidence/lane-b/2026-03-17-b2-02-inpaint-geometry-split.md`
