# 2026-06-19 Mutating Internal Route Runtime Guard

- Lane: Copperknot rows 8/15 `Security and ownership boundaries` plus `Admin and launch operations`, clean internal-route runtime verifier seam.
- Skipped higher rows: recovery/media/storage/create/shell/provider rows remain handed off, production-gated, UI/UX-gated, or dirty-owner gated; this pass stayed in local launch-ops tooling.
- Touched: `scripts/verify_internal_route_runtime.mjs`; `frontend/tests/scripts/internal-route-runtime.test.mjs`; `docs/deployment.md`.
- Change: default internal-route runtime sweeps now skip authenticated probes for mutating billing renewals unless the operator explicitly runs `--route billing_renewals --allow-mutating-auth`.
- Validation: `npm -C frontend test -- --run tests/scripts/internal-route-runtime.test.mjs`, `node scripts/verify_internal_route_runtime.mjs --help`, `npm -C frontend run docs:check`, and path-bounded `git diff --check` passed.
- Boundary: no production probes and no billing mutation were run; explicit authenticated billing-renewal runtime proof remains approval-gated.
