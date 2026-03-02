# Kie.ai Kling 3.0 (Dark-Path Contract)

This document tracks the internal ShortPulse dark-path contract for `kie-ai/kling-3.0`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/kling-3.0`
- Canonical source reference: `https://api.kie.ai/api/v1/jobs/createTask` (Kling 3.0 market docs)
- Runtime status: dark path only (not user-selectable, not cutover-enabled)
- Primary-source snapshot: captured from Kie docs on `2026-03-01`

## Current Runtime Contract (Pre-Cutover)
- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - configured via `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - supports optional `{requestId}` template token for query-style endpoints (for example `.../recordInfo?taskId={requestId}`)
  - falls back to legacy `/{requestId}/status` probing when template is not used
- Submit shape normalizes to:
  - root: `model="kling-3.0/video"`, optional `callBackUrl`
  - payload body under `input`
- Allowed aspects: `16:9`, `9:16`, `1:1`
- Allowed durations (dark-path subset): `5`, `10` (seconds)
- Required fields:
  - `prompt`
  - at least one image URL (`image_url`/`image_urls` aliases accepted, normalized to `input.image_urls`)
- Optional validated fields:
  - `mode` (`std` or `pro`, default `std`)
  - `sound` (or alias `generate_audio`)
  - `multi_shots` (requires `sound=true` when enabled)
  - `cfg_scale`
  - callback URL aliases (`callBackUrl` / `callbackUrl` / `callback_url`)

## Guardrails
1. Kie integration remains disabled by default.
2. Kie paths fail closed unless model is explicitly allowlisted.
3. Public `/api/fal/*` routes remain unchanged.

## Follow-up Required Before Enabling
1. Refresh primary-source capture immediately before production enablement.
2. Confirm status/result payload shape parity in provider integration tests.
3. Re-validate pricing assumptions before any production enablement.
