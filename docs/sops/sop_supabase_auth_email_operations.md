# Supabase Auth Email Operations

Purpose: operate ShortPulse auth email delivery safely when Supabase Auth uses a custom SMTP provider.

## Scope

- Signup confirmation email
- Password reset email
- Email-change confirmation email
- Supabase Auth SMTP configuration
- Callback-origin validation for auth email links

## Current architecture

ShortPulse keeps Supabase Auth as the system of record for email/password auth flows.

- Signup confirmation starts in `frontend/pages/auth.tsx`.
- Password reset starts in `frontend/pages/auth.tsx` and `frontend/pages/profile.tsx`.
- Password reset completion happens in `frontend/pages/auth/callback.tsx`.
- Email-change confirmation starts in `frontend/pages/api/account/email/update.ts` and finishes in `frontend/pages/api/account/email/confirm.ts`.
- Callback URLs are generated from the server-owned origin contract in `frontend/pages/api/auth/callback-url.ts` and `frontend/lib/authRedirects.ts`.

This repo does not maintain a separate SMTP abstraction. The intended posture is:

1. Keep Supabase Auth flows.
2. Swap only the SMTP transport underneath Supabase Auth.
3. Keep SMTP credentials in Supabase Auth configuration, not in `frontend/.env.local` or Vercel project envs.

## Interim provider posture

ShortPulse’s interim SMTP provider is Google Workspace.

Important constraint:

- This is an interim transport choice, not the long-term recommended transactional-email posture.
- Google Workspace must pass one exact pre-production dry run host, if used, and the final production smoke tests before launch signoff.
- If Google Workspace auth policy or deliverability posture blocks the rollout, stop and move to a dedicated transactional provider instead of building a custom app-side mailer.

## External constraints

- Supabase’s built-in SMTP service is not for production use and only allows non-team recipients once custom SMTP is configured.
- After custom SMTP is enabled, Supabase still starts with a low auth-email rate limit and requires explicit rate-limit tuning.
- Google Workspace SMTP relay supports high enough volume for this launch window, but Google positions it as a relay service for devices and applications rather than a dedicated transactional-email platform.

