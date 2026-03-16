---
title: MVP UI/UX Stabilization And Remediation Plan
status: Active
owner: Product + Design + Frontend Engineering
created: 2026-02-14
last_updated: 2026-02-14
---

# MVP UI/UX Stabilization And Remediation Plan

Purpose: execute a dedicated UI/UX remediation pass for the MVP without mixing scope with security/backend hardening work tracked in other plans.

## Audit Inputs Covered
This plan includes all findings from the repo-wide UI/UX audit and follow-up delta pass completed on 2026-02-14.

Execution artifacts created for this plan:
- Ticket breakdown: `docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md`
- Issue board with owner assignments: `docs/planning/mvp-ui-ux-issue-board.md`
- UX-0 QA checklist: `docs/planning/mvp-ui-ux-phase0-baseline-qa-checklist.md`
- UX-0 baseline capture template: `docs/planning/mvp-ui-ux-phase0-baseline-capture-template.md`
- UX-0 full baseline report: `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md`

Primary finding groups covered:
- Responsive layout failures (viewport lock, `max-device-width` breakpoints, fixed/overflow shell constraints).
- Accessibility/interaction issues (modal keyboard behavior, heading structure, tabs semantics, live-region semantics, skip-link coverage).
- UX trust and navigation clarity issues (dead-end routes, inconsistent coming-soon behavior, non-functional affordances).
- Design consistency drift (dual button systems, plan label mismatch, token faults, style-governance drift).
- Maintainability risks impacting UX velocity (oversized UI/CSS files, fragmented AI Studio styling).
- Tooling signal quality problems (`lint` noise from generated Playwright artifacts).

## Scope Lock
In scope:
- UI/UX and accessibility remediation across authenticated pages and core workflows.
- CSS architecture consistency and responsive behavior fixes.
- Route/copy corrections where current UX funnels users into dead ends.
- Supporting docs/process updates needed to keep UX quality durable.

Out of scope:
- New product features.
- Backend security work already tracked elsewhere.
- Net-new visual redesign not required to fix current UX defects.
- Stripe/subscription pipeline implementation and billing cancellation/downgrade UX validation (temporarily paused for this pass).

## Temporary Pause Note (2026-02-14)
- Effective immediately, Stripe/subscription pipeline work is paused and moved out of active UI/UX stabilization scope.
- Profile subscription cancel/downgrade modal validation is deferred until this pause is lifted.
- Active UI/UX execution continues on non-Stripe surfaces and issues.

## Release Gate For This Track
All `P0` items in this document must be complete before the next external pre-tester wave.

## Workstreams

### Phase UX-0 (P0): Baseline Freeze And QA Harness
Goal: establish a measurable before/after baseline for UX remediation.

Checklist:
- [x] Capture baseline screenshots at `1440px`, `1024px`, `768px`, and `390px` widths for: Dashboard, AI Studio, Media Library, Profile, Performance.
- [x] Record baseline keyboard pass for active core flows: login -> dashboard -> AI Studio generate -> media preview modal -> profile (non-subscription surfaces).
- [x] Create an issue checklist board mapping each finding in this plan to one trackable ticket.
- [x] Confirm acceptance criteria ownership (Design sign-off + Engineering sign-off) for each `P0` item.

Current assignment and execution board:
- `docs/planning/mvp-ui-ux-issue-board.md` is the active board of record for status, owner assignments, and acceptance evidence.
- Current baseline evidence: `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md`.
- Keyboard pass status: active-scope paths are complete; subscription cancel/downgrade modal path is deferred under the temporary Stripe/subscription pause.

Exit criteria:
- Baseline artifacts exist and are attached to the sprint workspace.
- Every `P0` item has a clear owner and validation method.

### Phase UX-1 (P0): Responsive Foundation And Layout Integrity
Goal: remove layout primitives that block responsive behavior and viewport adaptation.

