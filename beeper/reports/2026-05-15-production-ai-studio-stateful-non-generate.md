# Production AI Studio Stateful Non-Generate Lane

## What I Tried

- reopened the saved Beeper production project in AI Studio
- kept the studio in a wide desktop viewport
- edited the main prompt field with a new realistic prompt
- reloaded the page
- reopened the same project in a fresh signed-in browser context

## What Worked

- the existing production project reopened cleanly
- the main prompt field was editable
- the new prompt value stayed visible after edit
- the same value persisted after reload
- the same value also persisted in a fresh signed-in browser context

## What Did Not Work

- no new user-visible failure in this lane
- reload-time request-abort noise appeared in the trace, but it did not break the prompt outcome

## Real User Read

- this is the first clearly validated AI Studio editing success path
- a normal user can reopen a real project, adjust the prompt, and trust that the prompt will still be there later
- that meaningfully upgrades AI Studio from “reachable shell with suspicious controls” to “partly trustworthy working surface”

## UX Notes

- the dense create surface reads much better once the viewport is wide enough to show the full prompt and generation area
- prompt persistence is a high-trust behavior and matters more than a superficial shell pass
- AI Studio still should not be treated as fully healthy overall because:
  - generate remains an open defect lane
  - top layout tab semantics still feel unreliable

## Code Follow-Up

- likely ownership:
  - `frontend/pages/dashboard.tsx:607`
  - `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx:91`
  - AI Studio workspace persistence path behind the saved project prompt state
- no new D-Bug handoff is needed from this checkpoint

## Evidence

- packet:
  - `beeper/runs/2026-05-15-171728-prod-ai-studio-stateful-non-generate/evidence/ai-state-01-summary.json`
  - `beeper/runs/2026-05-15-171728-prod-ai-studio-stateful-non-generate/evidence/ai-state-02-prompt-persistence-summary.json`
  - `beeper/runs/2026-05-15-171728-prod-ai-studio-stateful-non-generate/evidence/ai-state-04-fresh-context-summary.json`
- screenshots:
  - `ai-state-01-home.png`
  - `ai-state-02-prompt-edited.png`
  - `ai-state-03-prompt-reloaded.png`
  - `ai-state-04-fresh-context-reopen.png`

## Result

- AI Studio now has one believable validated normal-user success path
- route-level status should move from `partial` to `validated` for the core prompt-persistence workflow
- next high-value lane should leave AI Studio and close another low-coverage route
