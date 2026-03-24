# Local Development

ShortPulse runs as a Next.js app with browser routes and internal API routes.

## Prerequisites

- Node.js 20+ recommended
- A Supabase project with:
  - Auth enabled
  - Required tables/policies (see below)

## Environment variables

1. Create `frontend/.env.local`.
   - Preferred when the repo is linked to Vercel: from the repo root run
     `vercel env pull frontend/.env.local --environment development`
   - Fallback/manual path: copy `frontend/.env.example` to `frontend/.env.local`.
2. Set required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FAL_KEY` (required for Fal API routes)
3. Set optional production/ops values when needed:
   - `APP_BASE_URL`
   - `SHORTPULSE_STAGING_BASE_URL` (optional helper for protected-route latency capture script)
   - `SHORTPULSE_STAGING_BEARER_TOKEN` (optional helper for protected-route latency capture script; prefer temporary tokens)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SHORTPULSE_ADMIN_EMAILS`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (defaults to `300`)
   - `OPENAI_API_KEY`
   - `OPENAI_API_BASE`
   - `OPENAI_MODEL`
   - `OPENAI_VISION_MODEL`
   - `SHORTPULSE_OPENAI_RESPONSES_ENABLED` (optional; `true` enables Responses API compatibility mode)
   - `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED` (optional; defaults to `true`)
   - `STUDIO_AGENT_THINKER_MODEL` (optional override; defaults to `OPENAI_MODEL`)
   - `STUDIO_AGENT_FORMATTER_MODEL` (optional override; defaults to thinker model)
   - `OPENAI_PROMPT_SYSTEM`
   - `STUDIO_AGENT_ENABLED`
   - `STUDIO_AGENT_SYSTEM`
   - `STUDIO_AGENT_THINKER`
   - `STUDIO_AGENT_FORMATTER`
   - `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`
   - `NEXT_PUBLIC_AGENT_V2`
   - `SHORTPULSE_RELEASE` (optional explicit release/build tag for error incidents)
   - `NEXT_PUBLIC_SHORTPULSE_RELEASE` (optional client release tag for error incidents)
   - `SHORTPULSE_ADMIN_ALERT_TOTAL_15M` (optional admin event spike threshold; default `40`)
   - `SHORTPULSE_ADMIN_ALERT_HIGH_15M` (optional admin high-severity spike threshold; default `8`)
   - `SHORTPULSE_ADMIN_ALERT_GENERATION_15M` (optional admin generation spike threshold; default `20`)
   - `SHORTPULSE_ADMIN_ALERT_PROVIDER_RUNNING_TIMEOUT_15M` (optional admin threshold for `provider_running_timeout` fails over 15 minutes; default `2`)

Never commit `.env.local`.

`frontend/.env.local` is local app runtime only. Do not treat it as the deployed source of truth once the repo is linked to Vercel.

For local script automation, you can optionally create a root-level `.env.agent.local` (gitignored) using `.env.agent.local.example`. Probe helpers auto-load this file.

`.env.agent.local` is for local probe/audit tooling only. Keep staging helper URLs, Vercel API tokens, protection bypass tokens, and similar operator-only values there instead of in Vercel project envs.

## Run the app

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

## Supabase tooling policy

- Use Supabase CLI for Supabase access in this repo.
- Do not use Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).
- For hosted schema operations, use explicit target pinning (`--linked` or `--db-url`) as described in `docs/database-migrations.md`.

## Bootstrap Supabase (optional)

- Minimal scripts: `sql/create_saved_creators_table.sql` and `sql/storage_policies.sql`
- Combined schema: `docs/supabase_full_schema.sql`
- Required billing/generation migrations for current API behavior:
  - `sql/migrations/001_add_studio_10000_credit_package.sql`
  - `sql/migrations/002_add_generation_credit_reservations.sql`
  - `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`
  - `sql/migrations/014_harden_generation_reservation_rpc_security.sql`
  - `sql/migrations/015_add_app_error_events.sql`
- Legacy ledger environments: run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` before using admin credit adjustments.

## Quality checks

```bash
cd frontend
npm run lint
npm run test
npm run type-check
npm run build
```

Optional formatter check (after baseline formatting pass):

```bash
cd frontend
npm run format:check
```

Optional protected-route latency probe:

```bash
cd frontend
npm run latency:protected-route -- --path /api/billing/credit-packages --samples 30 --warmup 5 --bootstrap-token-from-supabase
```

Optional AI Studio production perf release check:

```bash
cd frontend
PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run perf:ai-studio:release-check
```

Optional repo sweep (major CI-aligned checks in one pass):

```bash
bash scripts/run_repo_sweep.sh
```
