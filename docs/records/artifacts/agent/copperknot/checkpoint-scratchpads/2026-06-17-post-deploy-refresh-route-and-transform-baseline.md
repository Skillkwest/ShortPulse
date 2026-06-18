# Copperknot checkpoint scratchpad - post-deploy refresh route and transform baseline

Date: 2026-06-17

Touched:
- Added this scratchpad only.

Checked:
- `git branch --show-current` and `git config --local shortpulse.allowedBranch`: both `production`.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai --output /tmp/shortpulse-route-parity-refresh.json`
- Focused recovery/lineage tests: `npm -C frontend run test -- --run lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts lib/server/api/__tests__/generationAbandonment.test.ts tests/api/admin-generation-trace.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts lib/server/api/__tests__/generationOutputConvergence.test.ts`
- `npm -C frontend run type-check:touched`
- `git diff --check`
- No-Supabase-transform guard tests: `npm -C frontend run test -- --run lib/__tests__/supabaseTransformGuard.test.ts lib/__tests__/mediaSignedTransformPolicy.test.ts lib/__tests__/mediaPreviewTrustPolicy.test.ts lib/adaptive-media/__tests__/resolver.test.ts`

Result:
- Production route parity still fails strict forbidden-route enforcement on the current resolved deployment `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app`, created `2026-06-17T15:33:16.081Z`, because `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset` are still exposed.
- Local source files for those three routes are deleted in the dirty worktree, so this remains a deploy/convergence gate, not a new local source-edit target.
- Focused recovery/lineage tests passed: 7 files, 56 tests.
- Touched type-check passed.
- `git diff --check` passed.
- No-Supabase-transform guard tests passed: 4 files, 22 tests.

Boundary:
- No commit, push, deploy, credit-consuming check, UI/UX change, or Gear Ball media/UI worktree edit.
