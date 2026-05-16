# D-Bug Report - AI Studio Top Tab Panel Mismatch Closeout

- current status: `done`
- source handoff path:
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-top-tab-panel-mismatch.md`
- failing surface:
  - AI Studio top header shortcuts
  - right-rail panel visibility mapping for `Quick Slot Inventory` and `Reference Grid`

## Evidence gathered

- `frontend/features/ai-studio/components/AiStudioPageContent.tsx` owns separate `isCanvasVisible` state and a shared `panelVisibility` state for `quickSlot`, `referenceGrid`, and `styles`.
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts` derives the actual rail sections from those booleans:
  - `showQuickSlotSection`
  - `showReferenceGridSection`
  - `showStylesSection`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx` renders top-visible rail content by precedence:
  - canvas
  - quick slot
  - reference grid
  - styles
- `frontend/features/ai-studio/logic/panelVisibility.ts` previously treated header shortcuts as:
  - active when their boolean was merely visible
  - toggles that could turn the named surface off
- That old logic explains both observed production symptoms:
  - `Reference Grid` could toggle `referenceGrid` false and land on `Right-rail panels are hidden.`
  - `Quick Slot Inventory` could toggle `quickSlot` while leaving `referenceGrid` visible, so the result was not a quick-slot-specific state

## Reproduction status

- Root cause reproduced from repo code and fixed.
- The issue was not a renderer-only bug in `ReferenceGridSections`.
- It was a domain mismatch between:
  - shortcut semantics implied by the labels
  - raw boolean toggle behavior in `panelVisibility.ts`

## Root-cause analysis

- The top header controls are labeled like destination tabs, but the old implementation treated them like independent show/hide toggles.
- The right rail itself renders from composite visibility state with precedence, so multiple booleans being `true` does not mean multiple equally valid “active tabs.”
- The smallest safe fix was therefore:
  - make header active state reflect the top visible destination
  - make `Quick Slot Inventory` and `Reference Grid` select the named surface instead of toggling it off

## Changes made

- `frontend/features/ai-studio/logic/panelVisibility.ts`
  - changed `resolveHeaderShortcutStateMap(...)` to compute a single active shortcut from top-visible precedence:
    - quick slot
    - reference grid
    - styles
  - changed `togglePanelVisibilityByShortcut(...)` so:
    - `quick-slot-inventory` selects quick slot and turns off reference grid
    - `reference-grid` selects reference grid and turns off quick slot
    - `styles` still behaves as an availability-gated toggle
- `frontend/features/ai-studio/logic/__tests__/panelVisibility.test.ts`
  - added regressions proving:
    - only the top visible shortcut is marked pressed
    - quick slot selection becomes an exclusive named destination
    - reference grid selection becomes an exclusive named destination
- `frontend/features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx`
  - fixed stale mock drift by adding the now-required `prependNoneStyleTile` export to the local `expertEditStyles` mock so the targeted rail-layout test suite remains valid

## Validation run

- `cd frontend && npm run test -- features/ai-studio/logic/__tests__/panelVisibility.test.ts features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx`
- `cd frontend && npx eslint features/ai-studio/logic/panelVisibility.ts features/ai-studio/logic/__tests__/panelVisibility.test.ts features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx`

## Explicit stop condition

- Stop when the top header shortcuts map cleanly to a named visible rail destination, the hidden-rail fallback is no longer reachable from `Reference Grid` selection, and the focused visibility tests pass.

## Checkpoint review

### Checkpoint summary

- Date: 2026-05-16
- Active report: `2026-05-16-ai-studio-top-tab-panel-mismatch-closeout.md`
- Current lane status: `done`
- Checkpoint goal:
  - explain why the AI Studio top shortcuts drift from visible panel state
  - patch the smallest shared visibility layer that causes the mismatch
  - validate the rail contract with focused tests

### What I did

- Audited the retained top-tab handoff and traced the AI Studio page state into the right-rail renderer.
- Identified that the shortcuts were implemented as boolean toggles rather than named destination selectors.
- Patched the panel-visibility domain helpers.
- Added/updated focused visibility tests.
- Fixed one nearby stale mock so the rail-layout test suite stayed useful.

### How I did it

- commands run:
  - targeted `sed` and `rg` across `AiStudioPageContent`, `panelVisibility`, `ReferenceGridSections`, and the retained Beeper report
  - `cd frontend && npm run test -- features/ai-studio/logic/__tests__/panelVisibility.test.ts features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx`
  - `cd frontend && npx eslint features/ai-studio/logic/panelVisibility.ts features/ai-studio/logic/__tests__/panelVisibility.test.ts features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx`
- files/doc surfaces inspected:
  - retained D-Bug handoff
  - retained Beeper report
  - `AiStudioPageContent.tsx`
  - `panelVisibility.ts`
  - `useReferenceGridRuntimeScaffold.ts`
  - `ReferenceGridSections.tsx`
  - local visibility and rail-layout tests
- validations run:
  - focused unit tests
  - focused rail-layout tests
  - targeted eslint
- reasoning or narrowing method used:
  - follow state ownership first
  - separate header styling state from render visibility state
  - patch the shared domain layer instead of papering over the renderer

### Performance rating

- scope control (1-10): 9
- evidence quality (1-10): 9
- validation discipline (1-10): 9
- communication clarity (1-10): 8
- stop-condition discipline (1-10): 8
- learning capture (1-10): 8
- weighted overall score (derived): 8.6
- score band: `healthy`
- critical failure override triggered: `no`
- override reason if yes:

### Weakest areas

- lowest category: `communication clarity`, `stop-condition discipline`, and `learning capture` tied at `8`
- why it was weak:
  - the production symptom initially looked like a presenter mismatch, but the real bug lived in a smaller shared domain helper, so the closeout needed a bit of state-tracing explanation

### Improvement action

- what I will do differently next checkpoint:
  - when a UI “tab mismatch” is reported, check first whether the controls are modeled as toggles instead of named destination selectors
- should this be written into training history? `yes`

### Next step

- next checkpoint action:
  - move to the next retained D-Bug lane and start by tracing the smallest state or route ownership surface before broader runtime audits
- stop condition still active:
  - no

## Residual risk

- This closeout fixes the repo-side state contract but does not replace live production browser verification.
- Other still-active D-Bug lanes remain:
  - `2026-05-15-character-reload-auth-bounce.md`
  - `2026-05-15-character-route-bootstrap-stall.md`

## Exact next step

- Start with `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-reload-auth-bounce.md` if the next pass should continue reducing the active D-Bug queue.
