# Lane B Evidence Packet: B3-02 Character Draft Bootstrap Controller Split

date_utc: 2026-03-17  
slice_id: B3-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract bootstrap and snapshot application out of `useCharacterManagerDraft.ts` into a dedicated controller hook.
2. Preserve the `useCharacterManagerDraft` caller contract while moving:
   - auth/session bootstrap,
   - user-scoped selected-character restore,
   - snapshot application into local draft state,
   - best-effort character-list refresh after bootstrap.
3. Keep asset persistence and character lifecycle transitions in the parent hook for later `B3-02` slices.

## Files Updated

1. `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
2. `frontend/features/character-manager/hooks/useCharacterManagerBootstrapController.ts`
3. `frontend/features/character-manager/hooks/__tests__/useCharacterManagerDraft.test.ts`
4. `docs/records/evidence/lane-b/2026-03-17-b3-02-character-draft-bootstrap-controller-split.md`
5. `docs/records/evidence/lane-b/README.md`
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
| `test -- useCharacterManagerDraft.test.ts` | 0 | pass (`3` tests) |
| `test -- CharacterManagerShell.*.test.tsx` | 0 | pass (`3` files, `42` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, baseline only) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `useCharacterManagerDraft.ts`: `1000` -> `861` (`-139` lines, `wc -l`).
2. `useCharacterManagerBootstrapController.ts`: new file at `345` lines.
3. Coupling reduction:
   - auth/session loading,
   - selected-character restore,
   - snapshot application,
   - character-list refresh handoff
   no longer live inline beside preset orchestration, asset persistence, and lifecycle transitions.

## Net Complexity Note

1. Net complexity improved because the extracted code is one coherent bootstrap controller boundary rather than helper churn.
2. `useCharacterManagerDraft.ts` now reads more clearly as a coordinator for:
   - preset controller composition,
   - asset persistence,
   - debounced field persistence,
   - lifecycle transitions.
3. The new boundary also removes direct bootstrap persistence imports from the parent hook, which lowers its ownership surface.

## Seam Selection Rationale

1. This slice follows the hotspot-map sequencing after the preset controller seam.
2. It clears the Lane B rubric by extracting a durable controller boundary with measurable hotspot reduction and no caller-contract change.
3. It makes the next `B3-02` decision cleaner by isolating the remaining two real domains: asset persistence and character lifecycle.

## Parity Assertions

1. `useCharacterManagerDraft` return shape remains unchanged.
2. Bootstrap still restores the user-scoped selected character before loading the draft snapshot.
3. Character Manager shell behavior/layout/copy tests stay green.
4. Hook characterization tests for scoped bootstrap restore, preview preservation, and nearest-left fallback stay green.
5. No API/server/schema changes.

## Task Contract Checklist

1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real bootstrap controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred

1. `LB-DEFER-015`: Reassess `B3-02` now that preset orchestration and bootstrap are extracted, then choose the next boundary (`asset persistence` vs `character lifecycle`) instead of opening another blind seam.

## Rollback Note

1. Revert this slice commit to inline bootstrap/snapshot application back into `useCharacterManagerDraft.ts`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts

1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/records/evidence/lane-b/2026-03-17-b3-02-character-draft-hotspot-map.md`
5. `docs/records/evidence/lane-b/2026-03-17-b3-02-character-draft-characterization-lock.md`
6. `docs/records/evidence/lane-b/2026-03-17-b3-02-character-draft-preset-controller-split.md`
