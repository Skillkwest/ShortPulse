# Supabase Auth & Client Setup

Use this guide to configure Supabase safely for local development and hosted auth flows.

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

Set the canonical app origin used by server-generated auth emails:

```bash
APP_BASE_URL=http://localhost:3000
```

Client-initiated signup and password-reset flows now resolve their absolute callback URL through the server-owned `/api/auth/callback-url` route before calling Supabase, so `APP_BASE_URL` should always reflect the real public origin users should open from email for the environment you are configuring.

Hosted environment examples:

```bash
# Preview
APP_BASE_URL=https://<your-preview-host>

# Production
APP_BASE_URL=https://www.shortpulse.ai
```

Optional compatibility mirror:

```bash
SHORTPULSE_PUBLIC_API_BASE_URL=<same value as APP_BASE_URL>
```

When `SHORTPULSE_PUBLIC_API_BASE_URL` is set, it must match `APP_BASE_URL`.

Optional admin allowlist for `/admin` APIs:

```bash
SHORTPULSE_ADMIN_EMAILS=admin@example.com,ops@example.com
```

Optional role-based admin access (without email allowlist):

- Set `role` to `admin` or `operator` in `raw_app_meta_data` on `auth.users`.
- Do not use `raw_user_meta_data` for admin authorization.
- Sign out and sign back in after metadata changes so JWT claims are refreshed.

## Supabase client initialization

- Browser/client calls should use `frontend/lib/supabaseClient.ts` (anon key only).
- Server-side admin operations should use a service-role client (`frontend/lib/server/api/supabaseAdmin.ts`).
- Add the exact callback URL path you use in the app to the Supabase redirect allowlist. ShortPulse now expects `/auth/callback` to be allowed for signup confirmation, password reset, and email-change confirmation flows. Local development should allow `http://localhost:3000/auth/callback`, preview should allow the preview host callback URL, and production should allow `https://www.shortpulse.ai/auth/callback`.

## Security requirements

- Never commit real keys to docs, code, or `.env.example`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Keep user data isolated with RLS and user-scoped storage paths (`auth.uid()` prefix).

## Validation checklist

1. Sign up successfully from `/auth` and confirm the email through `/auth/callback`.
2. Verify password reset emails return to `/auth/callback` and allow `updateUser({ password })` completion.
3. Verify protected routes redirect to `/auth` when signed out and preserve a safe `next` return path.
4. Verify email-change confirmation returns through `/auth/callback` and only then syncs downstream billing identity.
5. Verify user-scoped data is isolated across two test users.
6. Verify billing/credit tables (`billing_profiles`, `ai_credit_balance`, `ai_credit_ledger`) obey RLS.
7. Verify admin access works for one operator account (`raw_app_meta_data` role or `SHORTPULSE_ADMIN_EMAILS`).
