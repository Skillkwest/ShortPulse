# Next-Agent Handoff: Auth Session And Identity Projection

Lane id: `architecture-audit-06-auth-session-identity-projection`

Status: recommended after current customer-access invariants and overlapping auth work are fresh-read.

## Copy/Paste Assignment

Make authentication state truthful under transient refresh failures and definitive revocation, and decouple core signup access from Stripe projection. Preserve current login, confirmation, reset, and protected-route UX unless a change is required to represent a real state accurately.

## Required Context

Read first:

- `AGENTS.md` and startup spine
- auth, account bootstrap, Stripe customer, security, and email-confirmation SOPs/ADRs
- current production-operations policy

Inspect first:

- `frontend/lib/supabaseClient.ts`
- `frontend/features/auth/hooks/useProtectedRouteRestoreGuard.ts`
- auth callback/bootstrap routes and server helpers
- Stripe customer projection modules
- email-confirmation and password-reset routes/components
- profile/account creation services and their tests

## Confirmed Problems

- Session consumers do not consistently distinguish valid, temporarily unavailable, and definitively invalid state.
- A transient refresh failure can be treated like logout, while a definitive revocation needs immediate clearing.
- Signup/account bootstrap can couple core access to synchronous Stripe customer creation.
- Confirmed-email-to-Stripe projection lacks an explicit durable retry boundary.
- Password reset must confirm the email from the authenticated recovery user, not trust query or form input.

## Owned Write Surface

- canonical session-state result and protected-route handling
- auth bootstrap/callback behavior
- core account creation versus Stripe projection boundary
- confirmed-email durable outbox/retry worker if needed
- password-reset identity verification
- focused auth/session/projection tests and documentation

## Avoid Surface

- plan entitlement logic, owned by Lane 05
- privacy erasure, owned by Lane 08
- broad profile redesign
- emergency signup kill-switch unless current production evidence requires it

## Required Contract

1. Auth reads discriminate `valid`, `unavailable`, and `invalid`.
2. Transient provider/network failure preserves known-good UI state for a bounded interval and does not invent a valid session.
3. Definitive expiry/revocation clears access immediately.
4. Core user/profile creation succeeds independently of Stripe availability.
5. Stripe customer projection is idempotent, durably retried, and claims one stable customer identity.
6. Password reset authorizes changes only for the recovery session's confirmed `user.email`.
7. Any emergency signup gate is server-runtime controlled, documented, observable, and removable.

## Required Failure Tests

- refresh timeout versus invalid refresh token
- revoked session while a protected route is mounted
- duplicate auth callbacks and duplicate Stripe projection delivery
- Stripe unavailable during signup, then recovery
- reset link with mismatched submitted/query email
- multi-tab sign-out and restoration behavior

## Acceptance Criteria

- Transient auth unavailability does not masquerade as logout.
- Revoked users cannot retain protected access.
- Stripe outage does not block creation of the core ShortPulse account.
- Repeated projection attempts create or claim exactly one Stripe customer.
- Password reset cannot target an identity other than the recovery session user.

## Validation And Proof

- Run focused auth, callback, guard, bootstrap, Stripe projection, and reset tests.
- Add deterministic tests for transient versus definitive session outcomes.
- Use production-safe, non-mutating checks first; authenticated live proof must be explicitly labeled.
- Do not claim email-delivery or Stripe-projection closure from mocks alone.

## Stop Rules

- Stop if a current auth/security batch owns the same canonical files.
- Do not preserve access indefinitely when session authority is unavailable.
- Do not make Stripe the source of truth for authentication.
- Stop before deploy or customer-account mutation without authority.

