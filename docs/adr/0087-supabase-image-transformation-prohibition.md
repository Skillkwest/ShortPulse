# ADR 0087: Supabase Image Transformation Prohibition

- Status: Accepted
- Date: 2026-05-30
- Owners: Media runtime / deployment contract

## Context

ShortPulse carried two separate transform-capable lanes:

1. explicit signed transform parameters passed to Supabase storage signing APIs
2. adaptive preview rewrites that could turn ordinary Supabase storage URLs into `/storage/v1/render/image/` URLs

This created an unacceptable gap between repo intent and runtime behavior. Even with signed-transform flags disabled, adaptive preview could still consume Supabase image transformation quota in production.

The product requirement is now absolute: ShortPulse must not use Supabase image transformations on any path, for any reason.

## Decision

1. Supabase image transformations are prohibited across the repo.
   - Do not pass transform options to Supabase signing APIs.
   - Do not construct, emit, rewrite, or rely on `/storage/v1/render/image/` URLs.
   - Do not use Supabase image transformations in fallbacks, compatibility lanes, experiments, previews, or temporary mitigations.

2. Canonical image delivery may use only:
   - signed original storage URLs,
   - durable locally generated variants/derivatives,
   - trusted app-owned non-Supabase optimization paths.

3. Existing signed-transform env flags remain deny-only compatibility flags until they are fully retired.
   - `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED`
   - `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED`
   - Their only supported runtime value is `false`.

4. Adaptive media remains allowed only when it is transform-free.
   - Surface allowlists are not permission to emit Supabase image transformation URLs.
   - Temporary containment may use `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY=true` while transform-capable code paths are being retired.
   - Temporary containment is not the final architecture target.

5. Any future production appearance of Supabase image transformation usage is a regression/incident, not a tuning choice.

## Consequences

Positive:

- Eliminates transform-quota coupling from preview and delivery policy.
- Removes ambiguity between “disabled by default” and “never allowed”.
- Makes env audits, runtime expectations, and operator response clearer.

Tradeoffs:

- Some adaptive preview behavior must remain contained or be reworked before it can be relied on again.
- Legacy tests, docs, and env-contract assumptions must be updated or retired.

## Follow-ups

- Remove or block every runtime path that can emit Supabase image transformation usage.
- Update tests so they fail if `/storage/v1/render/image/` or signing transforms reappear.
- Retire legacy transform compatibility flags once code and env contracts no longer depend on them.
