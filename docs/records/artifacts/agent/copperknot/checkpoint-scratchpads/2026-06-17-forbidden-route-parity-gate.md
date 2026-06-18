# 2026-06-17 Forbidden Route Parity Gate

## Touched

- `scripts/verify_deployment_route_parity.mjs`
- `frontend/tests/scripts/deployment-route-parity.test.mjs`
- `docs/deployment.md`

## What changed

- Added optional `--forbidden-route <path>` support to the deployment route parity verifier.
- The verifier now reports forbidden routes and fails if a deployment exposes one.
- Deployment docs now show the forbidden-route check for retired fallback/legacy/backup routes.
- Follow-up hardening: the verifier now enforces the current retired-route list by default:
  - `/landing`
  - `/creator-studio`
  - `/api/upload-image`
  - `/api/upload-video`
  - `/api/upload-audio`
  - `/api/ai/sessions`
  - `/api/media/admit-image-asset`
- Added `--ignore-default-forbidden-routes` only for explicitly inspecting older deployments as stale/deploy-boundary baselines.
- Made the verifier import-safe and added focused test coverage for default forbidden routes, additive custom forbidden routes, bypass behavior, normalization, and Vercel function path matching.

## Proof

- Earlier optional-flag validation showed the verifier can pass when a fake retired route is absent and fail when an existing internal route is marked forbidden.
- Default retired-route enforcement still needs a post-deploy run after the local route-retirement work is deployed; pre-deploy production may correctly fail if it still exposes locally retired routes.
- `node scripts/verify_deployment_route_parity.mjs --help` shows the default forbidden route list and `--ignore-default-forbidden-routes`.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai --ignore-default-forbidden-routes` passed against deployment `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app`.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` failed against that same deployment because it still exposes:
  - `/api/upload-video`
  - `/api/upload-audio`
  - `/api/media/admit-image-asset`
- Fresh post-deploy refresh still resolves `https://www.shortpulse.ai` to deployment `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app` created `2026-06-17T15:33:16.081Z`; strict parity still fails for the same three exposed retired routes.
- `npm -C frontend run test -- --run tests/scripts/deployment-route-parity.test.mjs` passed: 1 file, 5 tests.
- `node scripts/verify_deployment_route_parity.mjs --help` passed after the import-safety refactor.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai --ignore-default-forbidden-routes` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check` passed.

## Boundary

- No app UI, UX, or runtime behavior changed.
- This is launch-readiness measurement hardening for the single-true-route rule.