Checklist:
- [x] Remove hard viewport lock behavior and replace with responsive layout primitives.
  Evidence paths: `frontend/pages/_app.tsx`, `frontend/styles/viewport-lock.css`
- [ ] Replace `max-device-width` media queries with `max-width`/container-responsive rules and validate on desktop resize.
  Evidence paths: `frontend/styles/ai-studio-responsive.css`, `frontend/styles/workspace-media.css`, `frontend/styles/character-manager.css`, `frontend/styles/landing-sections.css`
- [ ] Refactor AI Studio shell to avoid fixed-height + hidden-overflow trapping of content.
  Evidence paths: `frontend/styles/ai-studio-layout.css`
- [ ] Preserve left rail/header behavior without sacrificing main content scrolling on small and medium screens.
- [ ] Add regression checks for orientation changes and browser zoom at `125%` and `200%`.

Exit criteria:
- Pages reflow correctly on window resize and orientation changes.
- No major content clipping or inaccessible regions caused by fixed shell constraints.

### Phase UX-2 (P0): Accessibility And Interaction Semantics
Goal: standardize core interaction patterns and remove accessibility blockers.

Checklist:
- [ ] Standardize modal behavior: Escape closes, focus enters modal on open, focus returns to trigger on close, backdrop clicks are intentional.
  Evidence paths: `frontend/pages/dashboard.tsx`, `frontend/pages/profile.tsx`, `frontend/pages/media-library.tsx`, `frontend/pages/performance.tsx`, `frontend/features/ai-studio/components/DetailModal.tsx`, `frontend/features/ai-studio/components/ModelModal.tsx`, `frontend/features/performance/components/VideoDetailModal.tsx`
- [ ] Ensure nested confirmation overlays are real dialogs (`role="dialog"`, `aria-modal="true"`, labeled title/description).
  Evidence path: `frontend/features/ai-studio/components/DetailModal.tsx`
- [ ] Fix Media Library tab semantics (`role="tab"`, `aria-selected`, controlled panel mapping).
  Evidence path: `frontend/pages/media-library.tsx`
- [ ] Remove or implement non-functional interactive affordances (`role="button"`/pointer cursor elements must have working actions and keyboard support).
  Evidence paths: `frontend/pages/performance.tsx`, `frontend/features/saved-creators/components/SavedCreatorsHeader.tsx`, `frontend/styles/workspace-chrome.css`, `frontend/pages/dashboard.tsx`
- [ ] Add consistent skip-link and main landmark structure to authenticated routes that currently miss it.
  Evidence paths: `frontend/pages/profile.tsx`, `frontend/pages/performance.tsx`, `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- [ ] Add a page-level `<h1>` to AI Studio while preserving visual hierarchy.
  Evidence paths: `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- [ ] Resolve live-region semantic conflicts (`role="alert"` must align with assertive urgency; informational stacks should use status/polite patterns).
  Evidence path: `frontend/features/ai-studio/components/AiStudioPageContent.tsx`

Exit criteria:
- Keyboard-only navigation is complete for all core modals and tabs.
- Screen-reader landmarks/headings are coherent on major authenticated surfaces.
- No critical accessibility regressions in remediation scope.

### Phase UX-3 (P0): Navigation Clarity And Dead-End Removal
Goal: eliminate trust-breaking route behavior and align CTA intent with destination readiness.

Checklist:
- [ ] Resolve dashboard CTA dead ends for onboarding/workflow cards (either ship minimum content or route to a clearly scoped in-product placeholder with immediate next action).
  Evidence paths: `frontend/pages/dashboard.tsx`, `frontend/pages/onboarding.tsx`
- [ ] Align Performance entry points and route strategy so users do not bounce between “live” and “coming soon” inconsistently.
  Evidence paths: `frontend/pages/dashboard.tsx`, `frontend/pages/performance.tsx`, `docs/routes.md`
