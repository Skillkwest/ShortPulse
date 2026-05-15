# ADR 0079: Supabase Auth Email Transport via Google Workspace (Interim)

- Date: 2026-05-14
- Status: Proposed
- Deciders: Frontend Engineering
- Related:
  - [`docs/supabase_auth_setup.md`](../supabase_auth_setup.md)
  - [`docs/deployment.md`](../deployment.md)
  - [`docs/release-checklist.md`](../release-checklist.md)
  - [`docs/sops/sop_supabase_auth_email_operations.md`](../sops/sop_supabase_auth_email_operations.md)

## Context

ShortPulse already uses Supabase Auth for:

- signup confirmation
- password reset
- email-change confirmation

The repo’s current auth flow, callback handling, and billing side effects all depend on Supabase Auth remaining the system of record. Replacing Supabase Auth email flows with an app-owned mailer would be a larger auth-architecture migration than this launch lane requires.

Supabase’s built-in SMTP service is not production-ready. The project needs custom SMTP before launch.

The team wants to begin with Google Workspace for SMTP, while preserving the option to move to a dedicated transactional provider later.

## Decision

1. ShortPulse keeps Supabase Auth as the auth system of record.
2. ShortPulse swaps only the SMTP transport underneath Supabase Auth.
3. The intended interim SMTP transport is Google Workspace, pending proof that one exact Google Workspace SMTP path works cleanly with Supabase Auth.
4. SMTP credentials and sender configuration live in Supabase Auth configuration, not in Next.js runtime env files or Vercel envs.
5. `APP_BASE_URL` remains the canonical public-origin authority for auth email callbacks.
6. Google Workspace is treated as an interim solution that must pass one exact non-production dry run host, if used, and the final production smoke tests before launch signoff.
7. If Google Workspace relay policy or deliverability posture becomes a blocker, the fallback is a dedicated transactional SMTP provider, not a custom app-side email service.

## Consequences

Positive:

1. No auth-flow rewrite is required.
2. Existing signup, password reset, and email-change code paths remain valid.
3. SMTP secrets stay out of the app runtime and out of Vercel env management.
4. The repo can harden operations around one clear auth-email runbook.

Tradeoffs:

1. Google Workspace is not the cleanest long-term transactional-email platform for this use case.
2. Supabase custom SMTP still needs explicit rate-limit tuning before launch.
3. Google Workspace auth-policy friction must be validated in real smoke tests because Supabase exposes conventional SMTP settings rather than OAuth-based Gmail integration.
4. The team must keep a clear exit path to a dedicated transactional provider if growth or deliverability requirements outgrow the interim posture.

## Validation

This decision is implemented correctly when:

1. If a non-production dry run host is used, signup, password reset, and email-change emails all arrive and link back to that one exact allowlisted host.
2. Production signup, password reset, and email-change emails all arrive and link back to `https://www.shortpulse.ai`.
3. Supabase custom SMTP is enabled and auth-email rate limits are raised above the default launch-inadequate baseline.
4. SMTP credentials are not added to `frontend/.env.local`, `frontend/.env.example`, or Vercel project envs.
5. The operational runbook in `docs/sops/sop_supabase_auth_email_operations.md` is followed for rollout and rotation.
