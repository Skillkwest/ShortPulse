# Architecture Overview

ShortPulse is a Next.js pages-router app with both browser surfaces and first-party API routes under `frontend/pages/api/*`. It uses Supabase for authentication, database access, and private file storage.

## High-level components
- **Frontend (Next.js pages router)**: `frontend/`
- **Supabase**:
  - Auth: session + JWT for user-scoped data access
  - Postgres: user-owned tables protected by RLS
  - Storage: private bucket with user-scoped paths
- **Bootstrap SQL**: `sql/` and `docs/supabase_full_schema.sql`

## Request/data flow
1. User signs in via Supabase Auth (`frontend/lib/supabaseClient.ts`).
2. Browser surfaces call both Supabase directly (user-scoped reads/writes) and internal API routes (`frontend/pages/api/*`) for provider operations, billing, uploads, and admin flows.
3. API routes enforce auth/ownership through middleware and route-level checks before server-side actions.
4. Supabase reads/writes remain authorized by **RLS policies** and storage policies (see `docs/security-checklist.md`).

## Operational error telemetry
- Browser runtime failures are captured by global handlers in `frontend/pages/_app.tsx` via `frontend/lib/appErrorReporter.ts`.
- Authenticated API failures are reported by scope in `frontend/lib/authenticatedFetch.ts`: both `app` and `generation` log `4xx/5xx` failures.
- AI Studio generation lifecycle failures (provider errors, timeouts, no-media terminal states) are reported from `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts`.
- Server-side API handlers can write direct incidents/events via `frontend/lib/server/api/appErrorLogs.ts`.
- Admin incidents are queried from `/api/admin/errors` and rendered in `/admin` for operator triage.

## Route surfaces (what owns what)

### `/auth`
- Responsibility: sign-in/sign-up and session establishment.
- Key rules: never use service role keys; only public anon key in the browser.

### `/dashboard`
- Responsibility: launch surface + high-level status tiles.
- Data: session-derived user metadata for plan/identity display.

### `/performance`
- Responsibility: analytics over a demo dataset (today) and a defined contract for future real data.
- Source of truth:
  - Outlier model: `docs/product/shortflow_outlier_source_of_truth.md`
  - Product contract: `docs/product/shortpulse_top_performing_videos_source_of_truth.md`
  - AI labeling rules (non-ranking): `docs/sops/sop_performance_ai_detection.md`

### `/saved-creators`
- Responsibility: per-user CRUD for creator handles.
- Data model and RLS expectations: `docs/data-dictionary.md`, `docs/security-checklist.md`

### `/ai-studio`
- Responsibility: creative workspace UI; current state and workflow details in `docs/product/shortpulse_ai_studio.md`.

## Security invariants (must not break)
- User-owned rows are protected by RLS enforcing `user_id = auth.uid()`.
- Storage is private; object paths are scoped to `auth.uid()` prefixes.
- The browser only uses Supabase anon credentials; never expose service role keys.
