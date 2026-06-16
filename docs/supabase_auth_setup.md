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

Pre-launch production signup posture:

- Keep `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED` unset or set to anything other than `true` unless a paid-checkout-first signup launch has been explicitly approved.
- In the Supabase production project, keep Auth public signup disabled (`disable_signup=true`) so direct calls to Supabase Auth cannot create non-Stripe accounts.
- Verify the provider-level state with:
  ```bash
  cd frontend
  npm run auth:signup-config -- --project-ref <production-project-ref>
  ```
- If an approved operator needs to close the provider-level gate through the Management API, use:
  ```bash
  cd frontend
  npm run auth:signup-config -- --project-ref <production-project-ref> --apply-disable-signup --confirm-disable-signup <production-project-ref>
  ```
  This requires `SUPABASE_ACCESS_TOKEN` or `SUPABASE_MANAGEMENT_API_TOKEN` with auth config write permission and must not print or store the token.

ShortPulse keeps SMTP credentials out of the Next.js app runtime. When you enable custom SMTP for auth email, configure the SMTP host, user, password, and sender identity in Supabase Auth, not in `frontend/.env.local` or Vercel project envs. See [`docs/sops/sop_supabase_auth_email_operations.md`](./sops/sop_supabase_auth_email_operations.md) for the current rollout procedure and the interim Google Workspace posture.

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

Role-based admin access for `/admin` APIs:

- Set `role` to `admin` or `operator` in `raw_app_meta_data` on `auth.users`.
- Do not use `raw_user_meta_data` for admin authorization.
- Sign out and sign back in after metadata changes so JWT claims are refreshed.

## Supabase client initialization

- Browser/client calls should use `frontend/lib/supabaseClient.ts` (anon key only).
- Server-side admin operations should use a service-role client (`frontend/lib/server/api/supabaseAdmin.ts`).
- Add the exact callback URL path you use in the app to the Supabase redirect allowlist. ShortPulse now expects `/auth/callback` to be allowed for signup confirmation, password reset, and email-change confirmation flows. Local development should allow `http://localhost:3000/auth/callback`, any non-production dry run should use one exact allowlisted external host, and production should allow `https://www.shortpulse.ai/auth/callback`.
- If you use custom SMTP for production, raise Supabase Auth email rate limits above the default post-setup baseline before launch. The repo’s current launch planning assumes a higher limit than the Supabase default. See [`docs/sops/sop_supabase_auth_email_operations.md`](./sops/sop_supabase_auth_email_operations.md).

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
7. Verify admin access works for one operator account with the expected `raw_app_meta_data` role.
