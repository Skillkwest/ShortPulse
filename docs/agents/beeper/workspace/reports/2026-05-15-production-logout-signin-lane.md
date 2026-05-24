# Production Logout Sign-In Lane

## What I Tried

- opened the signed-in production dashboard
- used the visible `Profile menu`
- clicked `Log out`
- confirmed the logout dialog
- followed the signed-out landing page
- used the visible `Log in` entry point
- signed back in and confirmed the dashboard return

## What Worked

- the profile menu opened cleanly
- logout is a real two-step confirmed flow, not a dead button
- the auth token cleared after confirmed logout
- the signed-out landing was the public home page
- the visible `Log in` link sent the user to `/auth?next=%2Fdashboard`
- sign-back-in returned to `/dashboard`

## What Did Not Work

- no core failure in this lane

## Real User Read

- the logout flow is believable and safety-conscious because it confirms intent before signing out
- the public-home re-entry path also feels natural because `Log in` is visible immediately after logout

## Friction And Notes

- my first read was wrong because I stopped after the first `Log out` click instead of honoring the confirmation dialog; I corrected the run and did not keep that false read as the final result
- there is still a real low-severity metadata issue: after logout, the guest home page at `/` reports the title `ShortPulse · Dashboard`

## Why The Metadata Issue Matters

- browser tabs, history, and user orientation still imply “Dashboard” even though the user is signed out
- it weakens trust and can make the guest route feel like a stale authenticated shell

## Code Follow-Up

- likely title source:
  - `frontend/pages/dashboard.tsx:522`
- supporting test surface:
  - `frontend/tests/pages/dashboard.actions.test.tsx:255`

## Evidence

- packet:
  - `docs/agents/beeper/workspace/runs/2026-05-15-143100-prod-logout-signin-lane/evidence/logout-signin-summary.json`
- screenshots:
  - `logout-signin-01-dashboard.png`
  - `logout-signin-02-profile-menu.png`
  - `logout-signin-03-logout-dialog.png`
  - `logout-signin-04-home-after-logout.png`
  - `logout-signin-05-auth-entry.png`
  - `logout-signin-06-dashboard-after-signin.png`

## Result

- the logout -> sign-back-in loop is now validated
- no D-Bug handoff is needed for logout itself
- a separate low-severity D-Bug handoff is warranted for the signed-out home-page title mismatch
