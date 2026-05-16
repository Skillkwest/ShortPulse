# D-Bug Handoff - Character Route Bootstrap Stall

## Issue

- Surface: production Character Manager
- Severity: medium
- User-facing problem: a fresh reopen of `/character` can sit on `Loading character profile...` skeleton state instead of settling back into the editor after real in-session edits

## Why This Matters

- this is a route-resume trust problem, not just a cosmetic skeleton
- the user can successfully edit in-session, then reopen and hit a stalled bootstrap-looking state

## Repro

1. Sign into production as the Beeper audit user.
2. Open `/character`.
3. Confirm the route is interactive.
4. Rename the visible character and click `Add character look`.
5. Reopen `/character` in a fresh browser session.
6. Observe the route showing:
   - `Loading character profile...`
   - `Pulling your character sheet and references into view.`
   - disabled `Save Character`
   - skeleton placeholders instead of the settled editor

## Expected

- fresh reopen should settle back into the character editor or a clear manage view within a normal user window

## Actual

- reopen can remain in bootstrap/loading UI instead of returning to a usable route state during the observed window

## Evidence

- Beeper retained report:
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-route-bundle.md`
- Beeper full report:
  - `beeper/reports/2026-05-15-production-character-route-bundle.md`
- Run packet:
  - `beeper/runs/2026-05-15-170121-prod-character-route-bundle`
- Primary screenshots:
  - `beeper/runs/2026-05-15-170121-prod-character-route-bundle/evidence/character-17-after-add-look.png`
  - `beeper/runs/2026-05-15-170121-prod-character-route-bundle/evidence/character-19-fresh-session-reopen.png`
- Supporting route captures:
  - `beeper/runs/2026-05-15-170121-prod-character-route-bundle/evidence/character-09-initial-create-shell.png`
  - `beeper/runs/2026-05-15-170121-prod-character-route-bundle/evidence/character-16-renamed-before-reload.png`

## Likely Code Surfaces

- bootstrap loading and snapshot apply:
  - `frontend/features/character-manager/hooks/useCharacterManagerBootstrapController.ts`
- route state and loading gates:
  - `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts:698`
- save-button visibility contract:
  - `frontend/features/character-manager/components/CharacterManagerWorkflowTabs.tsx:122`
- loading shell:
  - `frontend/features/character-manager/components/CharacterManagerShell.tsx:300`
  - `frontend/features/character-manager/components/CharacterProfileLoadingSkeleton.tsx:15`

## First Debug Read

- `hasUnsavedCharacterDraft` is `!characterId`, so the missing save button in the settled editor likely means the route believed it had an existing character
- the reopen problem looks more like bootstrap/restore/load state than raw form editing failure
- likely failure classes:
  - selected-character restore points at a bad/stale target
  - bootstrap load never clears `loading` / `isSwitchingCharacter`
  - a required draft fetch resolves too slowly or fails without escaping skeleton state cleanly

## Suggested Owner After Diagnosis

- D-Bug can isolate the restore/bootstrap bug
- main coding lane or Gear Ball can implement once the failure class is confirmed
