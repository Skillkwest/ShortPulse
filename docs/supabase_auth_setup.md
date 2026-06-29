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

Account-first signup launch posture:

- `/sign-up` and `/log-in` are the canonical public auth entry pages. Public dashboard signup, launch, and create-project actions should route to `/sign-up?next=/ai-studio`; logged-out paid plan actions should route to `/sign-up` and preserve the selected `/pricing?...&plan=<starter|media|studio|business>` return path.
- ShortPulse public signup is open by default at the app layer. Set `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED=false` only as an emergency app-level close switch; when false, the signup page and `/api/auth/signup-intent` refuse account creation.
- In the Supabase production project, Auth public signup may be enabled (`disable_signup=false`) only when `public.hook_shortpulse_signup_intent(event jsonb)` is enabled and verified, so direct calls to Supabase Auth or enabled OAuth providers cannot create non-intended accounts.
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

- Apply `sql/migrations/164_add_paid_signup_intent_gate.sql`, `sql/migrations/165_account_first_signup_intent_gate.sql`, `sql/migrations/166_grant_signup_hook_schema_usage.sql`, and `sql/migrations/167_add_google_ip_signup_intent.sql` before enabling public signup. Migration `165` generalizes the signup intent contract and creates the canonical `hook_shortpulse_signup_intent(event jsonb)` hook, while retaining a compatibility wrapper for the prior hook name. Migration `167` lets Google signup start before the app knows the Google account email by adding a short-lived Google/IP-bound intent fallback.
- In Supabase Auth Hooks, configure the **Before User Created** hook to call `public.hook_shortpulse_signup_intent`. The hook must be enabled before `disable_signup=false` is allowed in production.
- Keep app signup gated to either an account-first `/ai-studio` return path or a paid `/pricing?...&plan=<starter|media|studio|business>` return path. `/api/auth/signup-intent` creates a 30-minute hashed-email intent for email/password signup, or a shorter Google/IP-bound intent for Google signup, unless the emergency app-level close switch is `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED=false`. Paid pricing intents require the selected plan to have an active acquisition offer with a Stripe price; account-first intents do not create a paid entitlement.
- Email/password signup and Google signup both create the signup intent before calling Supabase Auth. The hook accepts only `email` and `google` providers and rejects direct Auth/OAuth creation attempts without a matching fresh intent. Email/password signup uses the email-hash match. Google signup ignores visible email/password form fields, asks Google to show account selection, and uses the short-lived Google/IP-bound match from ADR 0097.
- Signup intent approval is not billing entitlement. New Auth users still receive only the zero-value hidden baseline profile from `handle_new_user_billing_setup`; `/api/account/bootstrap` may create or sync a real Stripe customer identity, but customer identity is not subscription state.
- The correct account-first posture is: successful signup creates a real active Supabase user, a real active Stripe customer identity, and AI Studio navigation access with exactly zero credits. Signup, login, account bootstrap, Stripe customer sync, and AI Studio access must never mint credits or grant generation entitlement.
- Credits may enter an account only through Stripe-backed subscription/webhook projection or an approved credit top-up flow for an established paying account. Zero-credit users can enter AI Studio, but billable generation or creation must fail closed at submit time until paid billing authority funds the account.
- After the hook is enabled and verified, confirm the hosted signup switch with:
  ```bash
  cd frontend
  npm run auth:signup-config -- --project-ref <production-project-ref> --expect-enabled
  ```

Google auth posture:

- ShortPulse may expose Google on `/log-in` for sign-in and `/sign-up` for account-first or paid signup. Google acquisition requires the Supabase-side Before User Created hook above so OAuth-created users without a valid signup intent are rejected before an `auth.users` row is inserted.
- Do not enable Google as an ungated generic public signup path. Unknown Google accounts may create users only through `/sign-up` after `/api/auth/signup-intent` creates a matching fresh intent. The button may open Google immediately; the database hook still blocks Auth insertion unless it can consume the short-lived Google/IP-bound intent.
- Configure Google Cloud OAuth with `https://www.shortpulse.ai` as the production JavaScript origin and the Supabase project callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as the authorized redirect URI.
- Configure Google Auth Platform branding before launch so the consent screen is ShortPulse-owned: app name `ShortPulse`, a monitored support email, homepage `https://www.shortpulse.ai`, privacy policy `https://www.shortpulse.ai/privacy`, terms `https://www.shortpulse.ai/terms`, and authorized domain `shortpulse.ai`. Add the ShortPulse logo only when ready for Google brand verification, because app-name/logo changes may wait on Google's review before they appear to users.
- Configure a Supabase custom auth domain such as `auth.shortpulse.ai` before public Google launch if the Google consent screen still exposes the raw Supabase project host. Follow Supabase's custom-domain DNS/SSL verification flow, then add `https://auth.shortpulse.ai/auth/v1/callback` to the Google OAuth client authorized redirect URIs while keeping `https://<project-ref>.supabase.co/auth/v1/callback` during the transition. Remove the project-ref redirect URI only after hosted production Google OAuth proof is clean.
- In Supabase Auth, enable the Google provider only after adding the Google client ID/secret and confirming the production redirect allowlist includes `https://www.shortpulse.ai/auth/callback`.
- Verify and, when the required Management API token plus Google OAuth credentials are available, apply the narrow hosted-provider patch with:
  ```bash
  cd frontend
  npm run auth:google-config -- --project-ref <production-project-ref>
  npm run auth:google-config -- --project-ref <production-project-ref> --apply-enable-google --apply-redirect-url --confirm-enable-google <production-project-ref>
  ```
  This command summarizes only credential presence and provider state; it must not print the Management API token, Google client secret, or raw auth config.
