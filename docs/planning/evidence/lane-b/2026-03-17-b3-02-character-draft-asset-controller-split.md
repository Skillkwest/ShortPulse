# Lane B Evidence Packet: B3-02 Character Draft Asset Controller Split

date_utc: 2026-03-17  
slice_id: B3-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract profile image, preset image, slot persistence, and assignment save flows out of `useCharacterManagerDraft.ts`.
2. Preserve the `useCharacterManagerDraft` caller contract while moving:
   - profile image upload / clear / transform save,
   - character sheet assignment persistence,
   - preset image upload,
   - slot validation, save, and clear flows.
3. Extend the direct hook characterization floor to cover profile and slot persistence before extraction.

## Files Updated

1. `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
2. `frontend/features/character-manager/hooks/useCharacterManagerAssetController.ts`
3. `frontend/features/character-manager/hooks/__tests__/useCharacterManagerDraft.test.ts`
4. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-asset-controller-split.md`
5. `docs/planning/evidence/lane-b/README.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
7. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`

## Commands Run

1. `npm -C frontend run test -- features/character-manager/hooks/__tests__/useCharacterManagerDraft.test.ts`
2. `npm -C frontend run test -- features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx`
3. `npm -C frontend run type-check`
4. `npm -C frontend run lint`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`

## Results

| command | exit_code | result |
| --- | --- | --- |
| `test -- useCharacterManagerDraft.test.ts` | 0 | pass (`5` tests) |
| `test -- CharacterManagerShell.*.test.tsx` | 0 | pass (`3` files, `42` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, baseline only) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `useCharacterManagerDraft.ts`: `861` -> `613` (`-248` lines, `wc -l`).
2. `useCharacterManagerAssetController.ts`: new file at `451` lines.
3. Coupling reduction:
   - profile image persistence,
   - sheet assignment save/rollback,
   - preset image upload,
   - slot validation/save/clear
   no longer live inline beside bootstrap, preset orchestration, and character lifecycle transitions.

## Net Complexity Note

1. Net complexity improved because the extracted code is one coherent asset-persistence controller, not a generic helper bucket.
2. `useCharacterManagerDraft.ts` now reads as a coordinator over three clear controller domains:
   - bootstrap,
   - preset orchestration,
   - asset persistence.
3. The remaining inline surface is now mostly debounced field persistence plus character lifecycle transitions, which makes the stop-review decision much clearer.

## Seam Selection Rationale

1. This slice follows the post-bootstrap `B3-02` decision to take the stronger remaining non-lifecycle boundary first.
2. It clears the Lane B rubric by creating a durable controller boundary with measurable hotspot reduction and no contract change.
3. The added hook characterization tests make the extraction defensible instead of relying only on shell-level coverage.

## Parity Assertions

1. `useCharacterManagerDraft` return shape remains unchanged.
2. Profile image uploads still refresh the character rail and keep the signed profile URL in state.
3. Slot saves still validate first, persist the slot, update local slot state, and clear busy flags after completion.
4. Existing bootstrap, preset preview, and preset fallback characterizations remain green.
5. No API/server/schema changes.

## Task Contract Checklist

1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real asset controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred

1. `LB-DEFER-016`: Run a `B3-02` stop review now that bootstrap, preset orchestration, and asset persistence are all isolated, then decide whether character lifecycle deserves its own controller or the hotspot is ready to checkpoint.

## Rollback Note

1. Revert this slice commit to inline asset persistence back into `useCharacterManagerDraft.ts`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts

1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-hotspot-map.md`
5. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-characterization-lock.md`
6. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-preset-controller-split.md`
7. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-bootstrap-controller-split.md`
