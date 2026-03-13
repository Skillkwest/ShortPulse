# ADR 0036: Media Library Signed Preview Delivery and Next Optimizer Bypass

## Status
Accepted

## Context
Media Library route/modal/panel card previews were intermittently failing with repeated `/_next/image` `500` responses when the input URL was a Supabase signed storage URL. This caused slow visual fill, retry churn, and inconsistent behavior across long sessions.

We needed a fast stabilization path that:
- preserves existing media payload contracts,
- avoids broad schema churn,
- and keeps detail-modal/download flows full-quality.

## Decision
Use Supabase signed preview URLs (with per-surface transform profiles for image cards) as the primary delivery path for Media Library card surfaces, and bypass Next image optimizer wrapping for signed storage URLs.

Implementation contract:
- Surface-aware signing profiles:
  - `media-library-route-image-card`
  - `media-library-modal-image-card`
  - `media-library-panel-image-card`
- Signing routes (`/api/media/sign-batch`, `/api/media/list`, `/api/media/resolve-previews`) resolve profile-aware transforms for image paths.
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
  - Supabase transform behavior is now a stronger dependency for preview performance.
- Follow-ups:
  - Add durable derivative worker coverage for high-volume image sources (future phase).
  - Track transform coverage and unresolved fallback rates in production telemetry.

## Alternatives considered
- Option A: Keep `/_next/image` wrapping and tune remote optimizer behavior.
  - Rejected: did not reliably eliminate signed-URL failure bursts.
- Option B: Immediate full derivative pipeline before stabilization.
  - Rejected: larger blast radius and slower time-to-recovery for active regressions.