- ShortPulse marks Google OAuth callback URLs with `provider=google`. If the user cancels or backs out of Google before a session is established, `/auth/callback` returns them to `/log-in` or `/sign-up` with a calm `Google sign-in was canceled.` message. Email confirmation, password recovery, and email-change callbacks must continue to fail closed when their callback artifacts are missing or invalid.

Suspicious account removal posture:

- Inventory unknown or non-Stripe users before deletion:
  ```bash
  cd frontend
  npm run auth:audit-non-stripe-accounts -- --email <target-email>
  ```
- Treat `zero_footprint_auth_delete_candidate` as safe to remove through the Auth-root admin delete path after operator approval.
- Treat `owned_footprint_cleanup_required_before_auth_delete` and `stripe_review_required_before_delete` as requiring cleanup/reconciliation review before Auth deletion.
- Do not manually delete random app rows first; the Auth user is the identity root, and owned storage/provider artifacts must be checked explicitly.

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

- Browser/client calls should use `frontend/lib/supabaseClient.ts` (anon key only). The primary browser client must keep `auth.flowType = "pkce"` so new signup, sign-in, recovery, email-change, and OAuth callbacks use authorization codes instead of bearer-token URL fragments.
- Server-side admin operations should use a service-role client (`frontend/lib/server/api/supabaseAdmin.ts`).
- Add the exact callback URL path you use in the app to the Supabase redirect allowlist. ShortPulse now expects `/auth/callback` to be allowed for signup confirmation, password reset, email-change confirmation, and Google sign-in completion flows. Local development should allow `http://localhost:3000/auth/callback`, any non-production dry run should use one exact allowlisted external host, and production should allow `https://www.shortpulse.ai/auth/callback`.
- After any PKCE or hosted-provider auth change, smoke email/password confirmation, password recovery, email-change confirmation, Google sign-in, and Google signup against the target hosted environment. Treat any remaining token-fragment callback support as migration compatibility with a removal condition, not as the preferred browser auth flow.
- If you use custom SMTP for production, raise Supabase Auth email rate limits above the default post-setup baseline before launch. The repo’s current launch planning assumes a higher limit than the Supabase default. See [`docs/sops/sop_supabase_auth_email_operations.md`](./sops/sop_supabase_auth_email_operations.md).

## Security requirements

- Never commit real keys to docs, code, or `.env.example`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Keep user data isolated with RLS and user-scoped storage paths (`auth.uid()` prefix).

## Validation checklist

1. With `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED=false` or Supabase `disable_signup=true`, verify an unknown email/password and unknown Google account cannot create a new Supabase Auth user.
2. In a staging or approved production launch window, enable the Before User Created hook, set `disable_signup=false`, leave `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED` unset or set to `true`, and verify email/password signup from `/sign-up?next=/ai-studio` creates a zero-value account, bootstraps a Stripe customer through `/api/account/bootstrap`, and returns through `/auth/callback`.
3. Verify Google signup from `/sign-up` opens Google when the email field is blank, creates a zero-value account through the short-lived Google/IP-bound intent, and returns through `/auth/callback?flow=signup&provider=google`.
4. Verify Google signup from `/sign-up` with prefilled email/password fields still shows Google account selection, does not pass `login_hint`, creates the Google/IP-bound intent, and allows the selected Google account to define the signup identity.
5. Verify paid plan signup continues to `/pricing` and `/api/billing/subscription/change` opens Stripe Checkout before any paid entitlement is granted.
6. Verify password reset emails return to `/auth/callback` and allow `updateUser({ password })` completion.
7. Verify protected routes redirect to `/log-in` when signed out and preserve a safe `next` return path.
8. Verify email-change confirmation returns through `/auth/callback` and only then syncs downstream billing identity.
9. Verify Google sign-in from `/log-in` with prefilled email/password fields still shows Google account selection, does not pass `login_hint`, allows the selected existing approved Google account to sign in, and returns through `/auth/callback?flow=signin&provider=google`.
10. Verify canceling/backing out of Google OAuth returns to `/log-in` or `/sign-up` with `Google sign-in was canceled.` and does not render the invalid-link callback page.
11. Verify user-scoped data is isolated across two test users.
12. Verify billing/credit tables (`billing_profiles`, `ai_credit_balance`, `ai_credit_ledger`) obey RLS.
13. Verify admin access works for one operator account with the expected `raw_app_meta_data` role.
