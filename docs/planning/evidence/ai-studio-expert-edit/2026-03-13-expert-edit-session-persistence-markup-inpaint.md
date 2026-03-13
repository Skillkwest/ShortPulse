# Expert Edit Session Persistence Closure (Markup + Inpaint)

- Date: 2026-03-13
- Scope: AI Studio Expert Edit page-session persistence across workflow/tool switching
- Contract: Persist `layers` + `markup` + `inpaint` session state together; reset on `sid` change

## Implemented Contract

1. Unified internal session payload:
   - `ExpertEditSessionState.version`
   - `layers` slice (layer stack + selection + counter)
   - `markup` slice (`strokes` + `history.past/present/future`)
   - `inpaint` slice (`history.past/present/future`)
2. State ownership moved to page-level AI Studio state and threaded into Expert Edit props as:
   - `sessionState`
   - `onSessionStateChange`
3. Hydration/restoration:
   - Expert Edit restores layer stack, markup history, and inpaint history on mount.
   - Inpaint controller receives one-shot restore of `history.present` before baseline capture loop.
4. Stability guardrails:
   - Semantic equality checks prevent redundant parent updates.
   - Session dispatch is single-frame coalesced during high-frequency drag/paint operations.
5. Session lifecycle:
   - Workflow/tool switching preserves state within the active page session.
   - `sid` change clears persisted Expert Edit session payload.

## Regression Validation

Executed:

1. `npm -C frontend run test -- ExpertEditPanelView.test.tsx`
2. `npm -C frontend run test -- AiStudioPageContent.drop.test.tsx`
3. `npm -C frontend run test -- useInpaintMaskController.test.ts`
4. `npm -C frontend run test -- markupStrokeController.test.ts`
5. `npm -C frontend run lint`
6. `npm -C frontend run build`

Outcome:

- Targeted test suites passed.
- Lint passed with pre-existing warnings outside this scope.
- Build passed.

## Evidence Notes

1. Added Expert Edit tests verifying:
   - unified session hydration emission path
   - inpaint `history.present` restore call path
   - markup/history persistence across unmount/remount with Undo/Redo continuity
2. No public route/API/database contracts changed.