- [ ] Standardize “coming soon” patterns: copy tone, CTA behavior, and return paths.
- [ ] Review all top-level dashboard tool cards to ensure title, description, CTA text, and destination state are mutually consistent.

Exit criteria:
- No primary dashboard CTA leads to an ambiguous dead-end.
- Deferred features have a consistent placeholder contract and clear return path.

### Phase UX-4 (P1): Design System Consistency And Token Hygiene
Goal: reduce visual inconsistency and avoid style regressions caused by parallel systems.

Checklist:
- [ ] Choose one button system as canonical and migrate overlapping surfaces.
  Evidence paths: `frontend/styles/components-buttons.css`, `frontend/styles/ui-patterns.css`
- [ ] Normalize plan naming and palette to fixed product rule (`Free`, `Media`, `Studio`, `Business`).
  Evidence paths: `docs/dev-ground-rules.md`, `frontend/pages/performance.tsx`, `frontend/pages/saved-creators.tsx`, `frontend/pages/media-library.tsx`
- [x] Fix self-referential radius tokens and verify downstream consumers render correctly.
  Evidence path: `frontend/styles/foundation.css`
- [ ] Define a single source of truth for global interaction states (hover, focus-visible, disabled, loading).
- [ ] Add a migration log for any intentional token/value changes affecting multiple pages.

Exit criteria:
- One button language is used across core MVP routes.
- Plan labels and plan colors are consistent with documented rules.
- Token layer computes without invalid self references.

### Phase UX-5 (P1): CSS Architecture And Modularization For UX Velocity
Goal: reduce complexity that slows UI iteration and causes inconsistent behavior.

Checklist:
- [ ] Split oversized UI files and CSS sheets impacting frequent UX changes.
  Target paths: `frontend/pages/media-library.tsx`, `frontend/pages/ai-studio.tsx`, `frontend/styles/workspace-media.css`, `frontend/styles/character-manager.css`, `frontend/styles/ai-studio-layout.css`
- [ ] Set refactor targets for this pass: core UX files under `800` lines; new files under `500` lines unless documented.
- [ ] Use AI Studio style inventory findings to reduce token sprawl and duplicate style patterns.
  Evidence path: `docs/design/ai-studio-style-inventory.md`
- [x] Align documented style import order with actual `globals.css` order (or update docs if order is intentional).
  Evidence paths: `docs/styles-structure.md`, `frontend/styles/globals.css`

Exit criteria:
- High-churn UI files are decomposed by concern with behavior preserved.
- Style layering/import rules are explicit and accurate.

### Phase UX-6 (P0): Tooling Signals And Quality Gates
Goal: ensure UX/accessibility regressions are visible and blockable.

Checklist:
- [x] Exclude generated artifacts from ESLint scope (`playwright-report`, `test-results`) so lint output reflects source issues.
  Evidence path: `frontend/eslint.config.mjs`
- [x] Re-enable strict lint gate behavior in CI if temporarily softened.
  Evidence path: `.github/workflows/ci.yml`
- [x] Add an accessibility-focused checklist to PR template for UI-touching changes.
  Evidence path: `.github/pull_request_template.md`
- [x] Require a before/after screenshot set for P0 UX fixes touching layout or navigation behavior.
  Evidence path: `.github/pull_request_template.md`

Exit criteria:
- Lint output is actionable and low-noise.
- CI blocks merges on real source regressions.

### Phase UX-7 (P1): Documentation And Decision Capture
Goal: prevent UX regressions by documenting the new standards.

Checklist:
- [ ] Update architecture/style docs to reflect new responsive, modal, and interaction conventions.
  Evidence paths: `docs/frontend-architecture.md`, `docs/styles-structure.md`, `docs/conventions.md`
- [ ] Add/update SOP guidance for modal accessibility and “coming soon” route policy if adopted.
  Evidence path: `docs/sops/README.md`
