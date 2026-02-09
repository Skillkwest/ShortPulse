# Supabase Auth & Client Setup

Use this guide to configure Supabase safely for local development.

## Required environment variables
Create `frontend/.env.local` (not committed):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

For server-side API routes, configure a private environment variable (never exposed to the browser):
```bash
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Optional admin allowlist for `/admin` APIs:
```bash
SHORTPULSE_ADMIN_EMAILS=admin@example.com,ops@example.com
```

Optional role-based admin access (without email allowlist):
- Set `role` to `admin` or `operator` in either `raw_app_meta_data` or `raw_user_meta_data` on `auth.users`.
- Sign out and sign back in after metadata changes so JWT claims are refreshed.

## Supabase client initialization
- Browser/client calls should use `frontend/lib/supabaseClient.ts` (anon key only).
- Server-side admin operations should use a service-role client (`frontend/pages/api/_utils/supabaseAdmin.ts`).

## Security requirements
- Never commit real keys to docs, code, or `.env.example`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Keep user data isolated with RLS and user-scoped storage paths (`auth.uid()` prefix).

## Validation checklist
1. Sign up and sign in successfully from `/auth`.
2. Verify protected routes redirect to `/auth` when signed out.
3. Verify user-scoped data is isolated across two test users.
4. Verify billing/credit tables (`billing_profiles`, `ai_credit_balance`, `ai_credit_ledger`) obey RLS.
5. Verify admin access works for one operator account (role metadata or `SHORTPULSE_ADMIN_EMAILS`).
