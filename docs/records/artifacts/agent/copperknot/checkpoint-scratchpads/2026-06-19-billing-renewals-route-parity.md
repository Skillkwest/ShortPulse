# 2026-06-19 Billing Renewals Route Parity

- Lane: Copperknot row 15 `Admin and launch operations`, default deployment route-surface gate.
- Skipped higher rows: recovery/media/storage/create/shell/provider rows are handed off, production-gated, UI/UX-gated, or overlap dirty active worktree ownership; Video is Gutan; Sound and account-trust already received bounded local guards.
- Touched: `scripts/verify_deployment_route_parity.mjs`; `frontend/tests/scripts/deployment-route-parity.test.mjs`; `scripts/check_operator_map_drift.js`; `docs/deployment.md`; `docs/troubleshooting.md`.
- Change: added `/api/internal/billing-contract-renewals/run` to the default required deployment route parity set and matching operator-map/docs route lists.
- Validation: `npm -C frontend test -- --run tests/scripts/deployment-route-parity.test.mjs`, `node scripts/check_operator_map_drift.js`, `npm -C frontend run docs:check`, and path-bounded `git diff --check` passed.
- Boundary: local launch-ops gate hardening only; production route parity must be rerun after deploy to prove the active alias includes the new required route.
