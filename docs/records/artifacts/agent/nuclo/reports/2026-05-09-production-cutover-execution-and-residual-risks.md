# Production Cutover Execution And Residual Risks

Date: 2026-05-09
Owner: Nuclo
Status: production cutover executed; hosted internal operator routes restored to protected state

## Outcome

The ShortPulse production runtime is now pointed at the dedicated production Supabase project `ftgrqgjrchpimronuhop`.

The cutover steps completed were:

- final staging-to-production hot-table and media-generation delta sync
- production Vercel env rewiring for:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_BASE_URL`
  - `SHORTPULSE_PUBLIC_API_BASE_URL`
- GitHub Environment `production` `SUPABASE_DB_URL` update
- production redeploy to `dpl_DLUsQRed23qnFVDQ3jcYfcfiXJ5Z`
- follow-up production redeploy to `dpl_5iLyGzxAsAyFMhPT3G3x7Yk7N79E` after restoring customer-facing provider keys and upload/reconciler runtime flags
- follow-up production redeploy to `dpl_EaFtqRGkj9NmGPcnTQq4weA8wLeZ` after reopening hosted derivative and admin user-health route flags
- final production redeploy to `dpl_3kDgwu8xDb7JgHTajAQEgAUooVmV` after seeding `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET` from operator `CRON_SECRET`
- follow-up production redeploy to `dpl_EE6Q5PWdwoRaqrqJGMdRKFoihwuY` after restoring the internal billing renewals worker flag and cron secret

Final live production deployment:

- deployment id: `dpl_EE6Q5PWdwoRaqrqJGMdRKFoihwuY`
- deployment url: `https://shortpulse-idpmi0l8o-kirk-artmans-projects.vercel.app`
- live aliases:
  - `https://www.shortpulse.ai`
  - `https://shortpulse.ai`
  - `https://shortpulse.vercel.app`

## Validation Evidence

Validated during cutover:

- targeted shared-table parity matched at switch time for:
  - `auth.users`
  - `auth.sessions`
  - `public.ai_credit_ledger`
  - `public.ai_credit_reservations`
  - `public.ai_generation_outputs`
  - `public.ai_generations`
  - `public.app_error_events`
  - `public.app_error_logs`
  - `public.generation_projection`
  - `public.generation_publications`
  - `public.media_events`
  - `public.media_files`
  - `public.project_media_items`
  - `public.worker_runs`
  - `storage.objects`
- `scripts/ops/supabase_storage_parity.sh --bucket media_library` reported no bucket metadata or object-total drift before the switch
- `gh secret list --env production` confirmed the `SUPABASE_DB_URL` secret update landed
- live alias moved to the final post-restoration production deployment
- final unauthenticated POST probes returned `401` for:
  - `/api/internal/admin-user-health-fleet/run`
  - `/api/internal/generation-recovery/run`
  - `/api/internal/media-derivatives/run`
- final unauthenticated POST probe returned `401` for:
  - `/api/internal/billing-contract-renewals/run`

## Route Investigation Result

The earlier hosted route `404` result was not a missing-build regression.

Direct POST probes to:

- `/api/internal/admin-user-health-fleet/run`
- `/api/internal/generation-recovery/run`
- `/api/internal/media-derivatives/run`

initially returned `404` because the cutover freeze had intentionally left route-enabling flags disabled:

- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED`
- `SHORTPULSE_USER_HEALTH_FLEET_ENABLED`

The derivative route then returned `503` until `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET` was restored on Production.

Final interpretation:

- the route files are present and identical across `origin/production`, `origin/staging-preview`, and `origin/working-development`
- hosted `404` on these internal endpoints can be an expected runtime-flag outcome, not proof that the route is missing from the build
- after restoring the intended hosted flags and the derivative cron secret, all three routes reached the correct protected state (`401 Unauthorized` without credentials)

## Freeze-State Notes

Customer-facing provider keys were restored on production from local operator state in `frontend/.env.local` for:

- `FAL_KEY`
- `OPENAI_API_KEY`
- `SHORTPULSE_KIE_API_KEY`

Customer-facing runtime flags were also restored on production for:

- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`
- `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED`
- `SHORTPULSE_FAL_RECONCILER_ENABLED`

Hosted internal operator flags were then restored on production for:

- `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED`
- `SHORTPULSE_USER_HEALTH_FLEET_ENABLED`

Additional production secret restored during the hosted-route recovery pass:

- `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET`

Billing worker restoration completed after confirming production still has active internal comp contracts:

- `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED`
- `SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET`

## Tooling Changes Made During Execution

To close the live-write drift that remained during the freeze window:

- `scripts/ops/supabase_hot_table_delta_sync.sh` was expanded to include:
  - `public.ai_credit_reservations`
  - `public.ai_credit_ledger`
- `scripts/ops/supabase_media_generation_delta_sync.sh` was expanded to include:
  - `public.ai_generations`
  - `public.generation_attempts`
  - `public.ai_generation_outputs`
  - `public.generation_projection`
  - `public.media_files`
  - `public.generation_publications`
  - `public.project_media_items`
  - `public.media_events`

These script expansions were required to make the final parity pass deterministic enough for the production switch.

## Governance And Config Hardening

Completed after cutover:

- removed the stale production-only duplicate Supabase env keys:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SECRET_KEY`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_JWT_SECRET`
- verified `production` remains covered by the active GitHub ruleset `Production` (`id=13060916`)
- created an active GitHub ruleset `Staging Preview` (`id=16179471`) for `refs/heads/staging-preview` with:
  - deletion blocked
  - non-fast-forward blocked
  - PR required with one approving review
  - stale-review dismissal
  - required review-thread resolution
  - required linear history
- later tightened the `Staging Preview` ruleset with required checks:
  - `Vercel`
  - `Supabase Preview`
- updated `scripts/ops/github_env_audit.sh` to inspect ruleset-effective branch governance so audit output matches GitHub's current enforcement model

## Open Follow-Ups

- Rotate all credentials that were exposed in chat after the environment transition is fully stabilized.
