# ADR 0039: Media Library Transform Sunset and Local Derivative Engine

## Status

Accepted

Runtime policy note (2026-05-30): [ADR 0087](./0087-supabase-image-transformation-prohibition.md) supersedes the earlier “disabled by default” posture for runtime transforms. Supabase image transformations are now prohibited on all paths.

## Context

Media Library preview and derivative paths depended on Supabase signed transforms. This created avoidable coupling to transform quotas and operational churn under heavy image libraries.

Historical context:

- The earlier migration objective was to eliminate transform dependence from hot paths first while preserving route and worker stability.

We needed to:

- preserve current route contracts and fallback behavior,
- eliminate transform dependence without widening scope or replacing stable contracts prematurely,
- keep current DB/RPC contracts (`065`/`066`) intact,
- avoid introducing a new external processing service.

## Decision

1. Supabase signed preview transforms are prohibited at runtime.
   - Existing dual-flag policy remains only as deny-only compatibility scaffolding:
     - `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED`
     - `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED`
   - Their only supported runtime value is `false`.
2. Derivative generation is transformed from Supabase-render fetches to local Node processing with `sharp`.
   - Worker route remains `/api/internal/media-derivatives/run`.
   - Claim/update RPC contracts remain unchanged.
   - Image variants `thumb_240` and `thumb_480` are generated locally and uploaded to the existing variant paths.
3. Terminal error semantics move to deterministic local classes:
   - `unsupported_input`
   - `decode_failed`
   - `upload_failed`
   - `variant_upsert_failed`

## Consequences

- Positive:
  - Preview and derivative hot paths no longer rely on Supabase transforms.
  - Existing list/sign/resolve and worker APIs stay stable.
  - Derivative pipeline becomes easier to reason about and debug.
- Negative:
  - API runtime now depends on `sharp` in Node deployment environments.
  - Worker CPU/memory footprint shifts to app runtime.
- Follow-ups:
  - Monitor derivative backlog drain and terminal failure mix after rollout.
  - Retire legacy transform compatibility flags once runtime code and env contracts no longer depend on them.

## Alternatives considered

- Keep Supabase transforms and tune quotas.
  - Rejected: preserves cost/risk source and does not simplify operations.
- Build external media-processing worker service.
  - Rejected: higher complexity and migration overhead for current scope.
