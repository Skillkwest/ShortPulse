# Copperknot Scratchpad: Post-Deploy Route Freshness

Date: 2026-06-21

Purpose: refresh the deploy-gated route-surface proof after the user deployed.

Touched:

- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `frontend/lib/server/api/dashboardOffers.ts`
- `frontend/tests/api/admin-offers.test.ts`
- `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- `frontend/features/ai-studio/components/MediaLibraryPanelPromptsSection.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/submissionInputHelpers.ts`
- `frontend/features/ai-studio/hooks/contracts/taskSubmissionContracts.ts`

Result:

- Strict production route parity passed against `https://www.shortpulse.ai`.
- Deployment: `shortpulse-kbam1m8m2-kirk-artmans-projects.vercel.app`, created `2026-06-21T14:01:59.680Z`.
- Inspected `173` route entries.
- Required internal routes are present.
- Forbidden retired routes are absent, including `/onboarding` and `/api/media/upload`.
- Protected internal generation recovery, user health fleet, and media derivatives fail closed unauthenticated.
- Secret exposure checks passed.
- Public `/` and anonymous `/dashboard` no longer visibly render the old placeholder offer card, but still serialize `tsting` / `teseting` in the HTML payload.
- Local source now filters placeholder/test-like active offers before public static props serialization.
- Focused dashboard offer validation passed.
- `npm -C frontend run build` passed.
- Local built SSG HTML for `/` and `/dashboard` no longer contains `tsting` or `teseting`.
- The media rendering guardrail was blocked by `MediaLibraryPanel.tsx` exceeding the enforced `1500` line budget.
- Extracted prompt-section rendering into `MediaLibraryPanelPromptsSection.tsx`, preserving current UI/UX and behavior.
- `MediaLibraryPanel.tsx` is now `1498` lines.
- Focused Media Library panel tests passed: `81` passed / `8` skipped.
- `npm -C frontend run validate:media-rendering-guardrails` passed, including media size budget, architecture boundary, Supabase transform guard, and docs checks.
- The AI Studio task-submission hook was the remaining size-budget warning at `1023` lines.
- Extracted pure submission input helpers and moved the generation-record input type into the existing task-submission contract file.
- `useAiStudioTaskSubmission.ts` is now `999` lines.
- Focused task-submission hook tests passed: `56` passed.
- `npm -C frontend run check:size-budget` now passes with no warnings.
- Launch guardrail sweep passed: Generate CTA contract, Fal route wrappers, architecture boundary, model doctor, generation legacy-path, legacy naming, and npm script path checks.
- Media checkpoints passed:
  - `media:checkpoint:count-hot-path`: `15` panel-controller tests and `41` media-list tests passed.
  - `media:checkpoint:panel-runtime-churn`: `15` panel-controller, `8` media runtime store, `6` panel runtime, and `5` focused MediaLibraryPanel tests passed.
  - `media:checkpoint:preview-authority`: `4` media-list, `3` resolve-preview, `7` signing-controller, and `15` panel-controller tests passed.
- Production billing launch readiness refreshed against `https://www.shortpulse.ai`: `9` pass / `1` warn / `0` fail.
- Billing refresh covered production env contract, billing route parity, signup callback plan intent, public pricing catalog, production Supabase catalog, hidden free tier, signup trigger, and billing renewal worker fail-closed behavior.
- The remaining billing warning is still Stripe webhook endpoint event proof because `STRIPE_SECRET_KEY` is unavailable locally.
- `node scripts/check_vercel_env_contract.mjs --environment production` passed with undeclared-key warnings. Current source search found retired media-upload env keys only in historical docs/retained artifacts, not active runtime reads.
- Production runtime SQL security audit refreshed through ignored local production DB URL without printing the URL: `353` total checks / `353` passing / `0` failing.
- Production media storage deploy gate passed: storage-path drift counts were all `0`, and required media storage constraints were present and validated.
- Production QoE recheck on the active deployment:
  - `/` and anonymous `/dashboard` still return `200` with `ShortPulse · Home`, but public HTML still serializes `tsting` and `teseting` once each.
  - `/terms`, `/privacy`, and `/refund-policy` still return `404`.
  - `/onboarding` returns `404`.
  - `/ai-studio` returns `200` with `ShortPulse · AI Studio`.
  - `/profile`, `/report-issue`, `/admin`, `/performance`, and `/performance-soon` return `200` with `ShortPulse · Loading`.
- Post-deploy continuation refresh after the user's next deploy still resolved `https://www.shortpulse.ai` to the same deployment, `shortpulse-kbam1m8m2-kirk-artmans-projects.vercel.app`, created `2026-06-21T14:01:59.680Z`.
- The repeated production QoE probe still found `/` and anonymous `/dashboard` serializing `tsting` and `teseting`, legal/policy pages at `404`, `/ai-studio` titled, and `/profile`, `/report-issue`, `/admin`, `/performance`, and `/performance-soon` using `ShortPulse · Loading`.

Boundary:

- Route retirement is production-checked.
- Public-offer payload cleanup is local source/build hardening only until deployed.
- Media rendering guardrail cleanup is local source hardening only; it does not prove authenticated production Media Library behavior.
- Task-submission modularization is local source hardening only; it does not prove authenticated production Create/Video/Sound generation.
- Media checkpoints are local source/contract evidence only; they do not prove authenticated production save/browse/reuse behavior or hosted derivative/storage SQL posture.
- Billing refresh is production-safe proof only; Stripe webhook event proof remains unavailable without approved credentialed Stripe inspection.
- Undeclared Vercel env warnings should be reviewed as contract hygiene, but the retired media-upload keys are not active route/runtime proof targets.
- SQL/security and media-storage gate checks were read-only hosted-production diagnostics. They do not prove authenticated customer save/browse/reuse behavior or object-delivery success for actual user rows.
- QoE source hardening for public-offer payload/title cleanup is still not deployed on this active production deployment except the AI Studio title. Legal/policy pages and Performance scope remain product/approval gates, not Copperknot patch targets.
- This does not prove authenticated customer workflows, Performance launch scope, storage derivative posture, recovery/settlement lifecycle, authenticated operator behavior, or credit-consuming generation.
