# ADR 0078: Public Origin Authority Contract

- Date: 2026-05-14
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/deployment.md`
  - `docs/local-development.md`
  - `docs/release-checklist.md`
  - `docs/supabase_auth_setup.md`

## Context

ShortPulse had drifted into multiple public-origin authorities:

1. Auth callback URLs resolved from `APP_BASE_URL` plus request-host fallbacks.
2. Fal/public callback registration resolved from `SHORTPULSE_PUBLIC_API_BASE_URL ?? APP_BASE_URL`.
3. Stripe redirects used `APP_BASE_URL` directly.

That allowed the same deployment to generate different outward-facing hosts for password-reset, signup confirmation, email-change confirmation, Stripe redirects, and provider callback registration. It also created contradictory operator guidance because docs and validators did not agree on whether `SHORTPULSE_PUBLIC_API_BASE_URL` was required, optional, or allowed to differ from `APP_BASE_URL`.

## Decision

ShortPulse now treats public origin as one runtime contract:

1. `APP_BASE_URL` is the canonical public-origin authority for server-generated URLs.
2. `SHORTPULSE_PUBLIC_API_BASE_URL` is optional compatibility wiring only.
3. When `SHORTPULSE_PUBLIC_API_BASE_URL` is set, it must match `APP_BASE_URL` exactly.
4. Production public-origin resolution is fail-closed and must normalize to `https://www.shortpulse.ai`.
5. Preview and local resolution must not silently reuse a stale canonical env when the live request host is the correct externally reachable host.

## Consequences

Positive:

1. Auth, Stripe, and Fal/public callback producers now share one public-origin contract.
2. Deployed env validation can hard-fail split-origin misconfigurations instead of warning on them.
3. Preview host verification becomes a release requirement, not an implicit assumption.

Tradeoffs:

1. Existing deployments with split `APP_BASE_URL` and `SHORTPULSE_PUBLIC_API_BASE_URL` must be repaired before passing the updated env contract.
2. Legacy docs and tests that encoded fallback behavior must be updated alongside runtime helpers.

## Validation

The decision is implemented correctly when:

1. Auth callback URLs, Stripe redirects, and Fal/public callback registration all resolve from the same effective origin.
2. Deployed env validation fails when `APP_BASE_URL` and `SHORTPULSE_PUBLIC_API_BASE_URL` differ.
3. Preview auth callback verification confirms preview emails use the preview host.
4. Production auth callback verification confirms production emails use `https://www.shortpulse.ai`.
