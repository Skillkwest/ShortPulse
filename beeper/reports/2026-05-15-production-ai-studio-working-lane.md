# Beeper Workflow / UX Audit

Purpose: fuller Beeper-owned analysis of the first real AI Studio working pass on production using a saved project.

## Run Metadata

- Date: 2026-05-15
- Environment: production
- Base URL: https://www.shortpulse.ai
- Runtime project ref: ftgrqgjrchpimronuhop
- Audit user: `aiagentayla@gmail.com`
- Workflow tested: reopen existing project -> inspect primary controls -> enter prompt -> attempt generate -> verify adjacent studio controls

## What Worked

- The saved Beeper project reopened in AI Studio successfully.
- The in-studio `Projects` control opened and showed the current project.
- The Create/Edit mode area, prompt composer, and styles control were reachable.
- The prompt field accepted a real prompt cleanly.

## What Broke

### 1. Generate appears live but behaves like a no-op

- Both visible generate controls were enabled.
- Entering a prompt and clicking generate did not produce visible progress, a visible error, or a visible generation result during the observed window.
- The captured request trail showed a workspace `PUT`, but no obvious generation-start request followed.
- The screen after the click still looked effectively idle.

## Why This Matters

- This is the primary action in AI Studio create mode.
- A real user can do the obvious thing and get almost no feedback.
- The failure feels worse than a clearly disabled button because the UI suggests the action is ready.

## Narrowing Result

- The code contract for chat-off inline generate is strong:
  - the prompt-step UI wires the button to `onChatOffInlineGenerate`
  - `useStandardCreateInlineGenerate` is supposed to call `handleGenerate`
  - tests assert that directly
- Live production behavior suggests the break is lower in the runtime path:
  - `handleGenerate` may exit early
  - `generateOutput` may not fire
  - or the generation path may be silently blocked after workspace persistence

## Secondary Notes

- AI Studio is not broadly dead.
- The shell loads, projects reopen, prompt entry works, and in-studio navigation remains usable.
- That makes the failure more specific and more actionable.

## Evidence Index

- JSON:
  - `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/evidence/ai-studio-control-map.json`
  - `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/evidence/ai-studio-generate-summary.json`
- Screenshots:
  - `ai-studio-map-02-ai-studio-home.png`
  - `ai-working-08-direct-ai-studio.png`
  - `ai-working-09-prompt-filled.png`
  - `ai-working-10-after-generate-click.png`
  - `ai-working-11-after-generate-wait.png`
  - `ai-working-17-projects-button-from-ai-studio.png`
- Related retained report:
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-working-lane.md`
