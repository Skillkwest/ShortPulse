---
title: MVP UI/UX Pass Execution Plan (2026-03-16 to 2026-03-27)
status: Active
owner: Product + Design + Frontend Engineering
created: 2026-03-16
last_updated: 2026-03-16
related_plan: docs/planning/mvp-ui-ux-stabilization-remediation-plan.md
related_tickets: docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md
related_board: docs/planning/mvp-ui-ux-issue-board.md
---

# MVP UI/UX Pass Execution Plan (2026-03-16 to 2026-03-27)

Purpose: provide one practical, execution-first to-do plan for the next remediation passes so work can proceed without re-scoping each day.

## Operating assumptions
- This plan is execution-oriented and can be run in normal implementation mode (no special planning mode required).
- Existing scope lock from `mvp-ui-ux-stabilization-remediation-plan.md` remains authoritative.
- Stripe/subscription paused scope (`UX0-D1`) remains out of scope.

## Baseline state (as of 2026-03-16)
Completed recently:
- `UX4-03` self-referential token fix (`frontend/styles/foundation.css`).
- `UX5-04` style import-order docs alignment (`docs/styles-structure.md` + `frontend/styles/globals.css`).
- Partial improvements toward `UX1-03`/`UX2-01`:
  - AI Studio non-canvas scroll-trap reduced.
  - Media Library modal Escape-close behavior improved.

Still open and release-relevant:
- `UX1-02` to `UX1-05`
- `UX2-01` to `UX2-07`
- `UX3-01` to `UX3-04`

## Pass sequence and outcomes

| Pass | Dates (target) | Primary tickets | Outcome |
| --- | --- | --- | --- |
| Pass A | 2026-03-16 to 2026-03-18 | `UX2-01`, `UX2-02`, `UX2-07` | Unified modal contract + alert semantics across core routes |
| Pass B | 2026-03-18 to 2026-03-21 | `UX1-02`, `UX1-03`, `UX1-04`, `UX1-05` | Responsive shell integrity with no content traps/clipping |
| Pass C | 2026-03-21 to 2026-03-24 | `UX2-03`, `UX2-04`, `UX2-05`, `UX2-06` | Accessible tabs/landmarks/heading structure + affordance parity |
| Pass D | 2026-03-24 to 2026-03-27 | `UX3-01` to `UX3-04`, `UX5-01` (kickoff) | Navigation trust fixes and first modularization split PR |

## Pass A: Modal contract and live-region semantics

Tickets: `UX2-01`, `UX2-02`, `UX2-07`

### To-do checklist
- [ ] Build a modal inventory matrix for:
  - `frontend/pages/dashboard.tsx`
  - `frontend/pages/profile.tsx`
  - `frontend/pages/media-library.tsx`
  - `frontend/pages/performance.tsx`
  - `frontend/features/ai-studio/components/DetailModal.tsx`
  - `frontend/features/ai-studio/components/ModelModal.tsx`
  - `frontend/features/performance/components/VideoDetailModal.tsx`
- [ ] Apply one shared behavior contract to each modal:
  - Escape closes topmost modal.
  - Focus enters modal on open.
  - Focus returns to trigger on close.
  - Backdrop click behavior is intentional and consistent.
- [ ] Convert any nested confirmation overlay to semantic dialog contract (`role=dialog`, `aria-modal=true`, labeled title/description).
- [ ] Normalize alert semantics:
  - urgent blocking errors: `role="alert"` + assertive
  - non-blocking status/info: `role="status"` + polite

### Acceptance criteria
- Keyboard-only close/open cycle works consistently on all listed modals.
- No modal leaves focus behind in background content when open.
- Screen-reader announcement severity matches message urgency.

### Validation
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- Targeted tests for modified modal components/hooks.

## Pass B: Responsive and shell integrity

Tickets: `UX1-02`, `UX1-03`, `UX1-04`, `UX1-05`

