# ShortPulse v1

Client-only short-form analytics and workspace surfaces. Everything runs in the browser with Supabase for auth/storage and a demo dataset you can refresh and rescore from the UI—no backend services to start or maintain.

## Tech

- Frontend: Next.js (pages router), Phosphor icons, modular CSS.
- Auth/storage: Supabase client with persisted sessions, `saved_creators` table, and a private `media_library` bucket.
- Analytics: In-browser scoring of a demo cohort with user-triggered refresh/rescore controls.
- AI Studio providers: Next.js API routes under `/api/fal/*` proxy Fal queue requests (server-side `FAL_KEY` required), including the Seedream 4.5 edit proxy at `/api/fal/seedream-edit-submit`.
- Local AI Studio media uploads: `/api/upload-image` and `/api/upload-video` store user-scoped files in private storage and return short-lived signed URLs for provider fetches.
- Media preview signing: `/api/media/sign-batch` signs user-scoped media preview paths in a single authenticated request to reduce list/grid signing overhead.
- Billing/credits: Supabase-backed plan/profile/credit ledger model with Stripe-ready checkout, portal, and webhook routes.
- Ops telemetry: authenticated app/runtime failures can be ingested at `/api/log/client-error`, viewed as grouped incidents via `/api/admin/errors`, and inspected as raw occurrences via `/api/admin/error-events`; admins can smoke-test visibility via `/api/admin/errors-test`.
- Optional alert tuning: set `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, and `SHORTPULSE_ADMIN_ALERT_GENERATION_15M` to control Admin event-spike thresholds.

## Setup

1. Copy `frontend/.env.example` to `frontend/.env.local` (or export the values in your shell) and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FAL_KEY`
2. Install and run the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The app runs entirely client-side; there is no backend server to start.

## Optional Supabase bootstrap

- Saved creators: run `sql/create_saved_creators_table.sql` to add the `saved_creators` table with RLS.
- Media library: run `sql/storage_policies.sql` to create the private `media_library` bucket and folder-scoped storage policies. The UI also expects a `media_files` table (see `docs/supabase_full_schema.sql` for a combined script).
- Private tab support: run `sql/migrations/003_add_private_media_source.sql` and `sql/migrations/004_add_private_media_integrity_checks.sql` to enforce `media_files.source` values and private path/file-type integrity.
- Billing + credits: run `sql/create_billing_credit_tables.sql` to provision plans, credit packages, billing profiles, ledger, and signup allocation triggers.
- Legacy billing environments: run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` to add `source/source_ref/metadata/created_by` columns and compatibility triggers before using `/admin` credit adjustments.
- App error telemetry: run `sql/create_app_error_logs_table.sql` and `sql/migrations/015_add_app_error_events.sql` to provision grouped incidents plus immutable per-occurrence events.

## Manual data actions

- Performance Analytics includes a “Data actions” rail for demo dataset refresh/rescore, but the entire Performance surface is post‑MVP (Coming Soon).
- Saved Creators and Media Library actions write/read directly through the Supabase client from the frontend (Saved Creators is post‑MVP).

## Frontend surfaces

- **Dashboard (`/dashboard`)**: Launchpad with plan/status chips and tool cards.
- **Performance Analytics (`/performance`)**: Post‑MVP (Coming Soon); demo analytics surface with filters and scoring.
- **Performance Placeholder (`/performance-soon`)**: Temporary landing page that explains the analytics workspace is still under construction.
- **Saved Creators (`/saved-creators`)**: Post‑MVP (Coming Soon); per-user handle list.
- **Media Library (`/media-library`)**: Upload/download/delete/rename/move files across media tabs in a private Supabase bucket, including a Private image tab (`<auth.uid()>/private/images/...`).
- **Profile (`/profile`)**: Profile/account/billing UI with plan badges, Stripe billing actions, and credit purchase entry points.
- **AI Studio (`/ai-studio`)**: Creative canvas for prompt systems, model/aspect selection, previewing, and saving image/video outputs.
- **Character Manager (`/character`)**: Beginner-first character creation and management workspace with persisted reference intake and persisted character-sheet assignments.
- **Character Placeholder (`/character-soon`)**: Legacy fallback landing page retained during Character Manager rollout.
- **Admin (`/admin`)**: Internal operator dashboard (operator-role access) with manual credit adjustment controls, per-user recent credit transaction audit (including billed-vs-raw pricing metadata), and a live app-error incident feed.

## Security

- Only the Supabase anon key is used on the client; never share the service role key.
- Enable RLS on `saved_creators` and `media_files` (per-user isolation) and keep the `media_library` bucket private with paths prefixed by `auth.uid()`.
- Route protection: `/dashboard`, `/performance`, `/saved-creators`, `/media-library`, `/profile`, `/ai-studio`, `/character`, `/character-soon`, and `/admin` expect authenticated sessions and redirect to `/auth` when missing.
- API protection: provider proxy routes, media routes, billing routes, upload routes, and admin routes require bearer-authenticated Supabase sessions.

## Testing

- Unit tests:
  ```bash
  cd frontend
  npm run test
  ```
- Full validation:
  ```bash
  cd frontend
  npm run validate
  ```
- E2E harness command (add specs incrementally):
  ```bash
  cd frontend
  npm run test:e2e
  ```

## Docs

- Start at `docs/README.md`.
- Character Manager operations runbook: `docs/sops/sop_character_manager_operations.md`.

## Repo layout

- `frontend/`: Next.js app
- `docs/`: documentation
- `sql/`: Supabase bootstrap scripts

## Roadmap / changelog

- Roadmap: `ROADMAP.md`
- Changelog: `docs/change_log.md`
