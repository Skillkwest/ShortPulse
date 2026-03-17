# Lane B Evidence Packet: B2-02 Inpaint Geometry Split

date_utc: 2026-03-17  
slice_id: B2-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract pure geometry and mask-space math from `useInpaintMaskController.ts` into `inpaintMaskGeometry.ts`.
2. Keep production behavior unchanged while shrinking the orchestration hook and clarifying the ownership boundary for coordinate mapping, export window clipping, and brush-radius math.
3. Preserve the new `B2-02` characterization tests as the regression floor for the split.

## Files Updated
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`
3. `frontend/features/ai-studio/components/edit/expertEditCursorUtils.ts`
4. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
5. `docs/planning/evidence/lane-b/README.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
7. `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-geometry-split.md`

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
| `check:size-budget` | 0 | pass (`useInpaintMaskController.ts` improved from `1801` to `1564` lines but still warns as expected) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `useInpaintMaskController.ts`: `1801` -> `1564` (`-237` lines, `wc -l`).
2. `inpaintMaskGeometry.ts`: new file at `246` lines.
3. Coupling reduction:
   - scene-space point mapping, clamped pointer projection, mask export window clipping, image-rect containment, and brush-radius scaling now live behind one named geometry boundary.
   - `expertEditCursorUtils.ts` now consumes the geometry module directly instead of reaching through the hook module.
   - the hook is more clearly focused on inpaint state, rendering, effects, and pointer lifecycle.

## Net Complexity Note
1. Net complexity improved because the new module is a stable domain boundary rather than a generic helper dump.
2. The main hotspot shrank materially without adding warning drift or changing hook behavior.
3. This slice makes the next `B2-02` move clearer: contour/render helper extraction can now proceed without geometry noise mixed into the hook.

## Seam Selection Rationale
1. This slice cleared the Lane B rubric as a `shared_extraction` because it created a durable geometry boundary with clear ownership.
2. It directly matches the `B2-02` hotspot-map recommendation to start with pure helper extraction before attempting higher-risk controller work.
3. It materially reduced hotspot size and made follow-up extraction easier.

## Parity Assertions
1. `useInpaintMaskController` API remained unchanged.
2. No API/server/schema changes.
3. Snapshot/export/clear behavior remained unchanged; characterization tests stayed green through the extraction.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real geometry boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-004`: `B2-02` still needs the next helper boundary for contour/overlay rendering extraction.

## Rollback Note
1. Revert this slice commit to inline the geometry helpers back into `useInpaintMaskController.ts`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts
1. `docs/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-controller-hotspot-map.md`
5. `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-characterization-lock.md`