Primary references:

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Google Workspace SMTP relay](https://support.google.com/a/answer/2956491?hl=en)
- [Google Workspace less-secure-apps to OAuth transition](https://support.google.com/a/answer/14114704?hl=en)

## Prerequisites

- Paid Google Workspace account for the sending domain
- A dedicated sender identity such as `no-reply@shortpulse.ai`
- `APP_BASE_URL` correctly set for the target environment
- Supabase redirect allowlist includes:
  - `http://localhost:3000/auth/callback`
  - one exact non-production validation callback URL if a dry run host is used
  - `https://www.shortpulse.ai/auth/callback`

Recommended sender-account posture:

1. Use one dedicated Google Workspace sender identity only for auth email.
2. Choose one exact Google Workspace SMTP path and prove it end to end against Supabase Auth.
3. Do not mix mailbox-auth guidance with SMTP-relay guidance in one rollout plan.
4. If the chosen Google Workspace auth path cannot be used cleanly by Supabase without policy workarounds, stop and move to a dedicated SMTP vendor.

## Workflow

### 1. Confirm public-origin authority first

Before touching SMTP settings, verify the auth callback host contract:

- `APP_BASE_URL` is the canonical public-origin authority.
- If `SHORTPULSE_PUBLIC_API_BASE_URL` is set, it exactly matches `APP_BASE_URL`.
- Production must resolve to `https://www.shortpulse.ai`.

References:

- [`docs/adr/0078-public-origin-authority-contract.md`](../adr/0078-public-origin-authority-contract.md)
- [`docs/deployment.md`](../deployment.md)

### 2. Choose and validate the Google Workspace SMTP path

In Google Admin:

1. Decide which exact Google Workspace SMTP approach you are attempting.
2. Confirm it can be represented through Supabase’s SMTP host/port/user/pass settings.
3. Restrict the sender scope to the intended ShortPulse auth identity and domain.
4. Require TLS where supported.
5. Record the exact Google Admin settings outside this repo once the final Workspace details are known.

Current repo guidance:

- Avoid broad `Any addresses` relay posture unless there is a documented reason.
- Do not create an app-side mail relay or proxy in Next.js to compensate for relay-policy friction.

Inference from the Google and Supabase docs:

- Because Supabase exposes a conventional SMTP host/port/user/pass surface rather than OAuth-based Gmail integration, Google Workspace SMTP needs to be proven with a real smoke test before it is considered launch-ready.
- If the chosen Google Workspace path cannot be expressed cleanly through that conventional SMTP surface, this rollout is blocked.

### 3. Configure Supabase Auth custom SMTP for production

Configure custom SMTP in the Supabase dashboard or via the Supabase Management API.

Required config fields:

- `external_email_enabled = true`
- `mailer_secure_email_change_enabled = true`
- `mailer_autoconfirm = false`
- `smtp_admin_email = no-reply@shortpulse.ai`
- `smtp_host = <final-google-workspace-smtp-host>`
- `smtp_port = <final-google-workspace-smtp-port>`
- `smtp_user = <final-google-workspace-smtp-user>`
- `smtp_pass = <final-google-workspace-smtp-password-or-secret>`
- `smtp_sender_name = ShortPulse`

Do not store SMTP credentials in:

- `frontend/.env.local`
- `frontend/.env.example`
- Vercel project envs
- ad-hoc temp files inside the repo

### 4. Raise Supabase auth-email limits before launch

Supabase’s post-custom-SMTP default is too low for a launch burst.

Minimum posture for this repo:

1. Raise the combined email-send rate limit above the default `30/hour`.
2. Keep per-user cooldowns in place unless there is a concrete reason to change them.
3. Pair any project-wide rate increase with a concrete surge or abuse-response posture.

Recommended launch target for current planning:

- Set the project-wide combined auth-email limit to at least `300/hour`.
- Prefer `500/hour` to `600/hour` if a public launch or announcement can compress demand into one short window.

This target is a repo recommendation based on the stated launch goal of roughly 300 to 500 users. It is not a provider-published requirement.

### 5. Validate sender-domain posture

Before any production cutover:

1. Verify SPF for the auth sender domain.
2. Verify DKIM for the auth sender domain.
3. Publish or confirm DMARC for the auth sender domain.
4. Confirm the visible From address matches the intended ShortPulse domain identity.

### 6. Run one exact non-production dry run if needed

If a non-production dry run is used, it must use one exact allowlisted external host. Do not rely on arbitrary preview URLs.

Required dry-run checks:

1. `GET /api/auth/callback-url?flow=recovery&next=%2Fdashboard` resolves to the chosen non-production host.
2. Fresh signup email arrives and links back to that host.
3. Fresh password reset email arrives and links back to that host.
4. Fresh email-change confirmation arrives and links back to that host.
5. Password reset completes successfully on `/auth/callback`.
6. Email-change completion successfully triggers downstream Stripe identity sync.

### 7. Run production smoke tests

Required production checks:

1. `GET /api/auth/callback-url?flow=recovery&next=%2Fdashboard` resolves to `https://www.shortpulse.ai/auth/callback?...`
2. Fresh signup email arrives and links back to `https://www.shortpulse.ai`.
3. Fresh password reset email arrives and links back to `https://www.shortpulse.ai`.
4. Fresh email-change confirmation arrives and links back to `https://www.shortpulse.ai`.
5. Auth emails land in the inbox for at least Gmail and Outlook smoke accounts.
6. If the launch rate limit was raised, confirm the launch surge-control posture is ready before opening public demand.

### 8. Rollback posture

Rollback immediately if:

- Auth links resolve to the wrong host
- Messages stop sending
- Messages start landing in spam at unacceptable rates
- Email-change confirmation breaks Stripe identity sync

Rollback options:

1. Restore the last-known-good Supabase SMTP config.
2. Reduce public signup exposure while auth email is unstable.
3. Cut over to a dedicated transactional SMTP provider instead of building repo-side email infrastructure.

## Error handling

Common failure classes:

- Wrong callback host because `APP_BASE_URL` or redirect allowlist is wrong
- Google Workspace relay auth/policy rejection
- Supabase auth-email rate limit too low for launch traffic
- Email-change callback succeeds in Auth but downstream Stripe sync fails

When debugging:

1. Verify callback URL resolution first.
2. Verify Supabase Auth SMTP configuration second.
3. Verify Google Workspace relay policy third.
4. Verify email-change post-confirmation sync last.

## Maintenance

- Re-run preview and production auth-email smoke tests whenever:
  - `APP_BASE_URL` changes
  - auth templates change
  - Google Workspace relay settings change
  - Supabase SMTP credentials rotate
- Treat SMTP credential rotation as a controlled operation with immediate smoke tests afterward.
- Reassess the provider choice before the next major growth step beyond this launch window.
