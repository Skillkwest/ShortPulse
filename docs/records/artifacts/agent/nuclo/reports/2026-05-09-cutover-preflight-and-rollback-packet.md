# Cutover Preflight And Rollback Packet

Date: 2026-05-09
Owner: Nuclo
Status: historical preflight captured before completed production cutover

## Purpose

Capture the non-secret live environment inventory and rollback-relevant facts needed before the final freeze-window production cutover.

This packet intentionally avoids storing raw secret values.

## Authentication State

As captured from this shell:

- `vercel whoami` resolves successfully
- `gh auth status` resolves successfully for `sleepyseamonster`

Implication:

- live Vercel and GitHub inspection can continue from this shell without adding new operator credentials
- later tooling updates removed the route-parity script's token dependency by adding authenticated `vercel` CLI fallback

## Vercel Inventory

### Production-scoped records currently present

Observed production-only or production-scoped records include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `SHORTPULSE_PUBLIC_API_BASE_URL`
- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED`
- `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SHORTPULSE_ADMIN_EMAILS`

Legacy or parallel Supabase-style production records were also present at preflight time:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_JWT_SECRET`

Operational meaning at preflight time:

- cutover should update the canonical app keys, not the legacy duplicate names
- duplicate names remain an operator-error risk until later cleanup

### Preview-scoped records currently present

Observed preview-only or preview-scoped records include:

- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
- `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED`
- `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED`
- `SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET`
- `APP_BASE_URL`
- `SHORTPULSE_PUBLIC_API_BASE_URL`
- `SHORTPULSE_ADMIN_EMAILS`

Branch-specific preview overrides exist at least for:

- `SHORTPULSE_FAL_RECONCILER_CRON_SECRET` on `staging-preview`
- `ELEVENLABS_API_KEY` on `staging-preview`

Operational meaning:

- the freeze packet must review both generic `Preview` scope and branch-specific preview overrides

### Development-scoped records currently present

Observed development-scoped records include:

- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
- `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED`
- `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED`
- `APP_BASE_URL`
- `SHORTPULSE_PUBLIC_API_BASE_URL`
- `SHORTPULSE_ADMIN_EMAILS`

Operational meaning:

- local development sessions that pull Vercel development envs can still write to staging if left running during cutover

### Shared records currently spanning Development, Preview, and Production

Examples observed in all three scopes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FAL_KEY`
- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`
- `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED`
- `OPENAI_API_KEY`

Operational meaning:

- this confirms the current cutover risk: core runtime authority is still shared too broadly across environments
- the final production switch must be followed by a later cleanup/hardening pass

## GitHub Inventory

### Environment secrets visible by name

Live GitHub audit reported:

- `staging`
  - `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
  - `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN`
  - `SUPABASE_DB_URL`
- `production`
  - `SUPABASE_DB_URL`

### Protection posture captured by the live audit

Live GitHub audit from this shell reported:

- `Environment staging`: `protection_rules=0`
- `Environment production`: `protection_rules=0`
- `Branch staging-preview`: `protected=false`
- `Branch production`: `protected=false`

Operational meaning at preflight time:

- governance hardening was still open in the live audit snapshot captured before the later ruleset corrections
- do not assume branch/environment protection exists during cutover unless revalidated from current GitHub rulesets

## Rollback-Relevant Facts

- Current live production runtime is still part of the freeze scope because it continues to point at the staging Supabase project until the Vercel production env switch happens.
- The rollback target for runtime behavior is the current Vercel `Production` configuration and previous production deployment.
- GitHub `production` `SUPABASE_DB_URL` will need to be restored only if workflow execution depends on it after a failed switch.
- Because GitHub secret values cannot be read back via normal CLI listing, the rollback path should treat the operator credential pack as the recovery source for the old database target.

## Immediate Next Step

Use the audited freeze packet at:

- `docs/records/artifacts/agent/nuclo/reports/2026-05-09-freeze-window-cutover-checklist.md`

and schedule the real freeze window before touching Vercel `Production` or GitHub `production`.

## Post-Cutover Note

This packet is intentionally retained as the pre-cutover snapshot. Current live state has changed:

- production now runs on the dedicated production Supabase project
- the duplicate production Supabase env names referenced above were later removed
- `production` and `staging-preview` are now governed by active GitHub rulesets
