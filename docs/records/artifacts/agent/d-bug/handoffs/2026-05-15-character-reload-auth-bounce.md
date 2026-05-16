# D-Bug Handoff - Character Reload Auth Bounce

## Issue

- Surface: production Character Manager in the Codex in-app browser
- Severity: medium-high
- User-facing problem: after the Character route becomes interactive and accepts a real rename, reload does not return the user to the editor and instead falls back through `Checking your session…` to `/auth?next=%2Fcharacter`

## Why This Matters

- this is a continuity trust break on a real edit path
- the user can do real work in-session, then immediately lose route continuity on reload
- it may overlap with the earlier Character bootstrap stall, but this signature is cleaner because it is tied to edit -> reload rather than a vague fresh reopen

## Repro

1. Open production `/character` in the Codex in-app browser.
2. Sign in from `/auth?next=%2Fcharacter`.
3. If the first sign-in lands somewhere odd, re-enter `/character` and sign in again until the Character editor becomes interactive.
4. Rename the visible existing character.
5. Reload the page.
6. Observe:
   - `Checking your session…`
   - redirect to `/auth?next=%2Fcharacter`
7. Sign in again and retry `/character`.
8. Observe the route still failing to settle back into the editor during the observed window.

## Expected

- reload after a real in-session edit should restore the protected Character route and return the user to a usable editor or manage state

## Actual

- reload falls back into the protected-route session check and then bounces to auth instead of resuming the Character session

## Evidence

- Beeper retained report:
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-reuse-lane.md`
- Beeper full report:
  - `beeper/reports/2026-05-15-production-character-reuse-lane.md`
- Run packet:
  - `beeper/runs/2026-05-15-231544-prod-character-reuse-lane`
- Summary packet:
  - `beeper/runs/2026-05-15-231544-prod-character-reuse-lane/evidence/character-reuse-summary.json`
- Related older Character handoff:
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-route-bootstrap-stall.md`

## Likely Code Surfaces

- protected-route session redirect:
  - `frontend/lib/authGuard.ts`
- route-level loading gate:
  - `frontend/pages/_app.tsx:197`
  - `frontend/pages/_app.tsx:206`
- Character route shell:
  - `frontend/pages/character.tsx`
- Character top-level controls and save-state visibility:
  - `frontend/features/character-manager/components/CharacterManagerWorkflowTabs.tsx`
- Character loading shell:
  - `frontend/features/character-manager/components/CharacterProfileLoadingSkeleton.tsx`

## First Debug Read

- The Character editor can still render and accept a real in-session rename, so the route is not broadly dead.
- The cleaner failure is continuity after reload, not first access.
- The first place to clarify is whether the active session is actually being lost on reload or whether the protected-route gate is misreading an auth/restore transition.
- This may be the same underlying restore defect as the earlier bootstrap stall, but now the visible symptom is auth bounce rather than skeleton-only stall.

## Suggested Owner After Diagnosis

- D-Bug should decide whether this is:
  - a protected-route session persistence issue
  - a Character restore/bootstrap issue
  - or an in-app-browser-only quirk that needs narrower reproduction in a standard browser
- If this becomes a hosted auth/session problem, Nuclo may need the downstream lane.
