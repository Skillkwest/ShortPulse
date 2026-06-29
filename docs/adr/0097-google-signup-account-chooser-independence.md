# ADR 0097: Google Auth Account Chooser Independence

## Status

Accepted

Amends: `docs/adr/0096-google-oauth-signup-intent-match.md`

## Context

ADR 0096 allowed typed-email Google signup to create an email-hash intent and pass `login_hint` to Google. The sign-in route also passed `login_hint` when a valid email was present. That made the signup intent stricter and gave sign-in a convenient hint, but it coupled Google OAuth buttons to whatever browser autofill placed in the email/password fields.

That coupling is wrong for the customer experience. Google auth buttons should mean "choose the Google account to use," even when an old email/password pair is already populated in the form. Signup should not steer the user into the prefilled email account or reject a different selected Google account because the form field created a mismatched email-hash intent. Sign-in should not automatically prefer the prefilled email account either.

## Decision

Google OAuth initiation ignores the visible email/password fields.

- In signup mode, `Sign up with Google` creates the Google-only short-lived `google_ip` signup intent by omitting `email` from `/api/auth/signup-intent`.
- In signin and signup modes, the OAuth request uses `prompt=select_account` and does not pass `login_hint`.
- Email/password signup remains email-hash-only and continues to use the visible form fields.
- Email/password sign-in continues to use the visible form fields only when the user submits the email/password form.
- The Supabase Before User Created hook remains the account-creation gate. It may consume an email-hash intent first if one exists from another path, then the Google/IP-bound intent for Google signup.

## Consequences

- Positive: Autofilled email/password fields no longer hijack Google signup or sign-in.
- Positive: Users can intentionally choose a different Google account from the Google account chooser.
- Positive: Email/password signup keeps the stricter email-hash gate.
- Tradeoff: Google signup relies on the less precise short-lived Google/IP-bound intent even when the email field happens to contain a valid address.
- Mitigation: The IP-bound path remains Google-only, short-lived, single-use, and still enforced before `auth.users` insertion.
