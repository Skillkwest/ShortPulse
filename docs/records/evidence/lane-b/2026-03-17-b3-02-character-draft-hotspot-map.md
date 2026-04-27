# Lane B Hotspot Map: B3-02 useCharacterManagerDraft

date_utc: 2026-03-17  
slice_id: B3-02  
track: B-Core  
owner: Engineering  
linked_pr: n/a (planning/control artifact)

## Purpose
1. Record the decomposition surface inside `useCharacterManagerDraft.ts` before opening the next Character Manager extraction slice.
2. Identify the highest-value first boundary after the `B3-01` checkpoint.
3. Define the characterization-first sequence so `B3-02` does not repeat the earlier low-yield seam pattern.

## Current State
1. `useCharacterManagerDraft.ts` is `1513` lines.
2. There is strong surrounding Character Manager coverage, but no direct hook-level regression floor yet for this hotspot.
3. Existing persistence logic already has good targeted tests under `frontend/features/character-manager/logic/__tests__/characterManagerPersistence.presets.test.ts`.
4. The hook still mixes several ownership layers:
   - bootstrap/session snapshot application,
   - debounced field persistence,
   - preset tab orchestration and rollback,
   - slot/profile asset persistence,
   - character lifecycle create/select/delete flows.

## Remaining Domain Clusters
### 1. Preset tab orchestration
Includes:
1. active preset switching
2. preset assignment persistence
3. add/rename/delete preset tab flows
4. description synchronization and rollback across persistence responses

Why it matters:
1. This is the densest state machine in the hook.
2. It mixes optimistic UI, persistence responses, and active-description synchronization.
3. It is the best first extraction target once behavior is directly characterized.

### 2. Bootstrap and snapshot application
Includes:
1. auth/session bootstrap
2. persisted selected-character lookup
3. snapshot application into local hook state
4. character-list refresh handoff

Why it matters:
1. This is a coherent boundary with limited UI knowledge.
2. It is important, but it is safer to take after preset orchestration is characterized and reduced.

### 3. Slot and profile asset persistence
Includes:
1. profile image upload / clear / transform save
2. quick shot upload / clear
3. busy-state tracking and validation gating

Why it matters:
1. This is a real boundary, but it spans file validation, storage persistence, and list refresh side effects.
2. It is a good second or third extraction after preset orchestration is cleaner.

### 4. Character lifecycle transitions
Includes:
1. create character
2. select character
3. delete character with fallback snapshot creation/loading

Why it matters:
1. This is bounded and important, but it is less tangled than preset orchestration.
2. It becomes more tractable after snapshot application is separated.

### 5. Debounced field persistence
Includes:
1. name persistence timer
2. preset description persistence timers
3. pending-request reconciliation and rollback

Why it matters:
1. This is cross-cutting and timing-sensitive.
2. It should not be the first extraction because it depends on the surrounding preset/bootstrap state model.

## Extraction Readiness Ranking
1. `Preset tab orchestration`
   - Best first move after characterization.
   - Highest complexity and best leverage.
2. `Bootstrap and snapshot application`
   - Strong follow-up once preset flows are clearer.
3. `Slot and profile asset persistence`
   - Valuable, but not the first controller boundary.
4. `Character lifecycle transitions`
   - Bounded, useful after snapshot/application cleanup.
5. `Debounced field persistence`
   - Defer until surrounding state ownership is cleaner.

## Recommended Next Sequence
1. Add direct hook characterization tests for preset orchestration.
2. Open the first `B3-02` production slice only after those tests are green.
3. Extract a preset-state controller boundary that owns:
   - active preset switching,
   - preset assignments,
   - add/rename/delete tab flows,
   - description synchronization around persisted responses.
4. Reassess whether bootstrap/snapshot application should be the next boundary after the preset controller lands.

## Explicit Do-Not-Do List
1. Do not start `B3-02` with generic helper extraction.
2. Do not begin with debounced timer helpers in isolation.
3. Do not extract presenter-level code; this hotspot is purely state/persistence orchestration.
4. Do not mix slot/profile asset persistence into the first preset-state slice.

## Immediate Next Slice Criteria
The next accepted `B3-02` slice should satisfy all of:
1. It begins with characterization for preset orchestration behavior.
2. It keeps `useCharacterManagerDraft` caller contract unchanged.
3. It reduces net complexity instead of only moving helpers.
4. It makes bootstrap or asset-persistence follow-up seams easier.
