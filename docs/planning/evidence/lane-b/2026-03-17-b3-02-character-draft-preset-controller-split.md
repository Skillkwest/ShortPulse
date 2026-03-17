# Lane B Evidence Packet: B3-02 Character Draft Preset Controller Split

date_utc: 2026-03-17  
slice_id: B3-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract preset orchestration out of `useCharacterManagerDraft.ts` into a dedicated controller hook.
2. Preserve the `useCharacterManagerDraft` caller contract while moving:
   - preset switching,
   - preset assignment persistence,
   - add/rename/delete tab flows,
   - preset description sync and rollback.
3. Keep character lifecycle, bootstrap, and asset upload flows in the parent hook for later B3-02 slices.

## Files Updated

1. `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
2. `frontend/features/character-manager/hooks/useCharacterManagerPresetController.ts`
3. `frontend/features/character-manager/hooks/__tests__/useCharacterManagerDraft.test.ts`
4. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-preset-controller-split.md`
5. `docs/planning/evidence/lane-b/README.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
7. `docs/planning/lane-b-execution-plan-2026-03-16.md`

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
| `test -- useCharacterManagerDraft.test.ts` | 0 | pass (`2` tests) |
| `test -- CharacterManagerShell.*.test.tsx` | 0 | pass (`3` files, `42` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, baseline only) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `useCharacterManagerDraft.ts`: `1513` -> `1000` (`-513` lines, `wc -l`).
2. `useCharacterManagerPresetController.ts`: new file at `732` lines.
3. Coupling reduction:
   - preset switching, preset persistence, tab mutation flows, and description reconciliation no longer live inline in `useCharacterManagerDraft.ts`,
   - the draft hook now delegates preset orchestration to a named controller boundary,
   - asset upload still composes through the same `saveCharacterSheetPresetAssignments` contract without caller changes.

## Net Complexity Note

1. Net complexity improved because the extracted code is one cohesive preset-state controller domain rather than generic helper sprawl.
2. `useCharacterManagerDraft.ts` now reads more clearly as a coordinator for bootstrap, profile/slot persistence, lifecycle actions, and the preset controller.
3. The new boundary matches the B3-02 hotspot map and keeps the next likely boundaries visible instead of mixing them into the same extraction.

## Seam Selection Rationale

1. This slice directly follows the B3-02 characterization lock and uses the first-ranked hotspot domain: preset tab orchestration.
2. It clears the Lane B rubric by creating a durable controller boundary, materially reducing the hotspot, and preserving the next likely follow-up seams.
3. It avoids helper churn by leaving bootstrap, asset persistence, and lifecycle flows for later slices instead of overreaching in one PR.

## Parity Assertions

1. `useCharacterManagerDraft` return shape remains unchanged.
2. Character Manager shell behavior/layout/copy tests stay green.
3. Hook characterization tests for preview preservation and nearest-left fallback stay green.
4. No API/server/schema changes.

## Task Contract Checklist

1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real preset controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred

1. `LB-DEFER-014`: Reassess `B3-02` now that preset orchestration is extracted, then decide whether the next boundary is bootstrap/snapshot application or slot/profile asset persistence.

## Rollback Note

1. Revert this slice commit to inline preset orchestration back into `useCharacterManagerDraft.ts`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts

1. `docs/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-hotspot-map.md`
5. `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-characterization-lock.md`
