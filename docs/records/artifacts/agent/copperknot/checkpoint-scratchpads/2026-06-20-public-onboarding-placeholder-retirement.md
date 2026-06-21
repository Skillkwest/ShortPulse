# 2026-06-20 Public Onboarding Placeholder Retirement

Touched:

- `frontend/pages/onboarding.tsx`
- `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx`
- `frontend/tests/pages/dashboard.actions.test.tsx`
- `scripts/verify_deployment_route_parity.mjs`
- `frontend/tests/scripts/deployment-route-parity.test.mjs`
- `README.md`
- `docs/routes.md`
- Copperknot queue/board docs

Change:

- Retired the public `/onboarding` Coming soon route instead of proving an unfinished customer-facing page.
- Kept the hidden dashboard legacy-section flag on canonical New Project/Open Projects actions instead of stale onboarding links.
- Added `/onboarding` to default deployment forbidden routes.

Validation:

- `npm -C frontend test -- --run tests/pages/dashboard.actions.test.tsx tests/scripts/deployment-route-parity.test.mjs`
- `npm -C frontend run type-check:touched`
- `cd frontend && npx eslint tests/scripts/deployment-route-parity.test.mjs features/dashboard/components/AuthenticatedDashboardView.tsx tests/pages/dashboard.actions.test.tsx`
- `npm -C frontend run docs:check`
- `node --check scripts/verify_deployment_route_parity.mjs`
- `git diff --check`

Boundary:

- Local source hardened only. Do not claim deployed route absence until after deploy and strict route parity rerun.
