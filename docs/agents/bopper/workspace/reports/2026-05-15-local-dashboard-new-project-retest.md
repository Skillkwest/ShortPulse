# Bopper Report - 2026-05-15 - dashboard-new-project-retest

Purpose: public-entry paid-user expectation check for `New Project`, with the run falling back from the original signed-in retest plan when the visible route opened on the public dashboard.

## Task

- Requested work: Bopper retest of dashboard `New Project` path, fallback to auth to dashboard if signed-in path is unavailable
- Environment: local
- Base URL: http://localhost:3000
- Interaction fidelity: `mixed` because the visible-entry clicks were realistic, but the login recovery used a direct route follow after the public page made the next action obvious
- Persona lens: returning paid `Studio` customer trying to get into real work quickly

## Naive-User Path

- Entry route: public dashboard at `/`
- First click: `New Project`
- Next obvious action: `Log in`
- Why those clicks looked right:
  - `New Project` is the clearest work-starting CTA and literally says `Open the AI Studio`
  - once pricing appears, `Log in` is the obvious move for a paying returning user
- What Bopper expected:
  - first click should move toward a real creation surface, not a pricing detour
  - login should be the final gate before reaching the signed-in workspace
- What Bopper ignored:
  - `Explore pricing`
  - offer cards
  - `Sign up`

## Findings

### Blockers

- No product blocker was proven in this lane.
- The run stopped at a believable credential boundary because this browser session did not have a saved paid test identity.

### Functional Issues

- None proven.

### UI / UX Notes

- Public `New Project` expectation mismatch.
  - The CTA sounds like direct workspace entry.
  - Actual behavior routes to `/pricing?intent=create-project`.
  - For a returning paid user, that feels like a pricing detour rather than progress toward work.
- The unified public dashboard / landing / workspace-entry surface is semantically muddy for returning customers.
  - Bopper started from a page that looks like a home/work entry surface.
  - The path still behaved like acquisition before it behaved like workspace access.
- The auth screen itself is relatively clear once reached.
  - `Welcome back`, email/password, and the selected `Sign in` tab make the next step understandable.

## ICP Judgments

- Did the UI feel intuitive?: no overall; the first promise was misleading even though the auth page was straightforward.
- What was Bopper struggling with?: understanding whether `New Project` is a real workspace action or an upsell route.
- Did Bopper know what to do next without admin help?: yes after pricing appeared, but only because `Log in` was obvious.
- Did this feel risky from a credit perspective?: medium; hitting pricing after a workspace CTA makes the route feel commercially unsafe.
- Did this feel worth what he pays for Studio?: no; it felt like extra funnel work before any real creation surface.
- Did this feel like too much work for the expected payoff?: yes for a returning paid user.

## Evidence

- Run brief: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/run-brief.md`
- Click log: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/click-log.md`
- Decision log: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/decision-log.md`
- Screenshots:
  - `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/evidence/auth-gate.png`
- Runtime signals: none
- Code/doc surfaces:
  - `frontend/features/dashboard/components/GuestDashboardView.tsx`
  - `frontend/tests/pages/dashboard.guest-route.test.tsx`
  - `docs/routes.md`
  - `docs/sops/sop_ai_studio_projects_foundation.md`
