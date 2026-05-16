# D-Bug Handoff: public-home-dashboard-title-mismatch

### Source

- Source agent: Beeper
- Source task: production logout sign in lane
- Date: 2026-05-15

### Failing surface

- Route, component, script, command, or subsystem: production public home page metadata after logout and in clean guest mode
- Environment: production
- User-visible symptom: the guest route at `/` reports the document title `ShortPulse · Dashboard`
- Exact error text or signature: no runtime error; browser tab title remains dashboard-labeled in signed-out guest mode

### Why this is a D-Bug lane

- Why the source agent stopped: the main logout workflow is valid, but this metadata mismatch is a real user-facing issue that should not stay trapped in Beeper-only notes.
- Why this should be treated as debugging instead of feature work: likely a route-title or guest/auth-view metadata mismatch rather than a broader product redesign problem.

### Current evidence

- Reproduction steps:
  1. Visit `https://www.shortpulse.ai/` in a clean unsigned browser session.
  2. Or sign in, open `Profile menu`, click `Log out`, confirm, and wait for the signed-out landing.
  3. Observe the browser tab title.
- Expected behavior:
  - guest landing page should use guest/home metadata, not dashboard metadata
- Actual behavior:
  - browser title is `ShortPulse · Dashboard` on `https://www.shortpulse.ai/`
- Logs, stack traces, screenshots, or file references:
  - Beeper retained report: `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-logout-signin-lane.md`
  - Beeper full workflow report: `beeper/reports/2026-05-15-production-logout-signin-lane.md`
  - Evidence screenshot: `logout-signin-04-home-after-logout.png`
- Frequency: reproduced after logout and in a clean unsigned browser session

### Scope control

- Owned write surface: public-home/dashboard metadata lane only
- Avoid surface: logout flow itself, auth routing, AI Studio, dashboard CTA semantics
- In scope:
  - explain why guest mode still emits dashboard metadata
  - identify the smallest fix
  - add or update the smallest useful test
- Out of scope:
  - guest dashboard redesign
  - broader SEO/meta overhaul
  - branch/push/commit execution

### Attempts already made

1. Verified the full logout -> sign-back-in workflow in production.
2. Noticed the guest home title after logout.
3. Rechecked the title on a clean unsigned visit to `/`.
4. Searched for the shared dashboard title source and guest/dashboard route wiring.

### Current hypotheses

1. `frontend/pages/dashboard.tsx` serves both guest and authenticated views but always emits the same `<title>`.
2. Guest mode may need conditional metadata based on auth state or route intent.
3. Existing logout tests cover the flow but do not assert guest metadata after sign-out.

### Required context

Read first:

- `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-logout-signin-lane.md`
- `beeper/reports/2026-05-15-production-logout-signin-lane.md`

Inspect first:

- `frontend/pages/dashboard.tsx` around `522`
- `frontend/tests/pages/dashboard.actions.test.tsx` around `255`
- `frontend/tests/pages/dashboard.guest-route.test.tsx`

### Questions for D-Bug

1. Is the shared dashboard title intentional for guest mode, or just an unscoped metadata carryover?
2. What is the smallest fix that gives guest mode a correct title without disturbing the authenticated dashboard title?
3. Which guest/dashboard test should assert this so it does not regress?

### Expected output

- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution if D-Bug produces the patch

### Suggested validation

- open `/` unsigned and confirm title changes away from `ShortPulse · Dashboard`
- run the smallest dashboard guest/logout test covering metadata if added

### Suggested stop condition

- Stop when the guest route title is explained and the smallest credible fix path is identified.

### Done state

- D-Bug can explain why guest home mode is still using dashboard metadata and can point to the smallest fix or test addition.
