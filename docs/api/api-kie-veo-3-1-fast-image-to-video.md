# Kie.ai Veo 3.1 Fast Image-to-Video (Dark-Path Contract)

This document tracks the internal ShortPulse dark-path contract for `kie-ai/veo-3.1-fast-i2v`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/veo-3.1-fast-i2v`
- Canonical source reference: `https://api.kie.ai/api/v1/veo/generate` (Veo 3.1 API docs)
- Runtime status: dark path only (not user-selectable, not cutover-enabled)
- Primary-source snapshot: captured from Kie docs on `2026-03-01`

## Current Runtime Contract (Pre-Cutover)
- Endpoint: `POST /api/v1/veo/generate`
- Status/details polling:
  - default model-contract endpoint: `https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}`
  - configured via `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - supports optional `{requestId}` template token for query-style endpoints (for example `.../record-info?taskId={requestId}`)
  - falls back to legacy `/{requestId}/status` probing when template is not used
- Submit aspect field: `aspect_ratio`
- Allowed aspects (dark-path subset): `16:9`, `9:16`, `Auto`
- Allowed durations (dark-path subset): `5`, `8` (seconds)
- Allowed resolutions: `720p`, `1080p`
- Supported submit aliases:
  - image references: `image_url` / `image_urls` / `imageUrl` / `imageUrls`
  - callback URL: `callBackUrl` / `callbackUrl` / `callback_url`
  - generation type: `generationType` / `generation_type`
- Runtime-normalized fields:
  - required: `prompt`, `imageUrls`
  - defaults: `model=veo3_fast`, `generationType=FIRST_AND_LAST_FRAMES_2_VIDEO`
  - optional validated: `aspect_ratio`, `duration`, `resolution`, `seeds (10000-99999)`, `enableTranslation`, `enableFallback`, `watermark`, `callBackUrl`
- Explicit guardrails:
  - `FIRST_AND_LAST_FRAMES_2_VIDEO` supports `1-2` images.
  - `REFERENCE_2_VIDEO` supports `1-3` images and requires `aspect_ratio=16:9`.

## Guardrails
1. Kie integration remains disabled by default.
2. Kie paths fail closed unless model is explicitly allowlisted.
3. Public `/api/fal/*` routes remain unchanged.

## Follow-up Required Before Enabling
1. Refresh primary-source capture immediately before production enablement.
2. Confirm status/result payload shape parity in provider integration tests.
3. Re-validate pricing assumptions before any production enablement.
