# Troubleshooting

## `next build` / `next lint` prompts to “configure ESLint”
This happens when the repo has `eslint-config-next` installed but no ESLint config file exists.

Fix: ensure `frontend/.eslintrc.json` exists (this repo uses `next/core-web-vitals`).

## Supabase auth redirects not working
Checklist:
- `frontend/.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- You’re signed in and the session is persisted (see `frontend/lib/supabaseClient.ts`).
- Protected routes redirect to `/auth` when session is missing (see `frontend/lib/authGuard.ts`).

## Media Library operations fail (upload/list/delete)
Checklist:
- The `media_library` bucket is private and policies require user-scoped paths.
- RLS is enabled for `media_files` and policies enforce `user_id = auth.uid()`.
- You ran the bootstrap scripts in `sql/` (including `sql/create_media_library_tables.sql`) or `docs/supabase_full_schema.sql`.

## Prompt or AI Generation saves fail
Checklist:
- `media_prompts`, `ai_generations`, and `media_events` tables exist.
- RLS is enabled and policies enforce `user_id = auth.uid()` on those tables.
- The client is using the anon key only (no service-role key in the browser).

## AI Studio auto-save fails (CORS or fetch errors)
Checklist:
- The provider URL allows browser fetches (some providers block cross-origin downloads).
- If blocked, consider a Supabase Edge Function proxy (requires an ADR) or store metadata only.

## “It works in dev but not in build”
Checklist:
- Run `npm -C frontend run build` and fix type errors first.
- Watch for accidental Node-only usage in the client (e.g., `fs`, server-only env vars).
