# Security Checklist

Purpose: ensure user isolation and authenticated access across the frontend-only stack.

## Current expectations
- Supabase client uses persisted sessions and auto-refresh tokens.
- Frontend redirects authenticated sessions to the dashboard after sign-in/sign-up.

## Required controls
- **RLS**: Enable Row-Level Security on Supabase tables; policies should enforce `user_id = auth.uid()` for select/insert/update/delete on user-owned tables (`saved_creators`, `media_files`, `media_prompts`, `ai_generations`). `media_events` allows select + insert only.
- **Storage isolation**: Keep the `media_library` bucket private; require folder prefixes that start with `auth.uid()` (see `sql/storage_policies.sql`).
- **Frontend route protection**: Guard dashboard/performance/saved-creators/media-library/profile; redirect unauthenticated users to `/auth`.
- **Key management**: Never expose the service-role key. Use only the anon key in the browser.
- **Network calls**: All Supabase requests already include the user’s JWT; avoid any other unauthenticated calls for user-owned data.

## Validation
- Periodically test RLS with different users to confirm isolation.
- Manually verify unauthenticated visitors cannot reach gated routes and cannot list/upload media.
