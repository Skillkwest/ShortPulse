---
title: MVP UI/UX Phase UX-0 Baseline Report (Full Route Set)
status: Active
owner: QA + Design + Frontend Engineering
created: 2026-02-14
last_updated: 2026-02-14
related_plan: docs/planning/mvp-ui-ux-stabilization-remediation-plan.md
related_issue_board: docs/planning/mvp-ui-ux-issue-board.md
supersedes: docs/archive/mvp-ui-ux-phase0-baseline-report-2026-02-14-dashboard-ai-studio.md
---

# MVP UI/UX Phase UX-0 Baseline Report (Full Route Set)

Purpose: provide complete UX-0 baseline evidence for all five priority authenticated routes, plus first-pass keyboard baseline observations.

## Run metadata
- Date: `2026-02-14`
- Base URL: `http://127.0.0.1:3000`
- Capture tool: Playwright scripts run against local dev server
- Auth result: `authenticated`
- Artifact root: `/tmp/shortpulse-uiux-baseline-2026-02-14`
- Artifact retention note: `/tmp` is non-durable; upload these images to team evidence storage for durable retention.

## Route coverage
- Included routes: `/dashboard`, `/ai-studio`, `historical implementation`, `/profile`, `/performance`
- Viewports captured per route: `1440`, `1024`, `768`, `390`

## Screenshot matrix (UX0-01)

| Route | Target viewport | Captured image | Exported dimensions | Artifact path |
| --- | --- | --- | --- | --- |
| `/dashboard` | `1440x1024` | `2026-02-14_dashboard_1440w_base.png` | `1440x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_dashboard_1440w_base.png` |
| `/dashboard` | `1024x900` | `2026-02-14_dashboard_1024w_base.png` | `1024x1314` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_dashboard_1024w_base.png` |
| `/dashboard` | `768x1024` | `2026-02-14_dashboard_768w_base.png` | `768x1605` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_dashboard_768w_base.png` |
| `/dashboard` | `390x844` | `2026-02-14_dashboard_390w_base.png` | `530x2635` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_dashboard_390w_base.png` |
| `/ai-studio` | `1440x1024` | `2026-02-14_ai-studio_1440w_base.png` | `1440x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_ai-studio_1440w_base.png` |
| `/ai-studio` | `1024x900` | `2026-02-14_ai-studio_1024w_base.png` | `1024x900` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_ai-studio_1024w_base.png` |
| `/ai-studio` | `768x1024` | `2026-02-14_ai-studio_768w_base.png` | `768x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_ai-studio_768w_base.png` |
| `/ai-studio` | `390x844` | `2026-02-14_ai-studio_390w_base.png` | `390x844` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_ai-studio_390w_base.png` |
| `historical implementation` | `1440x1024` | `2026-02-14_media-library_1440w_base.png` | `1440x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_media-library_1440w_base.png` |
| `historical implementation` | `1024x900` | `2026-02-14_media-library_1024w_base.png` | `1024x900` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_media-library_1024w_base.png` |
| `historical implementation` | `768x1024` | `2026-02-14_media-library_768w_base.png` | `768x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_media-library_768w_base.png` |
| `historical implementation` | `390x844` | `2026-02-14_media-library_390w_base.png` | `390x844` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_media-library_390w_base.png` |
| `/profile` | `1440x1024` | `2026-02-14_profile_1440w_base.png` | `1440x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_profile_1440w_base.png` |
| `/profile` | `1024x900` | `2026-02-14_profile_1024w_base.png` | `1024x900` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_profile_1024w_base.png` |
| `/profile` | `768x1024` | `2026-02-14_profile_768w_base.png` | `768x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_profile_768w_base.png` |
| `/profile` | `390x844` | `2026-02-14_profile_390w_base.png` | `390x844` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_profile_390w_base.png` |
| `/performance` | `1440x1024` | `2026-02-14_performance_1440w_base.png` | `1440x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_performance_1440w_base.png` |
| `/performance` | `1024x900` | `2026-02-14_performance_1024w_base.png` | `1024x900` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_performance_1024w_base.png` |
| `/performance` | `768x1024` | `2026-02-14_performance_768w_base.png` | `768x1024` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_performance_768w_base.png` |
| `/performance` | `390x844` | `2026-02-14_performance_390w_base.png` | `390x844` | `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_performance_390w_base.png` |

## Keyboard baseline findings (UX0-02 current pass)

Pause context:
- As of 2026-02-14, Stripe/subscription pipeline work is paused for this UI/UX pass.
- Subscription cancel/downgrade modal keyboard validation is deferred to follow-up ticket `UX0-D1`.

Keyboard capture screenshots:
- `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_keyboard_dashboard.png`
- `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_keyboard_ai-studio.png`
- `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_keyboard_media-library.png`
- `/tmp/shortpulse-uiux-baseline-2026-02-14/2026-02-14_keyboard_profile-subscription.png`

Observed:
- `Dashboard`: first Tab target is `Skip to main content` (positive baseline signal).
- `AI Studio`: `Create` was selected, `Generate` became visible, and Enter-trigger was exercised; UI surfaced prompt-required and character-mode notices.
- `Media Library`: seeded upload succeeded (`seededUploadError=null`) and produced a ready card (`mediaCardCount=1`).
- `Media Library`: keyboard Enter on card did not open preview modal; double-click opened modal; Escape did not close that modal in this run.
- `Profile subscription`: no visible `Cancel subscription` or `Downgrade to ...` actions in this account state; this validation path is now deferred under paused Stripe/subscription scope.

## Initial risk notes from baseline
- `Dashboard` mobile capture still exports wider than target (`530px` at `390` target), consistent with responsive overflow concerns already tracked in UX findings.
- `Media Library` modal did not close on Escape in this baseline run after modal open, which aligns with previously audited modal keyboard inconsistency risk.
- Subscription modal keyboard verification remains deferred until Stripe/subscription pipeline work resumes (`UX0-D1`).

## Execution status summary
- `UX0-01`: `Done` (full route + viewport matrix captured).
- `UX0-02`: `Done` (active-scope keyboard path exercised; deferred subscription modal path captured in `UX0-D1`).
- `UX0-D1`: `Paused` (subscription modal keyboard path deferred with Stripe/subscription pipeline pause).
- `UX0-03`: `Done`.
- `UX0-04`: `Done`.
