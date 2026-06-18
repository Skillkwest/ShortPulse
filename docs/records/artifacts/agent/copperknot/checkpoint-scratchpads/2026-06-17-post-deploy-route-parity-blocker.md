# 2026-06-17 Post-Deploy Route Parity Blocker

- Refreshed after user-reported deploy on `production` with `shortpulse.allowedBranch=production`.
- Ran `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`.
- Production still resolves to `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app`, created `2026-06-17T15:33:16.081Z`.
- Parity failed because production still exposes retired routes: `/api/upload-video`, `/api/upload-audio`, `/api/media/admit-image-asset`.
- Local source has those route files deleted, and focused parity tests pass with `npm -C frontend run test -- --run tests/scripts/deployment-route-parity.test.mjs`.
- Classification: release/deploy proof boundary, not a new local source-hardening lane.
