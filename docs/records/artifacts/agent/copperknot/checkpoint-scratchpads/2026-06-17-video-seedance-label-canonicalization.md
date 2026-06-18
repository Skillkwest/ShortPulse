# Copperknot Checkpoint Scratchpad - Video Seedance Label Canonicalization

Date: 2026-06-17

Scope: post-deploy refresh plus narrow Video workflow source hardening outside Gear Ball's active Media Library files.

Touched:
- `scripts/lib/fal_route_inventory.js`
- generated Kie Seedance Fal wrappers under `frontend/pages/api/fal/`
- `frontend/lib/server/providerIntegration/kieModelContracts.ts`
- `frontend/tests/api/kie-status-route-config.test.ts`
- `frontend/tests/api/fal-submit-proxy.test.ts`
- launch-control docs for current evidence tracking

Why: repo ground rules identify `kie-ai/seedance-2` and `kie-ai/seedance-2-fast` as canonical active Seedance 2 lanes and prohibit stale `seedance-2.0` naming. The route inventory, generated wrappers, route tests, and provider-contract labels still carried `Kie Seedance 2.0` / `Kie Seedance 2.0 Fast`.

Change: canonicalized internal route/provider labels to `Kie Seedance 2` and `Kie Seedance 2 Fast`, then regenerated Fal wrappers from the inventory. Visible UI copy was not changed.

Validation:
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai --forbidden-route /api/legacy/fallback-route`
- `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives`
- `node scripts/check_secret_exposure.js`
- `npm -C frontend run test -- --run tests/api/kie-status-route-config.test.ts tests/api/fal-submit-proxy.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`
- `npm -C frontend run fal:routes:check`
- `npm -C frontend run type-check:touched`

Proof boundary: local source-contract and production-safe route/fail-closed proof only. This does not prove authenticated Video generation, provider success, or credit-spending behavior.
