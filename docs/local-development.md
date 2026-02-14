# Local Development

ShortPulse runs as a Next.js app with browser routes and internal API routes.

## Prerequisites

- Node.js 20+ recommended
- A Supabase project with:
  - Auth enabled
  - Required tables/policies (see below)

## Environment variables

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Set required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FAL_KEY` (required for Fal API routes)
   - `KEI_API_KEY` (required for KEI/OpenAI proxy routes)
3. Set optional production/ops values when needed:
   - `APP_BASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SHORTPULSE_ADMIN_EMAILS`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (defaults to `300`)
   - `OPENAI_API_KEY`
   - `OPENAI_API_BASE`
   - `OPENAI_MODEL`
   - `OPENAI_VISION_MODEL`
   - `OPENAI_PROMPT_SYSTEM`
   - `STUDIO_AGENT_ENABLED`
   - `STUDIO_AGENT_SYSTEM`
   - `STUDIO_AGENT_THINKER`
   - `STUDIO_AGENT_FORMATTER`
   - `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`
   - `NEXT_PUBLIC_AGENT_V2`
   - `SHORTPULSE_RELEASE` (optional explicit release/build tag for error incidents)
   - `NEXT_PUBLIC_SHORTPULSE_RELEASE` (optional client release tag for error incidents)

Never commit `.env.local`.

## Run the app

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

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