- [ ] If modal contract or responsive strategy changes materially, add an ADR under `docs/adr/`.
- [ ] Log completion milestones and deviations in `docs/change_log.md`.

Exit criteria:
- Core documentation reflects implemented UX standards.
- Future contributors can follow one clear pattern set.

## Verification Protocol

Engineering checks:
- `cd frontend && npm run lint`
- `cd frontend && npm run type-check`
- `cd frontend && npm run build`

Accessibility checks:
- Keyboard-only pass for all major modals and tab interfaces.
- Screen-reader landmark/headings pass for Dashboard, AI Studio, Media Library, Profile, and Performance.
- Focus-visible pass for all primary interactive controls.

Responsive checks:
- Manual resize and device-width coverage at `1440`, `1024`, `768`, `390`.
- Browser zoom checks at `125%` and `200%`.
- Orientation check on mobile widths.

UX flow checks:
- Dashboard CTA journeys do not terminate in ambiguous placeholders.
- AI Studio generation and media inspection flows remain functional after layout/accessibility remediations.
- Profile route interactions remain reachable and dismissible across input methods (subscription billing modal path deferred while Stripe/subscription scope is paused).

## Task Tracking Grid
- `P0` baseline and QA harness: `Complete` (active-scope baseline + keyboard pass complete; Stripe/subscription keyboard path explicitly deferred)
- `P0` responsive foundation: `In Progress` (`UX1-01` complete, responsive breakpoint conversion + shell overflow fixes pending)
- `P0` accessibility and semantics: `Not Started`
- `P0` navigation/dead-end removal: `Not Started`
- `P0` tooling signal cleanup: `Complete` (`UX6-01` through `UX6-04` complete)
- `P1` design-system consistency: `In Progress` (`UX4-03` complete; remaining design-system consistency tickets pending)
- `P1` modularization/CSS architecture: `In Progress` (`UX5-04` complete; remaining modularization/style inventory tickets pending)
- `P1` documentation and ADR capture: `Not Started`

## Sign-Off Criteria For This Track
- All `P0` workstreams complete and verified.
- No unresolved critical UI accessibility issues in core MVP routes.
- Dashboard primary journeys have no dead-end trust breaks.
- Lint/CI signals are clean enough to catch future UX regressions reliably.

## Change Log
- 2026-02-14: Initial standalone UI/UX stabilization and remediation plan created from repo-wide design audit + follow-up delta findings.
- 2026-02-14: Added sprint ticket breakdown and Phase UX-0 baseline QA templates; moved UX-0 status to In Progress.
- 2026-02-14: Added owner-assigned UI/UX issue board and completed UX-0 checklist items for board mapping and ownership confirmation.
- 2026-02-14: Captured first UX-0 baseline evidence set for `/dashboard` and `/ai-studio` across target widths and logged a filled partial report.
- 2026-02-14: Completed full 5-route UX-0 baseline screenshot matrix and added first-pass keyboard baseline evidence report with blockers.
- 2026-02-14: Updated keyboard baseline evidence after seeded media run; documented Media Library modal Escape-close failure signal and narrowed remaining blocker to profile subscription account state.
- 2026-02-14: Added temporary Stripe/subscription pause note; deferred subscription modal validation and marked UX-0 complete for active non-Stripe scope.
- 2026-02-14: Completed `UX1-01` by removing JS-set fixed viewport variables in `_app.tsx` and replacing CSS width lock constraints in `viewport-lock.css`; reran baseline capture + keyboard scripts, confirmed no new execution failures, and logged that residual mobile overflow persists for follow-on `UX1-02`.
- 2026-02-14: Synced UX-6 status with completed reliability hardening by marking `UX6-01` (lint artifact exclusions) and `UX6-02` (strict CI lint gate) complete.
- 2026-02-14: Completed `UX6-03` and `UX6-04` by expanding `.github/pull_request_template.md` with a UI accessibility checklist and explicit before/after screenshot requirement for `P0` layout/navigation fixes.
