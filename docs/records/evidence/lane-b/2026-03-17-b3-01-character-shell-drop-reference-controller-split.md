# Lane B Evidence Packet: B3-01 Character Shell Drop-Reference Controller Split

date_utc: 2026-03-17  
slice_id: B3-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract dropped-reference resolution and ingestion out of `CharacterManagerShell.tsx` into a dedicated controller hook.
2. Move the public `ResolveCharacterDropReference` type off the shell file so downstream AI Studio imports no longer depend on the hotspot module.
3. Preserve all existing Character Manager drag/drop behavior, including trusted external drops, internal reference-grid drops, and storage-download fallback when signed URL fetch fails.

## Files Updated

1. `frontend/features/character-manager/components/CharacterManagerShell.tsx`
2. `frontend/features/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`
3. `frontend/features/character-manager/logic/characterDropPayload.ts`
4. `frontend/features/ai-studio/components/CharacterPanel.tsx`
5. `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
6. `frontend/pages/ai-studio.tsx`
7. `docs/records/evidence/lane-b/README.md`
8. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
9. `docs/records/evidence/lane-b/2026-03-17-b3-01-character-shell-drop-reference-controller-split.md`

## Commands Run

1. `npm -C frontend run test -- features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run test -- features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx`
4. `npm -C frontend run lint`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`

## Results

| command                                           | exit_code | result                                                                      |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| `test -- CharacterManagerShell.behavior.test.tsx` | 0         | pass (`39` tests) after parser parity correction                            |
| `type-check`                                      | 0         | pass                                                                        |
| `test -- CharacterManagerShell.*.test.tsx`        | 0         | pass (`3` files, `42` tests)                                                |
| `lint`                                            | 0         | pass (`7` warnings, baseline only)                                          |
| `build`                                           | 0         | pass                                                                        |
| `check:architecture-boundary`                     | 0         | pass                                                                        |
| `check:size-budget`                               | 0         | pass (`CharacterManagerShell.tsx` is now below the `2200`-line warn budget) |
| `docs:check`                                      | 0         | pass                                                                        |

## LOC Or Coupling Delta

1. `CharacterManagerShell.tsx`: `2647` -> `2012` (`-635` lines, `wc -l`).
2. `useCharacterManagerDroppedReferenceController.ts`: new file at `636` lines.
3. `characterDropPayload.ts`: `87` -> `171` (`+84` lines) to hold the shared dropped-image payload parser used by the new controller and the shell drag-over checks.
4. Coupling reduction:
   - async dropped-reference resolution, trust-policy enforcement, storage fallback, and pending-drop state no longer live inline in the shell,
   - AI Studio consumers now import `ResolveCharacterDropReference` from the controller boundary instead of the shell component,
   - `CharacterManagerShell` now acts as the event router for drag/drop rather than owning the full resolution pipeline.

## Net Complexity Note

1. Net complexity improved despite the new hook because the extracted code is one coherent async controller domain, not generic helper sprawl.
2. `characterDropPayload.ts` grew only where the shell and controller share the same payload-trust parsing behavior.
3. The shell hotspot is now below budget and materially easier to reason about, which means the next move should be a stop-condition review before taking another `B3-01` slice.

## Seam Selection Rationale

1. This slice matched the `B3-01` hotspot map recommendation: dropped-reference resolution and ingestion was the strongest second controller boundary after shell view-state extraction.
2. It removed one of the largest remaining async behavior clusters from `CharacterManagerShell.tsx`.
3. It also cleaned an architectural dependency edge by moving the exported resolver type off the shell file.

## Parity Assertions

1. `CharacterManagerShell` public props remained unchanged.
2. External dragged reference-grid images still upload into Character Sheet and QuickSwap flows.
3. Internal reference-grid drops from unallowlisted hosts still resolve through the injected resolver path.
4. Signed-URL fetch failure still falls back to storage-path download using media lookup.
5. No API/server/schema changes.

## Task Contract Checklist

1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real drop-resolution controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred

1. `LB-DEFER-012`: Run a `B3-01` stop-condition review now that `CharacterManagerShell.tsx` is below budget, then decide whether to checkpoint or take one final orchestration seam.

## Rollback Note

1. Revert this slice commit to inline the drop-resolution controller back into `CharacterManagerShell.tsx` and restore the resolver type export path.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts

1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/records/evidence/lane-b/2026-03-17-b3-01-character-shell-hotspot-map.md`
5. `docs/records/evidence/lane-b/2026-03-17-b3-01-character-shell-view-state-split.md`
