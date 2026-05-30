# ADR 0036: Media Library Signed Preview Delivery and Next Optimizer Bypass

## Status

Accepted

## Status Note (2026-03-18)

ADR 0036 remains accepted as the stabilization decision that removed the dominant signed-URL `/_next/image` failure path on Media Library card surfaces.

Runtime policy note (2026-05-30): [ADR 0087](./0087-supabase-image-transformation-prohibition.md) supersedes the transform-profile portions of this ADR. Media Library signing still bypasses `/_next/image` for signed storage URLs, but Supabase image transformations are prohibited on every runtime path. Signing routes must return signed originals or durable variants, never Supabase transform-backed URLs.

Current steady-state direction is further defined by:

- [ADR 0039](./0039-media-library-transform-sunset-and-local-derivative-engine.md), which sunsets transform-dependent hot-path delivery by default
- [ADR 0044](./0044-media-rendering-surface-delivery-policy-and-adr-reconciliation.md), which narrows this ADR to Media Library stabilization history and derivative-first surface policy

## Context

The historical implementation plus the current modal/panel card previews were intermittently failing with repeated `/_next/image` `500` responses when the input URL was a Supabase signed storage URL. This caused slow visual fill, retry churn, and inconsistent behavior across long sessions.

We needed a fast stabilization path that:

- preserves existing media payload contracts,
- avoids broad schema churn,
- and keeps detail-modal/download flows full-quality.

## Decision

Use Supabase signed preview URLs as the primary stabilization delivery path for Media Library card surfaces, and bypass Next image optimizer wrapping for signed storage URLs. The original transform-profile signing details below are historical only and are no longer allowed runtime behavior under ADR 0087.

Implementation contract:

- Surface-aware signing profiles:
  - `media-library-modal-image-card`
  - `media-library-panel-image-card`
- Historical note: the retired standalone page used its own route-era image-card preview profile during the original stabilization rollout.
- Signing routes (`/api/media/sign-batch`, `/api/media/list`, `/api/media/resolve-previews`) may keep profile labels for telemetry/cache compatibility, but must not pass transform options to Supabase signing APIs.
- Media Library adaptive resolver and panel preview resolver do not route Supabase signed object URLs through `/_next/image`.
- Detail modal and download paths remain full-quality.
- Telemetry records preview delivery dimensions (`preview_delivery_mode`, `optimizer_bypassed`, `source_class`, `error_kind`).

## Consequences

- Positive:
  - Eliminates the dominant `/_next/image` failure path for signed media-library previews.
  - Keeps preview compaction deterministic and surface-scoped.
  - Preserves existing external API contracts and ingestion payload shapes.
- Negative:
  - Adds surface/profile wiring to signing paths, increasing internal complexity.
  - Historical transform-profile wiring became misleading after ADR 0087 and must remain deny-only compatibility state until fully retired.
- Follow-ups:
  - Add durable derivative worker coverage for high-volume image sources (future phase).
  - Track transform coverage and unresolved fallback rates in production telemetry.

## Alternatives considered

- Option A: Keep `/_next/image` wrapping and tune remote optimizer behavior.
  - Rejected: did not reliably eliminate signed-URL failure bursts.
- Option B: Immediate full derivative pipeline before stabilization.
  - Rejected: larger blast radius and slower time-to-recovery for active regressions.
