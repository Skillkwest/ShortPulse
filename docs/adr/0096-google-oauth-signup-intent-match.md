# ADR 0096: Google OAuth Signup Intent Match

## Status

Accepted

Extends: `docs/adr/0095-account-first-signup-intent-gate.md`

## Context

ADR 0095 made signup account-first while preserving an app-controlled Supabase Auth creation gate. The first implementation matched every signup intent by normalized email hash, including Google OAuth signup. That kept unknown OAuth accounts from bypassing ShortPulse-owned signup routes, but it forced the `/sign-up` Google button to ask for an email before opening Google.

The desired public signup experience is that clicking `Sign up with Google` starts the Google OAuth page immediately, matching the login flow. Supabase `signInWithOAuth` can pass provider query params such as `login_hint`, but it cannot attach arbitrary app metadata to the user record before the Before User Created hook runs. The hook can inspect the incoming user and request metadata before insertion.

## Decision

Keep email-hash signup intents as the default and safest match strategy. Add a Google-only fallback strategy for cases where the user starts OAuth before ShortPulse knows the Google account email:

- `/api/auth/signup-intent` may create a short-lived `google_ip` signup intent when `provider="google"` and no email is submitted.
- `google_ip` intents are scoped to the hashed client IP observed by the app route and expire faster than email-hash intents.
- Supabase Auth's Before User Created hook still requires a pending ShortPulse-created intent before insertion.
- The hook first tries the existing email-hash match. If that fails and the provider is Google, it may consume the newest pending `google_ip` intent for the hook request IP.
- When a valid email is already present on the signup form, Google signup continues to create an email-hash intent and passes `login_hint` to Google.
- Email/password signup remains email-hash-only.

## Consequences

- Positive: The signup Google button can open Google immediately without weakening email/password signup.
- Positive: Direct generic OAuth signup is still blocked unless a fresh app-created intent exists.
- Positive: Typed-email Google signup keeps the stricter email-hash match and can hint the same email to Google.
- Tradeoff: IP-bound matching is less precise than email-hash matching for users behind shared NATs or unstable networks.
- Mitigation: The IP-bound path is Google-only, short-lived, and consumed once by the hook before an Auth row can be created.
- Production rollout requires applying `sql/migrations/167_add_google_ip_signup_intent.sql`, deploying the matching app code, and proving both blank-email and typed-email Google signup through the production URL.
