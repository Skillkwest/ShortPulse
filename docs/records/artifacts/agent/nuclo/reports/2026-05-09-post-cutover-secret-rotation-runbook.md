# Post-Cutover Secret Rotation Runbook

Date: 2026-05-09
Owner: Nuclo
Status: ready for execution after production cutover stabilization

## Purpose

Capture the exact ShortPulse credential set that was exposed during the staging-to-production cutover work and provide the safe replacement order.

This packet intentionally avoids storing raw secret values.

## Exposure Set

The following credential classes were exposed in chat or screenshots during the cutover lane:

### Supabase staging

- project ref `jwmcytzyhcvacjwqtynn`
- publishable key
- secret key
- database password
- pooled database connection string used for GitHub `staging` `SUPABASE_DB_URL`

### Supabase production

- project ref `ftgrqgjrchpimronuhop`
- publishable key
- secret key
- database password
- pooled database connection string used for GitHub `production` `SUPABASE_DB_URL`

### Vercel

- automation/deployment protection bypass secret for the live project

## Important correction

The production project URL authority is:

- `https://ftgrqgjrchpimronuhop.supabase.co`

Do not reuse the earlier mistaken staging URL for production rotation or validation.

## Active consumer map

### Staging-backed consumers

- local/dev sessions that intentionally use staging Supabase
- Vercel `Development`
- Vercel `Preview`
- GitHub Environment `staging` `SUPABASE_DB_URL`
- any staging scheduler/Vault secret consumers that depend on rotated DB or bypass credentials

### Production-backed consumers

- Vercel `Production`
- GitHub Environment `production` `SUPABASE_DB_URL`
- any production scheduler/Vault secret consumers that depend on rotated DB or bypass credentials

## Rotation sequence

### Phase 1: Staging Supabase API keys

1. Create replacement staging `sb_publishable` and `sb_secret` keys.
2. Update staging consumers:
   - local operator state if needed
   - Vercel `Development` `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Vercel `Development` `SUPABASE_SERVICE_ROLE_KEY`
   - Vercel `Preview` `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Vercel `Preview` `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy or verify staging runtime if Vercel requires a fresh deployment.
4. Validate staging auth and one representative protected route.
5. Revoke the old staging `sb_` keys.

### Phase 2: Staging database password

1. Rotate the staging database password.
2. Update:
   - local operator state
   - Vercel `Development` consumers that still materialize staging DB values through local pulls or operator scripts
   - GitHub Environment `staging` `SUPABASE_DB_URL`
   - any staging-only pooled connection consumers
3. Validate any workflow or script that depends on staging DB connectivity.
4. Revoke/retire the old staging DB credential.

### Phase 3: Production Supabase API keys

1. Create replacement production `sb_publishable` and `sb_secret` keys.
2. Update Vercel `Production`:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Confirm `NEXT_PUBLIC_SUPABASE_URL` remains `https://ftgrqgjrchpimronuhop.supabase.co`.
4. Trigger a fresh production deploy.
5. Validate:
   - `https://www.shortpulse.ai` returns `200`
   - `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
   - representative protected internal routes return `401`
6. Revoke the old production `sb_` keys.

### Phase 4: Production database password

1. Rotate the production database password.
2. Update:
   - local operator state
   - GitHub Environment `production` `SUPABASE_DB_URL`
   - any production-only pooled connection consumers
3. Validate workflow and script DB connectivity.
4. Revoke/retire the old production DB credential.

### Phase 5: Vercel bypass secret

1. Generate a new protection bypass secret in Vercel.
2. Update every consumer that depends on it:
   - local operator state
   - GitHub Environment `staging` `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN`
   - any Supabase Vault secret or scheduler flow using the bypass token
3. Validate access to protected preview deployments if that workflow still matters.
4. Revoke/remove the old bypass secret.

## Validation commands

### Shared

```bash
npm -C frontend run docs:check
node scripts/check_vercel_env_contract.mjs --environment development --environment preview --environment production
node scripts/verify_deployment_route_parity.mjs --base-url <staging-preview-url>
```

### Production

```bash
node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.shortpulse.ai/
```

```bash
curl -s -o /tmp/shortpulse_media_derivatives_probe.txt -w '%{http_code}\n' \
  -X POST https://www.shortpulse.ai/api/internal/media-derivatives/run
```

```bash
curl -s -o /tmp/shortpulse_user_health_probe.txt -w '%{http_code}\n' \
  -X POST https://www.shortpulse.ai/api/internal/admin-user-health-fleet/run
```

```bash
curl -s -o /tmp/shortpulse_billing_probe.txt -w '%{http_code}\n' \
  -X POST https://www.shortpulse.ai/api/internal/billing-contract-renewals/run
```

Expected production results:

- homepage: `200`
- internal route probes: `401`

## Evidence to capture

Record the following for each rotated credential class:

- provider
- environment
- credential class
- rotated-at UTC timestamp
- validation outcome
- revoked-at UTC timestamp

## Deferred or conditional items

- Legacy Supabase JWT `anon`/`service_role` or JWT secret rotation is **not** part of this packet unless those legacy values are confirmed to still be active consumers.
- Provider keys such as `FAL_KEY`, `OPENAI_API_KEY`, and `SHORTPULSE_KIE_API_KEY` were restored during cutover, but they were not part of the credential set pasted into chat in this lane. Rotate them only if separate exposure evidence exists.
