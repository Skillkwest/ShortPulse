# Security Checklist

Purpose: ensure user isolation and authenticated access across frontend and backend.

## Current expectations
- Supabase client uses persisted sessions and auto-refresh tokens.
- Frontend redirects authenticated sessions to the dashboard after sign-in/sign-up.

## Required controls
- **Auth on API routes**: Require Supabase JWT on every FastAPI endpoint. Verify server-side and reject missing/invalid tokens.
- **User scoping**: Carry `user_id` from JWT claims and filter queries by `user_id` for user-owned data.
- **RLS**: Enable Row-Level Security on Supabase tables; policies should enforce `user_id = auth.uid()` for select/insert/update/delete on user-owned tables.
- **Public/shared data**: If any tables are public, define explicit read-only policies; default to deny.
- **Frontend route protection**: Guard dashboard/performance/saved-creators/media-library; redirect unauthenticated users to `/auth`.
- **Key management**: Never expose service-role keys to the client. Use anon key on frontend; keep service-role server-side only.
- **Network calls**: Always include the user’s JWT when calling protected APIs from the frontend.

## Validation
- Add automated checks (lint/tests) for missing auth on new routes.
- Periodically test RLS with different users to confirm isolation.
