# Project owner-boundary invariants - 2026-06-17

- Lane: Security and ownership boundaries / Projects and workspace restore seam.
- Touched: `frontend/tests/api/projects-create.test.ts`, `frontend/lib/server/__tests__/projectsService.test.ts`, Copperknot launch board, queue, launch fitness scorecard.
- Change: added focused local coverage that project service list/read/update/delete queries include caller `user_id`; project workspace preview enrichment and project output display preview enrichment stay caller-scoped; not-owned project item `GET`, `PATCH`, and `DELETE` route requests return `404` before project exposure; and workspace `GET`, `PUT`, and `DELETE` route requests return `404` before workspace read/save/reset state access.
- Validation: `npm -C frontend run test -- --run lib/server/__tests__/projectsService.test.ts tests/api/projects-create.test.ts` passed at `53` tests; `npm -C frontend run type-check:touched` passed; production route parity passed for `https://www.shortpulse.ai` with `175` route entries and forbidden `/api/legacy/fallback-route`; protected internal route runtime checks passed unauthenticated fail-closed; `node scripts/check_secret_exposure.js` passed.
- Boundary: local invariant only; authenticated production owner-boundary proof remains open.
