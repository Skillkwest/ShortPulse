# Architecture Overview

ShortPulse is currently a **client-only** Next.js app that uses **Supabase** for authentication, database access, and private file storage. There is no backend service required to run the product locally.

## High-level components
- **Frontend (Next.js pages router)**: `frontend/`
- **Supabase**:
  - Auth: session + JWT for user-scoped data access
  - Postgres: user-owned tables protected by RLS
  - Storage: private bucket with user-scoped paths
- **Bootstrap SQL**: `sql/` and `docs/supabase_full_schema.sql`

## Request/data flow (client-only)
1. User signs in via Supabase Auth (`frontend/lib/supabaseClient.ts`).
2. The browser holds a session; Supabase client attaches the user JWT to requests.
3. Reads/writes to Postgres/storage are authorized by **RLS policies** and storage policies (see `docs/security-checklist.md`).

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
  - Outlier model: `docs/shortflow_outlier_source_of_truth.md`
  - Product contract: `docs/shortpulse_top_performing_videos_source_of_truth.md`
  - AI labeling rules (non-ranking): `docs/sop_performance_ai_detection.md`

### `/saved-creators`
- Responsibility: per-user CRUD for creator handles.
- Data model and RLS expectations: `docs/data-dictionary.md`, `docs/security-checklist.md`

### `/media-library`
- Responsibility: per-user file upload/list/download/delete/rename.
- Storage isolation expectations: `docs/security-checklist.md`, `sql/storage_policies.sql`

### `/ai-studio`
- Responsibility: creative workspace UI; current state and workflow details in `docs/shortpulse_ai_studio.md`.

## Security invariants (must not break)
- User-owned rows are protected by RLS enforcing `user_id = auth.uid()`.
- Storage is private; object paths are scoped to `auth.uid()` prefixes.
- The browser only uses Supabase anon credentials; never expose service role keys.

