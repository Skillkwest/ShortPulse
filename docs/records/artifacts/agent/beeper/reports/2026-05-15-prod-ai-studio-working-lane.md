# Beeper Run Report - 2026-05-15 - prod-ai-studio-working-lane

Purpose: prod ai studio working lane.

## Task

- Requested work: prod ai studio working lane
- Environment: production
- Base URL: https://www.shortpulse.ai
- Runtime project ref: ftgrqgjrchpimronuhop
- Audit user: `aiagentayla@gmail.com`

## Scope

- Routes covered: `/ai-studio`, in-studio projects overlay
- Primary user journey: reopen an existing project -> inspect primary controls -> enter a real prompt -> attempt generation -> verify adjacent studio controls
- What was intentionally skipped: uploads from local disk, destructive project changes, delete/archive flows, logout, billing changes, and broad media-library browsing outside the studio context

## Action Log

| Step | Surface                    | Action                                                                             | Result                                                                                                      | Evidence                                                                                                             |
| ---- | -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | AI Studio project reopen   | Opened an existing Beeper production project in AI Studio                          | Project reopened successfully in production                                                                 | `ai-studio-control-map.json`, `ai-working-08-direct-ai-studio.png`                                                   |
| 2    | AI Studio control map      | Collected visible buttons, inputs, textareas, and links from the live studio state | Confirmed reachable primary controls for Create/Edit/Video/Sound, libraries, prompt composer, and projects  | `ai-studio-control-map.json`, `ai-studio-map-02-ai-studio-home.png`                                                  |
| 3    | Create/Edit path           | Switched between Create and Edit and toggled Styles                                | Core composer-adjacent controls were reachable                                                              | `ai-working-02-edit-mode.png`, `ai-working-03-create-mode.png`, `ai-working-04-styles-open.png`                      |
| 4    | Prompt entry               | Filled a real prompt in the AI Studio composer                                     | Prompt accepted and remained visible in the composer                                                        | `ai-working-09-prompt-filled.png`, `ai-studio-generate-summary.json`                                                 |
| 5    | Generate attempt           | Clicked both visible generate controls in chat-off create mode                     | Workspace `PUT` happened, but no visible generation request/progress/result appeared in the observed window | `ai-working-10-after-generate-click.png`, `ai-working-11-after-generate-wait.png`, `ai-studio-generate-summary.json` |
| 6    | In-studio projects control | Clicked `Projects` inside AI Studio                                                | Projects overlay opened and showed the current Beeper project                                               | `ai-working-17-projects-button-from-ai-studio.png`                                                                   |

## Findings

### Blockers

- None at route access level.

### Functional Issues

- `P1/P2 candidate` AI Studio generate no-op in production create mode.
  - Repro:
    1. Open a real production AI Studio project.
    2. Enter a real prompt in the `Write your prompt...` textarea.
    3. Click the visible `Generate` control in chat-off create mode.
  - Expected:
    - a generation request should fire or the UI should show explicit progress/guardrail feedback.
  - Actual:
    - the prompt remained in place
    - the body text and visible UI state did not change meaningfully
    - no generation request was observed in the captured request list
    - the only clearly related mutation was `PUT /api/projects/<projectId>/workspace`
  - Why this matters:
    - a real user can fill the prompt and click a live enabled generate CTA without getting a clear result
    - the control appears actionable but behaves like a save/no-op path
  - Important code/context narrowing:
    - the UI contract expects the inline generate action to call `handleGenerate`
    - `useStandardCreateInlineGenerate` tests assert that behavior directly
    - live production behavior did not show evidence of an actual generation call after the click

### UI / UX Notes

- Positive:
  - reopening an existing project in AI Studio worked
  - the in-studio `Projects` control worked and showed the current project
  - the prompt field accepted a real prompt cleanly
- Weakness:
  - when generate does not visibly proceed, the studio gives almost no user-facing feedback
  - from a real-user perspective this feels like a dead or misleading primary CTA

## Code Follow-Up

- Probable code surfaces:
  - `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx:355`
  - `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx:777`
  - `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreateInlineGenerate.ts:30`
  - `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts:54`
  - `frontend/pages/ai-studio.tsx:279`
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts:210`
- Supporting docs or tests inspected:
  - `PromptStep.actions.test.tsx`
  - `useStandardCreateInlineGenerate.test.ts`
  - the live AI Studio control map and request captures from this run
- What another agent should inspect first:
  - whether `handleChatOffInlineGenerate` is firing but `handleGenerate` exits before `generateOutput`
  - whether `generateOutput` is silently blocked after workspace persistence in production
  - whether the visible `Generate` button is wired to a save path that never surfaces guardrail feedback to the user

## Evidence Packet

- JSON packet:
  - `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/evidence/ai-studio-control-map.json`
  - `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/evidence/ai-studio-generate-summary.json`
- Screenshots:
  - `ai-studio-map-01-projects-overlay.png`
  - `ai-studio-map-02-ai-studio-home.png`
  - `ai-working-08-direct-ai-studio.png`
  - `ai-working-09-prompt-filled.png`
  - `ai-working-10-after-generate-click.png`
  - `ai-working-11-after-generate-wait.png`
  - `ai-working-17-projects-button-from-ai-studio.png`
- Console / runtime signals:
  - no severe console errors
  - no page errors
  - no HTTP 4xx/5xx failures directly tied to generate
  - request-failure noise remained limited to navigation-abort fetches common in prior runs
- Local code references:
  - `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx`
  - `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
  - `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreateInlineGenerate.ts`
  - `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`

## Self Audit

- Score out of 10: 8
- What felt strong:
  - advanced AI Studio coverage from route-opened to real prompt-entry and primary-action behavior
  - narrowed the failure to a likely generate-action gap rather than a broad studio outage
- What slipped:
  - the first attempt used the wrong prompt-field interaction order and cost one retry
  - adjacent controls like Media Library were not deeply covered in this checkpoint
- What assumptions were made:
  - treated the absence of a generation request plus lack of UI feedback as a product issue because both generate controls were enabled and the tested runtime path expects `handleGenerate` to run
- Smallest improvement for the next run:
  - test one adjacent successful studio action beyond project reopen, such as opening a saved project from the overlay or exercising a non-generate library panel path more deeply

## Training Record

- New helper or script needed?: no immediate new helper required
- Existing helper update needed?: optional; a dedicated AI Studio macro would reduce repeated inline Playwright probing
- SOP / checklist update needed?: no new standing rule from this checkpoint
- Memory / training-history update needed?: yes; coverage and training history should reflect partial real-use AI Studio coverage plus the generate no-op finding
