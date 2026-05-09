# Nuclo Environment Ledger Template

Purpose: provide one canonical, reviewable ledger for ShortPulse branch, runtime, deployment, and database mapping before environment or cutover work.

## Usage

1. Copy this template into a dated handoff packet or report when preparing a real cutover.
2. Fill every value from the authoritative platform source, not from chat memory or temporary exports.
3. Keep secrets out of the ledger. Record refs, URLs, secret names, and validation status only.

## Environment Matrix

| Lane | Branch | Runtime URL | Vercel scope | Vercel project | Supabase project ref | GitHub Environment | DB secret name | Auth site URL | Storage bucket status | Billing status | Validation status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dev | `working-development` | | `development` | `shortpulse` | | | | | | | | |
| Staging | `staging-preview` | | `preview` | `shortpulse` | | `staging` | `SUPABASE_DB_URL` | | | | | |
| Production | `production` | `https://www.shortpulse.ai` | `production` | `shortpulse` | | `production` | `SUPABASE_DB_URL` | | | | | |

## Vercel Runtime Keys

Record the target ownership for the keys that must stay environment-specific:

| Key | Development target | Preview target | Production target | Verified |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | | | | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | | | | |
| `SUPABASE_SERVICE_ROLE_KEY` | | | | |
| `APP_BASE_URL` | | | | |
| `SHORTPULSE_PUBLIC_API_BASE_URL` | | | | |
| `STRIPE_SECRET_KEY` | n/a | n/a | | |
| `STRIPE_WEBHOOK_SECRET` | n/a | n/a | | |

## GitHub Environment Secrets

| Environment | Required secret | Verified | Notes |
| --- | --- | --- | --- |
| `staging` | `SUPABASE_DB_URL` | | |
| `production` | `SUPABASE_DB_URL` | | |

## Supabase Readiness Checks

| Check | Staging | Production | Verified | Notes |
| --- | --- | --- | --- | --- |
| `public` schema parity | | | | |
| `auth` user/session parity | | | | |
| `storage.objects` metadata parity | | | | |
| Storage blob payload parity | | | | |
| Auth redirect URLs | | | | |
| Site URL | | | | |
| Required buckets present | | | | |
| Live-write table final sync complete | | | | |

## Go / No-Go

| Gate | Status | Evidence |
| --- | --- | --- |
| Vercel env audit passed | | |
| GitHub env audit passed | | |
| Supabase schema parity passed | | |
| Supabase row-count parity acceptable | | |
| Storage payload parity passed | | |
| Production smoke tests passed | | |
| Rollback values staged | | |
