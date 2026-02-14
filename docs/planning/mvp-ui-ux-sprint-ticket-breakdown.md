---
title: MVP UI/UX Sprint Ticket Breakdown
status: Active
owner: Product + Design + Frontend Engineering
created: 2026-02-14
last_updated: 2026-02-14
source_plan: docs/planning/mvp-ui-ux-stabilization-remediation-plan.md
execution_board: docs/planning/mvp-ui-ux-issue-board.md
---

# MVP UI/UX Sprint Ticket Breakdown

Purpose: convert the UI/UX stabilization plan into sprint-ready tickets with explicit ownership and estimate, with one ticket per checklist item from the source plan.

## Capacity assumptions
- Estimates are engineering-focused and sized in ideal days (`d`).
- Ownership is mapped to named assignees in `docs/planning/mvp-ui-ux-issue-board.md`.
- `P0` tickets are release-blocking for the UI/UX track.
- Stripe/subscription pipeline work is temporarily paused and excluded from active sprint execution in this track.

## Ticket register

| ID | Priority | Phase | Ticket | Owner | Estimate | Dependency |
| --- | --- | --- | --- | --- | --- | --- |
| `UX0-01` | `P0` | UX-0 | Capture baseline screenshots at `1440/1024/768/390` for Dashboard, AI Studio, Media Library, Profile, Performance. | QA + Design | 1.0d | None |
| `UX0-02` | `P0` | UX-0 | Record baseline keyboard pass for login -> dashboard -> AI Studio generate -> media preview modal -> profile (non-subscription surfaces). | QA | 0.5d | `UX0-01` |
| `UX0-D1` | `P1` | UX-0 | Resume deferred subscription cancel/downgrade modal keyboard validation after Stripe/subscription pipeline pause is lifted. | QA | 0.25d | `UX0-02` |
| `UX0-03` | `P0` | UX-0 | Create issue checklist board and map each plan finding to one trackable ticket. | Product | 0.5d | None |
| `UX0-04` | `P0` | UX-0 | Confirm acceptance criteria ownership (Design + Engineering sign-off) for all `P0` tickets. | Product + Eng Lead | 0.5d | `UX0-03` |
| `UX1-01` | `P0` | UX-1 | Remove hard viewport lock and replace with responsive viewport behavior. | Frontend | 1.0d | `UX0-01` |
| `UX1-02` | `P0` | UX-1 | Replace `max-device-width` breakpoints with responsive `max-width`/container rules in core stylesheets. | Frontend | 1.5d | `UX1-01` |
| `UX1-03` | `P0` | UX-1 | Refactor AI Studio shell to eliminate fixed-height + hidden-overflow content trapping. | Frontend | 1.5d | `UX1-01` |
| `UX1-04` | `P0` | UX-1 | Preserve rail/header behavior while restoring content scroll accessibility on small/medium screens. | Frontend + Design | 1.0d | `UX1-03` |
| `UX1-05` | `P0` | UX-1 | Add responsive regression checks for orientation + `125%/200%` zoom behavior. | QA | 0.5d | `UX1-02`, `UX1-04` |
| `UX2-01` | `P0` | UX-2 | Standardize modal behavior: Escape close, open focus, close focus return, intentional backdrop behavior. | Frontend | 1.5d | `UX1-01` |
| `UX2-02` | `P0` | UX-2 | Convert nested confirmation overlays into semantic dialogs (`role`, `aria-modal`, labels). | Frontend | 0.5d | `UX2-01` |
| `UX2-03` | `P0` | UX-2 | Fix Media Library tabs semantics (`role=tab`, `aria-selected`, panel controls). | Frontend | 0.75d | `UX2-01` |
| `UX2-04` | `P0` | UX-2 | Resolve non-functional interactive affordances (click/pointer/role parity + keyboard support). | Frontend | 1.0d | `UX2-01` |
| `UX2-05` | `P0` | UX-2 | Add consistent skip-link + main landmark structure across authenticated routes. | Frontend | 0.75d | `UX2-01` |
| `UX2-06` | `P0` | UX-2 | Add page-level AI Studio `<h1>` while preserving visual hierarchy. | Frontend + Design | 0.25d | None |
| `UX2-07` | `P0` | UX-2 | Align live-region semantics (`alert` vs `status`) with message urgency. | Frontend | 0.5d | `UX2-01` |
| `UX3-01` | `P0` | UX-3 | Resolve dashboard onboarding/workflow CTA dead ends with clear destination behavior. | Product + Frontend | 0.75d | `UX0-03` |
| `UX3-02` | `P0` | UX-3 | Align Performance entry points and route intent between dashboard and live/placeholder pages. | Product + Frontend | 0.75d | `UX3-01` |
| `UX3-03` | `P0` | UX-3 | Standardize "coming soon" contract (copy, CTA, return path). | Product + Design | 0.5d | `UX3-01` |
| `UX3-04` | `P0` | UX-3 | Audit top-level dashboard tool card title/description/CTA/destination consistency. | Design + Product | 0.5d | `UX3-02` |
| `UX4-01` | `P1` | UX-4 | Select canonical button system and migrate overlapping core surfaces. | Design System + Frontend | 1.5d | `UX2-01` |
| `UX4-02` | `P1` | UX-4 | Normalize plan naming/palette to `Free/Media/Studio/Business` rules. | Frontend | 0.5d | None |
| `UX4-03` | `P1` | UX-4 | Fix self-referential radius tokens and validate downstream rendering. | Frontend | 0.5d | None |
| `UX4-04` | `P1` | UX-4 | Define single source for global interaction states (hover/focus-visible/disabled/loading). | Design System | 0.75d | `UX4-01` |
| `UX4-05` | `P1` | UX-4 | Add token migration log for cross-surface design changes. | Design + Frontend | 0.5d | `UX4-04` |
| `UX5-01` | `P1` | UX-5 | Split oversized UI/CSS files impacting high-churn UX surfaces. | Frontend | 2.5d | `UX1-03`, `UX2-01` |
| `UX5-02` | `P1` | UX-5 | Enforce modularization target (`<800` for core files, `<500` for new files unless justified). | Frontend Lead | 0.25d | `UX5-01` |
| `UX5-03` | `P1` | UX-5 | Reduce AI Studio token sprawl/duplicates using style inventory guidance. | Frontend + Design | 1.0d | `UX5-01` |
| `UX5-04` | `P1` | UX-5 | Align style import order docs with actual `globals.css` behavior (or document intentional drift). | Frontend | 0.5d | `UX5-01` |
| `UX6-01` | `P0` | UX-6 | Exclude generated Playwright artifacts from ESLint scope. | Frontend | 0.5d | None |
| `UX6-02` | `P0` | UX-6 | Re-enable strict lint gate behavior in CI. | Frontend + DevOps | 0.5d | `UX6-01` |
| `UX6-03` | `P0` | UX-6 | Add accessibility checklist to PR template for UI-touching changes. | Frontend Lead | 0.25d | None |
| `UX6-04` | `P0` | UX-6 | Add before/after screenshot requirement for `P0` UX layout/navigation fixes. | Product + Eng Lead | 0.25d | `UX0-01` |
| `UX7-01` | `P1` | UX-7 | Update architecture/style docs to reflect new responsive/modal/interaction conventions. | Frontend + Design | 0.75d | `UX1-05`, `UX2-07` |
| `UX7-02` | `P1` | UX-7 | Add SOP guidance for modal accessibility and coming-soon route policy. | Product Ops | 0.5d | `UX3-03` |
| `UX7-03` | `P1` | UX-7 | Add ADR if responsive or modal contract changes are material/durable decisions. | Eng Lead | 0.5d | `UX7-01` |
| `UX7-04` | `P1` | UX-7 | Log UI/UX remediation milestones and release decisions in changelog. | Product + Eng | 0.25d | Ongoing |

## Suggested sprint grouping
- Sprint A (`P0 foundation`): `UX0-*`, `UX1-*`, `UX6-01`
- Sprint B (`P0 accessibility + route trust`): `UX2-*`, `UX3-*`, `UX6-02..04`
- Sprint C (`P1 hardening`): `UX4-*`, `UX5-*`, `UX7-*`
- Deferred backlog (paused scope): `UX0-D1`

## Tracking fields to add in board
- `Status`: Not Started / In Progress / Blocked / Done
- `Assignee`: named owner from primary owner role
- `Reviewer`: Design + Engineering reviewer where applicable
- `Acceptance evidence`: screenshot links, PR link, QA notes
