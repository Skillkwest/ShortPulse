---
title: MVP UI/UX Phase UX-0 Baseline QA Checklist
status: Active
owner: QA + Design + Frontend Engineering
created: 2026-02-14
last_updated: 2026-02-14
source_plan: docs/planning/mvp-ui-ux-stabilization-remediation-plan.md
---

# MVP UI/UX Phase UX-0 Baseline QA Checklist

Purpose: provide a ready-to-run baseline QA checklist for Phase UX-0 before remediation implementation begins.

## Scope
- Dashboard: `/dashboard`
- AI Studio: `/ai-studio`
- Media Library: `historical implementation`
- Profile: `/profile`
- Performance: `/performance`

## Temporary paused scope (2026-02-14)
- Stripe/subscription pipeline checks are paused.
- Subscription cancel/downgrade modal validation is deferred until pipeline work resumes.

## Environment checklist
- [ ] Latest `main` pulled and dependencies installed.
- [ ] Local app running with `cd frontend && npm run dev`.
- [ ] Test account(s) available with access to authenticated routes.
- [ ] Browser cache cleared before baseline capture.
- [ ] Capture environment recorded (OS, browser, build commit SHA).

## Viewport capture matrix
Store screenshots using this naming pattern:
`YYYY-MM-DD_{route}_{width}w_{state}.png`

| Route | 1440w | 1024w | 768w | 390w | Notes |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | [ ] | [ ] | [ ] | [ ] |  |
| `/ai-studio` | [ ] | [ ] | [ ] | [ ] |  |
| `historical implementation` | [ ] | [ ] | [ ] | [ ] |  |
| `/profile` | [ ] | [ ] | [ ] | [ ] |  |
| `/performance` | [ ] | [ ] | [ ] | [ ] |  |

## Zoom and orientation checks
- [ ] Desktop `125%` zoom pass completed for all routes.
- [ ] Desktop `200%` zoom pass completed for all routes.
- [ ] Mobile orientation portrait/landscape pass completed for 390w baseline.
- [ ] Clipping, overlap, and hidden-scroll findings logged.

## Keyboard workflow pass
Workflow: login -> dashboard -> AI Studio generate flow -> media preview modal -> profile (non-subscription surfaces).

- [ ] Skip link appears and works where expected.
- [ ] Visible focus ring present on primary controls.
- [ ] Tab order is logical and cyclical in open modal states.
- [ ] Escape closes each modal and restores focus to trigger.
- [ ] Enter/Space activate intended controls (no dead controls).
- [ ] No keyboard trap in AI Studio, Media Library, Profile, or Performance.

## Accessibility structure pass
- [ ] One clear `<h1>` per top-level page.
- [ ] Main landmark present and reachable.
- [ ] Tabs expose correct semantics (`tablist/tab/aria-selected/aria-controls`).
- [ ] Alerts/status regions match urgency level and do not over-announce.
- [ ] Icon-only controls have accessible labels.

## Defect logging format
For each defect, log:
- `ID`
- `Route`
- `Viewport`
- `Severity` (`P0`, `P1`, `P2`)
- `Type` (responsive, accessibility, navigation, consistency, interaction)
- `Repro steps`
- `Expected behavior`
- `Actual behavior`
- `Screenshot/video link`
- `Owner`

## Exit criteria for UX-0
- [ ] Baseline captures completed for all route/viewport pairs.
- [ ] Keyboard pass findings recorded.
- [ ] Accessibility structure findings recorded.
- [ ] Findings synced into ticket board using IDs in `mvp-ui-ux-sprint-ticket-breakdown.md`.
