# Kie.ai Kling 3.0 (Runtime-Gated Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/kling-3.0`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/kling-3.0`
- Canonical source reference: `https://api.kie.ai/api/v1/jobs/createTask` (Kling 3.0 market docs)
- Runtime status: runtime-gated (selectable when Kie integration is enabled and model allowlist gates pass; fail-closed otherwise)
- Primary-source snapshot: captured from Kie docs on `2026-03-01`

## Current Runtime Contract
- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - default model-contract endpoint: `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`
  - configured via `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - supports optional `{requestId}` template token for query-style endpoints (for example `.../recordInfo?taskId={requestId}`)
  - falls back to legacy `/{requestId}/status` probing when template is not used
- Submit shape normalizes to:
  - Standard image-to-video:
    - root: `model="kling-3.0/video"`, optional `callBackUrl`
    - payload body under `input`
  - Motion Control:
    - root: `model="kling-3.0/motion-control"`, optional `callBackUrl`
    - payload body under `input` with `input_urls` (one character image URL), `video_urls` (one motion reference video URL), and resolution mode (`mode=720p|1080p`)
- Allowed aspects: `16:9`, `9:16`, `1:1`
- Allowed resolutions: `720p`, `1080p`
- Allowed durations: `5`, `10` (seconds)
- Required fields:
  - `prompt`
  - at least one image URL (`image_url`/`image_urls` aliases accepted, normalized to `input.image_urls`)
- Optional validated fields:
  - `mode` (`std` or `pro`, default `std`)
  - `sound` (or alias `generate_audio`)
  - `multi_shots` (requires `sound=true` when enabled)
  - `cfg_scale`
  - callback URL aliases (`callBackUrl` / `callbackUrl` / `callback_url`)
  - Motion Control aliases: `input_urls`, `video_urls`, `character_orientation`, `background_source`, and resolution mode (`mode=720p|1080p`)

## Pricing (ShortPulse runtime)
- Evidence source: user-provided Kie pricing dashboard capture dated `2026-03-14`.
- Kie credit conversion shown in evidence: `1 Kie credit ~= $0.005`.
- Kie Kling 3.0 rates used by runtime:
  - `1080p`: audio on `$0.20/s`, audio off `$0.135/s`
  - `720p`: audio on `$0.15/s`, audio off `$0.10/s`
- ShortPulse conversion policy:
  - `markedCredits = usd * 100 * 1.03`
  - `rawCredits = ceil(markedCredits)`
  - `credits = ceil(rawCredits / 5) * 5`
- Default lane (`10s`, `1080p`, audio on): `$2.00` -> `rawCredits=206` -> `210` billed credits.

## Guardrails
1. Kie integration remains disabled by default.
2. Kie paths fail closed unless model is explicitly allowlisted.
3. Public `/api/fal/*` routes remain unchanged.

## Follow-up Required Before Enabling
1. Refresh primary-source capture immediately before production enablement.
2. Confirm status/result payload shape parity in provider integration tests.
