# Lane B Evidence Packet: B3-01 Character Shell View-State Split

date_utc: 2026-03-17  
slice_id: B3-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract local shell view state and responsive layout control from `CharacterManagerShell.tsx` into `useCharacterManagerShellViewState.ts`.
2. Keep `CharacterManagerShell` behavior unchanged while isolating the first `B3-01` boundary identified in the hotspot map.
3. Preserve the existing `CharacterManagerShell` component test suite as the regression floor for the extraction.

## Files Updated
1. `frontend/features/character-manager/components/CharacterManagerShell.tsx`
2. `frontend/features/character-manager/hooks/useCharacterManagerShellViewState.ts`
3. `docs/records/evidence/lane-b/README.md`
4. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
5. `docs/records/evidence/lane-b/2026-03-17-b3-01-character-shell-view-state-split.md`

## Commands Run
1. `npm -C frontend run test -- features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `test -- CharacterManagerShell.*.test.tsx` | 0 | pass (`3` files, `42` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, no new errors) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass (`CharacterManagerShell.tsx` improved from `2749` to `2647` lines and remains above the `2200`-line warn budget) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `CharacterManagerShell.tsx`: `2749` -> `2647` (`-102` lines, `wc -l`).
2. `useCharacterManagerShellViewState.ts`: new file at `270` lines.
3. Coupling reduction:
   - shell-local view state no longer lives inline with the route shell,
   - responsive column-count control, beginner-mode persistence, quick-swap collapse policy, preview navigation state, and delete-target modal state now live behind one named hook,
   - the remaining shell hotspot is more concentrated around dropped-reference resolution and quick-swap/character-sheet orchestration.

## Net Complexity Note
1. Net complexity improved because the new hook groups one stable shell-state domain instead of scattering helper functions.
2. This extraction removes low-level local-state/effect ownership from the route shell without crossing into the higher-risk drop-resolution path yet.
3. The next justified `B3-01` seam should therefore target dropped-reference resolution or adjacent orchestration, not presenter-only JSX splitting.

## Seam Selection Rationale
1. This slice matched the `B3-01` hotspot map recommendation: start with shell UI state and responsive layout control.
2. It used the existing shell behavior/layout/copy tests as the contract rather than inventing a new test surface.
3. It materially reduced the hotspot and created a durable controller boundary without changing product behavior.

## Parity Assertions
1. `CharacterManagerShell` public props remained unchanged.
2. No API/server/schema changes.
3. Existing behaviors around beginner-mode toggle, quick-swap collapse, reference preview, delete modals, and shell layout remained covered by the shell test suite and stayed green.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real shell-state controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-011`: `B3-01` still needs a follow-up boundary around dropped-reference resolution and ingestion or another equally coherent controller seam before any presenter-only split.

## Rollback Note
1. Revert this slice commit to inline the shell-state controller back into `CharacterManagerShell.tsx`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/records/evidence/lane-b/2026-03-17-b3-01-character-shell-hotspot-map.md`
