# Bopper Run Report - 2026-05-15 - dashboard-new-project-retest

Purpose: public-entry expectation audit for a paying `Studio` user who tries to start work from the public dashboard and follows the most obvious route.

## Task

- Requested work: Bopper retest of dashboard `New Project` path, fallback to auth to dashboard if signed-in path is unavailable
- Environment: local
- Base URL: http://localhost:3000
- Runtime project ref: none
- Audit user: public / no saved paid identity in this browser session
- Trainer directives consulted:
  - root `AGENTS.md`
  - `docs/agents/bopper/README.md`
  - `docs/agents/bopper/memory.md`
  - `docs/agents/bopper/standard-operating-procedure.md`
  - `docs/records/artifacts/agent/bopper/trainer-directives-log.md`
- Tools used:
  - local Next.js dev server via `npm run dev`
  - in-app browser via Browser skill and Node REPL runtime
  - targeted repo inspection with `rg` / `sed`
- Persona lens: returning paid `Studio` customer with low patience for confusing AI workflow entry
- Business intent: get back into the product and start content work, not shop plans again

## Scope

- Routes covered: `/`, `/pricing?intent=create-project`, `/auth?next=%2Fdashboard`
- Interaction fidelity: `mixed`
- Primary naive-user journey: public dashboard -> `New Project` -> pricing detour -> `Log in` -> auth gate
- What was intentionally skipped:
  - fake credential entry
  - hidden direct AI Studio routes
  - plan-card clicks that would be implausible for a user who already believes he pays for `Studio`
- Route success target: a returning paid user should understand how to move from public entry back into real work without acquisition-style ambiguity
- Retest-debt item: the older signed-in dashboard `New Project` dead end remains open and was not revalidated here because this browser session did not begin signed in
- Lane choice rationale: started from the top queue retest plan, then honestly followed the visible public-entry fallback when the actual app state was unauthenticated
- ICP pressure points in scope:
  - workspace-entry trust
  - support dependence
  - pricing/credit anxiety
  - low-effort bias

## Action Log

| Step | Surface | Action | Why Bopper clicked it | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/` public dashboard | Clicked `New Project` | Largest work-starting CTA, and the helper text literally promises `Open the AI Studio` | Move toward creation or the studio | Landed on `/pricing?intent=create-project` | `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/evidence/observed-path.txt` |
| 2 | `/pricing?intent=create-project` | Followed `Log in` | He already pays for `Studio`, so logging in is the obvious recovery path | Reach auth and continue toward the workspace | Landed on `/auth?next=%2Fdashboard` | `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/evidence/auth-gate.png` |

## Findings

### Blockers

- No product blocker was proven in this lane.
- The run stopped at a real credential boundary because no saved paid test identity was available in this browser session.

### Functional Issues

- None proven.

### UI / UX Notes

- Public `New Project` behaves like a pricing CTA while sounding like a workspace CTA.
  - That is likely confusing for returning paid users.
- The unified public dashboard surface blurs acquisition and workspace-entry intent.
  - A paying customer can feel routed back into sales before they get back to work.
- Auth is clearer than the public entry surface.
  - Once Bopper reached auth, the next step was obvious.

## Average-User Lens

- first click: `New Project`
- next obvious click: `Log in`
- what Bopper expected: a fast path back into creation, or at least a clearly signposted route into his paid workspace
- what actually happened: `New Project` led to pricing first, then auth
- what Bopper ignored: `Explore pricing`, offer cards, `Sign up`
- what Bopper misunderstood: he took `Open the AI Studio` literally and assumed the route would behave like workspace entry
- abandonment point: auth credential gate after the unexpected pricing detour

## ICP Judgments

- Did the UI feel intuitive?: no overall
- What was Bopper struggling with?: understanding why a work-starting CTA sent him into pricing
- Did Bopper know what to do next without admin help?: yes after pricing appeared
- Did this feel risky from a credit perspective?: medium
- Did this feel worth what he pays for `Studio`?: no
- Did this feel like too much work for the expected payoff?: yes
- What conclusion would Bopper likely make about ShortPulse after this run?: `I can probably get in eventually, but the product is making me fight through sales and login before I can do any real work.`

## Code Follow-Up

- Probable code surfaces:
  - `frontend/features/dashboard/components/GuestDashboardView.tsx`
  - `frontend/tests/pages/dashboard.guest-route.test.tsx`
  - `frontend/tests/pages/pricing.route-behavior.test.tsx`
- Supporting docs or tests inspected:
  - `README.md`
  - `docs/routes.md`
  - `docs/sops/sop_ai_studio_projects_foundation.md`
- What another agent should inspect first:
  - whether the guest `New Project` CTA wording should change if pricing is the intended destination
  - whether a returning paid user needs a clearer public entry path to sign in and resume work

## Evidence Packet

- JSON packet: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/packet.json`
- Evidence manifest: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/evidence/README.md`
- Run brief: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/run-brief.md`
- Click log: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/click-log.md`
- Decision log: `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/decision-log.md`
- Screenshots:
  - `docs/agents/bopper/workspace/runs/2026-05-15-202334-dashboard-new-project-retest/evidence/auth-gate.png`
- Console / runtime signals: none
- Local code references:
  - `frontend/features/dashboard/components/GuestDashboardView.tsx`
  - `frontend/tests/pages/dashboard.guest-route.test.tsx`

## Self Audit

- Score out of 10: 8.8
- Confidence tag: `medium`
- Hard gate triggered: none
- Score breakdown:
  - fidelity `1.5 / 2.0`
  - coverage `1.5 / 1.5`
  - evidence `2.0 / 2.0`
  - confusion `1.5 / 1.5`
  - handoff usefulness `0.8 / 1.5`
  - logging `1.0 / 1.0`
  - ops `0.5 / 0.5`
- What felt strong: believable public-entry clicks, clear ICP judgment, self-contained evidence packet
- What slipped: the run could not complete the auth-to-dashboard leg because no saved paid identity was available
- Weakest category: issue / handoff usefulness
- Next-run drill: use a saved paid test identity to complete the auth -> dashboard leg from the same public-entry path
- ROI gained: expanded Bopper beyond the signed-in dashboard lane and captured a distinct expectation-mismatch pattern on the public route

## Training Record

- Memory / training-history update needed?: yes; this run established a reusable public-entry trust pattern for paying-user personas
- Coverage update needed?: yes; auth and public-entry route knowledge improved
- Retest-debt update needed?: no; the signed-in dashboard dead-end retest is still open
