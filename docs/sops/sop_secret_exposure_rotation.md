# SOP: Secret Exposure Rotation

Purpose: provide the canonical ShortPulse operator workflow for rotating exposed credentials after chat, screenshot, temp-file, or commit leakage.

## Scope

Use this SOP when any live credential is exposed outside its intended secure surface, including:

- chat transcripts
- screenshots
- temporary files
- local notes
- commit history
- issue trackers or shared docs

This SOP is for live operator response, not design-time planning.

## Core rules

1. Treat exposed credentials as compromised, not merely "visible."
2. Replace consumers with new credentials before revoking old credentials when the provider supports dual-validity overlap.
3. Rotate staging first, then production, unless an incident requires immediate production-first containment.
4. Keep secret values out of repo docs, reports, and chat summaries.
5. Record timestamps, affected environments, and validation evidence after each rotation step.

## Current platform guidance

- Supabase API keys: [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- Supabase legacy JWT/anon/service-role rotation caveats: [Rotating Anon, Service, and JWT Secrets](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd)
- Vercel environment-variable rotation safety: [Rotating environment variables](https://vercel.com/docs/environment-variables/rotating-secrets/)
- Vercel env management: [Managing environment variables across environments](https://vercel.com/docs/environment-variables/manage-across-environments)
- GitHub environment secrets API reference: [GitHub environment secrets](https://docs.github.com/en/rest/actions/secrets)

## Prerequisites

1. Current operator access to the affected providers.
2. Local-only operator state available in root `.env.agent.local` where applicable.
3. Clear environment mapping for every consumer that will be updated:
   - local/dev
   - Vercel `Development`
   - Vercel `Preview`
   - Vercel `Production`
   - GitHub `staging`
   - GitHub `production`
4. Rollback-aware note of the current target surfaces before replacement.

## ShortPulse credential classes

### Supabase runtime credentials

- project API URL
- publishable key (`sb_publishable_...`) even when stored in legacy-named env vars such as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- secret key (`sb_secret_...`) or legacy JWT-based `service_role` value stored in `SUPABASE_SERVICE_ROLE_KEY`

### Supabase database credentials

- database password
- pooled connection strings used by GitHub or operators

### Vercel secrets

- protection bypass secret
- any copied cron or provider secret that was exposed alongside the incident

### GitHub environment secrets

- `SUPABASE_DB_URL`
- any environment secret copied into chat or screenshots

## Supabase-specific caution

Prefer rotating `sb_publishable` and `sb_secret` keys directly when those are the active values in use.

Do **not** rotate the Supabase JWT secret unless the active deployed values are still legacy JWT-based `anon`/`service_role` keys or the JWT secret itself was exposed. Rotating the JWT secret invalidates legacy API keys and existing connections immediately, which is materially riskier than rotating `sb_` keys.

## Execution order

### Phase 0: Inventory

- identify exactly which credential values were exposed
- identify every consumer for each exposed value
- classify each secret as:
  - staging-only
  - production-only
  - shared across staging and production

### Phase 1: Prepare replacement values

For each affected provider:

- generate or create the new credential
- keep the old credential valid during replacement if the provider supports overlap
- record only non-secret metadata:
  - provider
  - environment
  - credential class
  - generated-at timestamp

### Phase 2: Replace staging consumers

Update staging-facing consumers first:

- local operator state if it relies on the exposed value
- Vercel `Development`
- Vercel `Preview`
- GitHub `staging`
- any Supabase Vault or scheduler secret consumer tied to staging

Then validate staging before revoking the old staging credential.

### Phase 3: Replace production consumers

Update production-facing consumers second:

- Vercel `Production`
- GitHub `production`
- any Supabase Vault or scheduler secret consumer tied to production

Then redeploy or restart the affected production surface and validate before revoking the old production credential.

### Phase 4: Revoke old credentials

Only revoke the old credential after:

- all known consumers are updated
- validation is clean
- rollback is no longer needed

If the provider does not support overlap:

- schedule a tighter maintenance window
- update all consumers in one pass
- validate immediately after the rotation

## Validation checklist

### Vercel runtime validation

- `node scripts/check_vercel_env_contract.mjs --environment development --environment preview --environment production`
- `node scripts/verify_deployment_route_parity.mjs --base-url <staging-preview-url>`
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
- confirm live homepage returns `200`
- confirm production protected internal routes return `401` when probed without auth

### GitHub secret validation

- `gh secret list --env staging`
- `gh secret list --env production`
- confirm the expected secret names remain present after update

### Supabase validation

- confirm the project URL still matches the intended project ref
- confirm auth, representative media access, and one representative write path work in the updated environment
- if a DB password changed, confirm connection-dependent workflows can still run

## Incident evidence to record

Capture the following without storing raw secrets:

- credential class
- environment
- rotated-at UTC timestamp
- provider console or CLI confirmation that replacement succeeded
- validation commands run
- whether the old credential was revoked

Preferred ShortPulse evidence surfaces:

- retained operator artifact under `docs/records/artifacts/agent/nuclo/reports/`
- concise durable lesson in `docs/agents/nuclo/memory.md`
- update `docs/change_log.md` only when the rotation materially changes repo-visible operator procedure

## ShortPulse validation commands

Run the smallest useful validation set for the affected surface:

```bash
npm -C frontend run docs:check
node scripts/check_vercel_env_contract.mjs --environment development --environment preview --environment production
node scripts/verify_deployment_route_parity.mjs --base-url <staging-preview-url>
node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai
```

Or run the bundled helper:

```bash
bash scripts/ops/secret_rotation_validate.sh --preview-url <staging-preview-url>
```

Add targeted runtime probes when production credentials changed:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.shortpulse.ai/
```

```bash
curl -s -o /tmp/shortpulse_generation_recovery_probe.txt -w '%{http_code}\n' \
  -X POST https://www.shortpulse.ai/api/internal/generation-recovery/run
```

Expected protected-state result for the internal route probe:

- `401`

Recommended production route set:

- `/api/internal/generation-recovery/run`
- `/api/internal/media-derivatives/run`
- `/api/internal/admin-user-health-fleet/run`
- `/api/internal/billing-contract-renewals/run`

## Maintenance

- Keep this SOP aligned with `docs/security-checklist.md`, `docs/deployment.md`, and active Nuclo operator reports.
- Prefer updating this SOP over creating new ad hoc chat-only instructions for future secret incidents.
