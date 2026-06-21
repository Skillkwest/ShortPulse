# 2026-06-20 Quality Experience Public Offer Copy

Lane: P16 Quality of experience, public dashboard/header polish.

Touched:

- `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`
- `frontend/lib/dashboardOfferPublicCopy.ts`
- `frontend/lib/server/api/dashboardOffers.ts`
- `frontend/tests/api/admin-offers.test.ts`
- `frontend/tests/pages/dashboard.guest-route.test.tsx`
- `frontend/pages/_app.tsx`
- `frontend/features/compliance/routes/ProtectedRouteBootstrapGate.tsx`
- `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`
- `frontend/tests/pages/protected-route-bootstrap-gate.test.tsx`
- `frontend/tests/pages/app.ai-studio-gates.test.tsx`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`

Change:

- Production `/` and anonymous `/dashboard` currently show unfinished active dashboard-offer copy: `tsting teseting`.
- Added a public dashboard header-card eligibility guard that suppresses obvious placeholder/test offer copy while keeping the next valid offer visible.
- Added focused regression coverage for hiding placeholder offer cards without hiding valid public offer cards.
- Moved the placeholder/test public-copy check into a shared helper and reused it in the admin offer save path.
- Active dashboard offers with placeholder/test header copy are now rejected before save; inactive drafts can still be saved.
- Production `/ai-studio`, `/profile`, `/report-issue`, and `/admin` also server-render protected-entry loading states with empty document titles.
- Added document titles to the generic protected-route bootstrap loader and AI Studio pre-runtime/project-entry loader without changing the visible loading UI or route behavior.
- Recorded the issue as local source hardening only; production still needs deploy/content-cleanup confirmation.

Validation:

- `npm -C frontend test -- --run tests/pages/dashboard.guest-route.test.tsx tests/pages/index.route-behavior.test.tsx`: pass, `2` files / `15` tests.
- `npm -C frontend test -- --run tests/pages/protected-route-bootstrap-gate.test.tsx tests/pages/app.ai-studio-gates.test.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/index.route-behavior.test.tsx`: pass, `4` files / `29` tests.
- `npm -C frontend test -- --run tests/api/admin-offers.test.ts tests/pages/dashboard.guest-route.test.tsx`: pass, `2` files / `20` tests.
- `npm -C frontend run type-check:touched`: pass for `9` touched frontend TS paths; repo-wide type-check still has unrelated diagnostics.
- `npm -C frontend run type-check:touched`: pass for `12` touched frontend TS paths; repo-wide type-check still has unrelated diagnostics.
- `cd frontend && npx eslint features/dashboard/routes/PublicDashboardRoute.tsx tests/pages/dashboard.guest-route.test.tsx`: pass.
- `cd frontend && npx eslint pages/_app.tsx features/compliance/routes/ProtectedRouteBootstrapGate.tsx features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx tests/pages/protected-route-bootstrap-gate.test.tsx tests/pages/app.ai-studio-gates.test.tsx features/dashboard/routes/PublicDashboardRoute.tsx tests/pages/dashboard.guest-route.test.tsx`: pass.
- `cd frontend && npx eslint lib/dashboardOfferPublicCopy.ts lib/server/api/dashboardOffers.ts features/dashboard/routes/PublicDashboardRoute.tsx tests/api/admin-offers.test.ts tests/pages/dashboard.guest-route.test.tsx pages/_app.tsx features/compliance/routes/ProtectedRouteBootstrapGate.tsx features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx tests/pages/protected-route-bootstrap-gate.test.tsx tests/pages/app.ai-studio-gates.test.tsx features/ai-studio/logic/stylesLibraryCatalog.ts features/ai-studio/logic/__tests__/stylesLibraryCatalog.test.ts`: pass.
- `npm -C frontend run docs:check`: pass.
- `git diff --check`: pass.
