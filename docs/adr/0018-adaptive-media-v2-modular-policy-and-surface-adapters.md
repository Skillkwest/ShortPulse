# ADR 0018: Adaptive Media V2 Modular Policy and Surface Adapters

- Status: Accepted
- Date: 2026-02-19
- Owners: AI Studio / Media performance

Policy note (2026-05-30): [ADR 0087](./0087-supabase-image-transformation-prohibition.md) constrains this ADR. Adaptive media remains valid only for transform-free behavior. No surface adapter may emit Supabase image transformation paths, including `/storage/v1/render/image/` rewrites.

## Context

Adaptive media behavior previously lived in reference-grid-specific logic, which made it hard to reuse across Media Library grids and Character surfaces without drift. Quality, pressure response, and local transcode behavior were coupled to a single UI surface.

## Decision

Adopt a shared adaptive-media core under `frontend/lib/adaptive-media/` with these modules:

- `types.ts`
- `flags.ts`
- `policy.ts`
- `resolver.ts`
- `localTranscode.ts`
- `pressure.ts`
- `telemetry.ts`

Reference Grid uses parity-first rollout:

1. Shadow compare mode (`NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SHADOW_COMPARE=true`)
2. Cutover with parity policy (`NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY=false`)
3. Tuned policy enablement (`NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY=true`)

Surface adapters are additive and opt-in via:

- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES`

Detail modals remain full quality and non-adaptive.

## Canonical Contract

- `*_storage_path` fields must remain storage paths (not URL/blob/data).
- Runtime media URLs remain in URL fields.
- Resolver selects preview/full candidates by ladder order and skips invalid candidates.

## Consequences

Positive:

- Reusable policy/resolver across Reference Grid, Media Library grids, and Character surfaces.
- Unified telemetry for policy and mismatch analysis.
- Lower regression risk through parity-first rollout and kill switch.

Tradeoffs:

- Additional flags/configuration complexity.
- Shadow compare adds temporary duplicate compute.

## Implementation Notes

- Legacy resolution path remains available until tuned policy is stable.
- Full-quality detail behavior is explicitly preserved for AI Studio detail modal, Media Library file modal, and Character reference preview overlay.
