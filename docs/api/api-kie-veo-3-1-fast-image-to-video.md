# Kie.ai Veo 3.1 Fast Image-to-Video (Dark-Path Contract)

This document tracks the internal ShortPulse dark-path contract for `kie-ai/veo-3.1-fast-i2v`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/veo-3.1-fast-i2v`
- Canonical source reference: `https://docs.kie.ai/`
- Runtime status: dark path only (not user-selectable, not cutover-enabled)

## Current Runtime Contract (Pre-Cutover)
- Submit aspect field: `aspect_ratio`
- Allowed aspects: `16:9`, `9:16`
- Allowed durations: `5`, `8` (seconds)
- Allowed resolutions: `720p`, `1080p`
- Expected payload fields:
  - required: `prompt`
  - required reference: one of `image_url` or `image_urls`
  - optional: `duration`, `generate_audio`

## Guardrails
1. Kie integration remains disabled by default.
2. Kie paths fail closed unless model is explicitly allowlisted.
3. Public `/api/fal/*` routes remain unchanged.

## Follow-up Required Before Enabling
1. Capture primary-source Kie contract details for this model just-in-time.
2. Confirm status/result payload shape parity in provider integration tests.
3. Re-validate pricing assumptions before any production enablement.
