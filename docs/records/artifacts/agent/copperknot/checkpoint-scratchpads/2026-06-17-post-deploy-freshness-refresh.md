# Copperknot checkpoint scratchpad: post-deploy freshness refresh

Time: 2026-06-17 08:56 MST

Touched:
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/systems/launch-fitness-scorecard-2026-06-16.md`
- `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`
- `frontend/features/ai-studio/logic/__tests__/projectWorkspaceApiClient.test.ts`

Did:
- Refreshed production-safe route/fail-closed evidence after the user's deploy.
- Recorded deployment `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app`, created `2026-06-17T15:33:16.081Z`, with `175` route entries.
- Preserved existing queue order, scores, and proof boundaries.
- Hardened the Projects/workspace restore API client so safe plain-text save/load failures surface actionable messages instead of generic HTTP/content-type text.
- Left HTML/invalid error responses on the generic sanitized path.

Validation:
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed at the time of this checkpoint before default retired-route enforcement was added.
- `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives` passed.
- Public `/`, `/pricing`, `/dashboard` returned `200`; callback URL was canonical; unauthenticated account/Fal probes returned `401`.
- `node scripts/check_secret_exposure.js` passed.
- `npm -C frontend run test -- --run features/ai-studio/logic/__tests__/projectWorkspaceApiClient.test.ts` passed.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `npm -C frontend run fal:routes:check` passed with `17` route families checked.
- `node scripts/check_generation_pipeline_legacy_paths.mjs` passed with `213` files scanned.
- `git diff --check` passed.

Caveat:
- The broader worktree still contains active Media Library/Gear Ball changes outside this Copperknot pass.
- Later on 2026-06-17, strict route parity was upgraded to enforce retired routes by default. The same production deployment still passes required-route parity with `--ignore-default-forbidden-routes`, but strict launch parity correctly fails while `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset` remain exposed.
