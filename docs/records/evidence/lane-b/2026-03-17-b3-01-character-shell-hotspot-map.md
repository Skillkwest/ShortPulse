# Lane B Hotspot Map: B3-01 CharacterManagerShell

date_utc: 2026-03-17  
slice_id: B3-01  
track: B-Core  
owner: Engineering  
linked_pr: n/a (planning/control artifact)

## Purpose
1. Record the decomposition surface inside `CharacterManagerShell.tsx` before opening the next Lane B extraction slice.
2. Use the `B2-03` checkpoint handoff to move Lane B onto the next oversized hotspot.
3. Identify the strongest first boundary for `CharacterManagerShell.tsx` based on size pressure and existing repo tests.

## Current State
1. `CharacterManagerShell.tsx` is `2749` lines and remains above the Lane B warn-mode budget (`2200`).
2. Existing repo coverage is strong:
   - `CharacterManagerShell.behavior.test.tsx`
   - `CharacterManagerShell.layout.test.tsx`
   - `CharacterManagerShell.copy.test.tsx`
   - related quick-swap and preset logic tests
3. The shell already delegates some core domains into hooks (`useCharacterManagerDraft`, `useCharacterQuickSwapDeck`, `useCharacterQuickSwapTipPreference`), but it still mixes multiple ownership layers:
   - shell/page UI state and responsive layout control,
   - account/bootstrap and plan resolution,
   - dropped-reference resolution and ingestion,
   - quick-swap/character-sheet orchestration,
   - modal/preview/delete flows,
   - large render composition.

## Remaining Domain Clusters
### 1. Shell UI state and responsive layout control
Includes:
1. active tab, quick-swap collapse, preview state, delete-target state
2. column-count listeners and library visible-count smoothing
3. panel/page shell toggles and local-storage persistence

Why it matters:
1. This is a coherent shell-state boundary with minimal external side effects.
2. It is likely the safest first move because it is mostly local state ownership.
3. It can reduce shell bulk without immediately touching drag/drop or persistence flows.

### 2. Dropped-reference resolution and ingestion
Includes:
1. dropped URL/storage parsing helpers
2. internal reference resolution and media-reference cache
3. dropped-image ingestion into quick-swap or character-sheet slots

Why it matters:
1. This is a large, distinct behavior domain and one of the biggest remaining complexity sources.
2. It is high value, but riskier than shell-state extraction because it spans async resolution, storage access, and drag/drop behavior.
3. It is a strong second move after local shell state is cleaner.

### 3. Quick-swap and character-sheet orchestration
Includes:
1. assignment persistence
2. drag-start/drag-end behavior
3. sheet slot selection, upload routing, clear/remove flows
4. quick-swap add/remove/restore/load-more glue

Why it matters:
1. This is central product behavior with broad test coverage.
2. It is likely too coupled for the first move, but it becomes more tractable after shell-state and drop-resolution seams land.

### 4. Account/bootstrap and plan resolution
Includes:
1. auth bootstrap
2. plan lookup and resolved-plan state
3. account display and plan badge helpers

Why it matters:
1. This is bounded and likely lower risk.
2. It is not the biggest complexity driver, so it should not be the first move unless it unlocks a stronger follow-up seam.

### 5. Render composition and presenter surfaces
Includes:
1. page/panel render branching
2. create/manage surface composition
3. modal rendering and large JSX sections

Why it matters:
1. Presenter extraction too early risks relocating state complexity instead of reducing it.
2. Lane B should keep preferring controller/state boundaries before presenter-only slicing.

## Extraction Readiness Ranking
1. `Shell UI state and responsive layout control`
   - Best first move.
   - Stable local state, good size payoff, lower risk than async drop flows.
2. `Dropped-reference resolution and ingestion`
   - Strong second move.
   - High value once shell state is cleaner.
3. `Quick-swap and character-sheet orchestration`
   - Important, but better after the first two boundaries reduce coupling.
4. `Account/bootstrap and plan resolution`
   - Useful but lower leverage than the top two.
5. `Render composition and presenter surfaces`
   - Defer until controller/state seams make presenter boundaries real.

## Recommended Next Sequence
1. Open `B3-01` with a shell-state/responsive-layout boundary slice:
   - extract local shell UI state, responsive column counts, library visible-count smoothing, and modal/delete target state into a dedicated controller hook.
2. Keep the existing `CharacterManagerShell` component tests as the regression floor.
3. Reassess whether the next best follow-up is dropped-reference resolution or quick-swap/character-sheet orchestration.
4. Defer presenter-only splits until the controller/state boundary is meaningfully smaller.

## Explicit Do-Not-Do List
1. Do not start `B3-01` with a broad JSX/presenter split that leaves all state in the shell.
2. Do not start with the async drop-resolution path unless the shell-state boundary is first simplified.
3. Do not duplicate existing draft/quickswap hook responsibilities under new shell-specific names.
4. Do not mix page/panel visual cleanup into the first modularization seam.

## Immediate Next Slice Criteria
The next accepted `B3-01` slice should satisfy all of:
1. It targets shell UI state and responsive layout ownership first.
2. It uses the existing `CharacterManagerShell` component test suites as the contract, adding tests only if a real gap appears.
3. It reduces `CharacterManagerShell.tsx` materially while keeping ownership clearer than before.
4. It avoids presenter-only decomposition until state/controller seams are cleaner.
