# Bopper Evidence Manifest

Purpose: keep the run packet self-contained by naming what evidence exists and what each artifact proves.

## Run

- Date: 2026-05-16
- Task: Bopper compare Open Projects as the first deliberate entry path against New Project trust and reopening clarity

## Expected Artifacts

- UI screenshots:
  - Computer Use screenshot of stale local `localhost` network error on a reopened AI Studio tab.
  - Computer Use screenshot of production public dashboard at `https://www.shortpulse.ai/dashboard` showing `Log in`.
  - Computer Use screenshot of local project restore progress card on reopened AI Studio project.
  - Computer Use screenshot of final local AI Studio rendering error state.
- Runtime/network captures:
  - Dev-server/browser output showing `GET /dashboard 200`.
  - Browser runtime output showing `Module not found: Can't resolve './generationCharacterModeDecision'`.
  - Browser runtime output showing `EDIT_PRESET_BASE_DEFINITIONS is not defined`.
  - Browser runtime output showing `SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS is not iterable`.
- Console captures:
  - Chrome/Next overlay states captured through Computer Use accessibility snapshots.
- Any copied API payloads or IDs:
  - reopened local AI Studio project id: `db95508d-82f2-4827-a60d-32f9f0c48716`
  - reopened local AI Studio session id: `3da12952-a72f-4d4d-9067-2c5df3bb62b1`

## Artifact Notes

- What each artifact proves:
  - The public production dashboard available in this Chrome window is not authenticated, so it cannot service the intended `Open Projects` lane.
  - The local signed-in continuity path exists and can recover a saved AI Studio project route.
  - The local reopened project fails during visible restore with a real rendering error rather than a user-choice mistake.
  - The current local branch has multiple AI Studio/runtime instability signals that likely share code-surface drift.
- Missing evidence to capture before closeout:
  - No standalone image files were exported from Computer Use; evidence lives in the run packet text plus the Codex transcript screenshots.