### To-do checklist
- [ ] Replace remaining `max-device-width` breakpoints with responsive `max-width` rules in:
  - `frontend/styles/ai-studio-responsive.css`
  - `frontend/styles/workspace-media.css`
  - `frontend/styles/character-manager.css`
  - `frontend/styles/landing-sections.css`
- [ ] Remove remaining fixed-height/overflow content traps in AI Studio shell while preserving rail/header intent.
- [ ] Verify small/medium viewport behavior keeps primary content reachable without hidden scroll regions.
- [ ] Add explicit regression capture for:
  - widths: `1440`, `1024`, `768`, `390`
  - zoom: `125%`, `200%`
  - orientation: portrait/landscape mobile widths

### Acceptance criteria
- No horizontal overflow at 390-width baseline capture on core routes.
- AI Studio Create/Edit/Image content remains scroll-accessible where needed.
- Rail/header remain usable while content remains reachable.

### Validation
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- `cd frontend && npm run build`
- Capture before/after screenshots per PR template requirement.

## Pass C: Accessibility semantics and route consistency

Tickets: `UX2-03`, `UX2-04`, `UX2-05`, `UX2-06`

### To-do checklist
- [ ] Media Library tabs: enforce full tab semantics (`role=tablist/tab`, `aria-selected`, controlled panel relation).
- [ ] Remove non-functional interactive affordances (pointer/role/button parity with keyboard support).
- [ ] Ensure skip-link + `main` landmark exist and are reachable on authenticated routes:
  - `/profile`, `/performance`, `/ai-studio`
- [ ] Add/confirm one page-level `<h1>` on AI Studio while preserving visible hierarchy and current visual intent.

### Acceptance criteria
- Keyboard navigation reaches and activates tabs, controls, and skip-links on all targeted routes.
- No control presents button semantics without functional activation path.
- AI Studio has a coherent heading structure for assistive tech.

### Validation
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- Route-level manual keyboard pass (Tab, Shift+Tab, Enter, Space, Escape).

## Pass D: Navigation trust and modularization kickoff

Tickets: `UX3-01`, `UX3-02`, `UX3-03`, `UX3-04`, kickoff of `UX5-01`

### To-do checklist
- [ ] Resolve dashboard dead-end CTA flows with explicit destination behavior and return path.
- [ ] Align Performance route intent between live and placeholder entries.
- [ ] Standardize "coming soon" copy + CTA pattern.
- [ ] Audit dashboard cards for consistency: title, description, CTA text, destination state.
- [ ] Start modularization split for one high-churn surface (recommended first target: `frontend/pages/media-library.tsx`).

### Acceptance criteria
- No primary dashboard CTA ends in ambiguous/no-next-action state.
- Performance entry points communicate one coherent status.
- First modularization slice lands with behavior parity and test evidence.

### Validation
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- `cd frontend && npm run build`

## Evidence pack requirements per pass
- Before/after screenshots for touched route(s) at `1440/1024/768/390`.
- Short keyboard QA notes (what was tested, what passed/failed).
- File-level mapping of ticket IDs -> changed paths.
- Any deferred items listed explicitly with blocker and next owner action.

## Suggested execution rhythm
- Daily start: pick one pass sub-slice and predefine acceptance checks before coding.
- Daily close: update `mvp-ui-ux-issue-board.md` statuses and evidence links.
- End of each pass: run docs parity and update this plan/issue board to reflect actual state.

## Command checklist
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- `cd frontend && npm run build`
- `cd frontend && npm run docs:check`

## Documentation update contract
When tickets close, update:
- `docs/planning/mvp-ui-ux-issue-board.md` (status + evidence)
- `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md` (checklist and tracking grid)
- `docs/change_log.md` (date-stamped milestone)

## Out-of-scope reminders
- Do not reopen paused Stripe/subscription workflow tasks in this pass window.
- Do not mix new feature work into these remediation PRs.
- Keep diffs scoped to one pass sub-slice where possible.
