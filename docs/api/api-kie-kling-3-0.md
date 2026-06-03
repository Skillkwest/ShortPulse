# Kie.ai Kling 3.0 (Always-On Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/kling-3.0`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/kling-3.0`
- Canonical source reference: `https://api.kie.ai/api/v1/jobs/createTask` (Kling 3.0 market docs)
- Runtime status: always on for `kie-ai/kling-3.0`; no rollout allowlist or enable flag is required for this model lane
- Primary-source snapshot: captured from Kie docs on `2026-03-01`

## Current Runtime Contract
- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - default model-contract endpoint: `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`
  - configured via `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - requires the `{requestId}` template token for the canonical record-info endpoint
- Submit shape normalizes to:
  - Standard image-to-video:
    - root: `model="kling-3.0/video"`, optional `callBackUrl`
    - payload body under `input`
    - product-level shot modes:
      - `Single`: top-level `prompt`, first frame required, optional last frame accepted, hidden prompt composition enforces one continuous shot
      - `Multi`: top-level `prompt`, first frame required, optional last frame accepted, hidden prompt composition directs a multi-shot sequence, element references allowed via `@ElementName` + `kling_elements`
      - `Custom`: `multi_prompt[]`, first frame required, last frame not sent
  - Motion Control:
    - root: `model="kling-3.0/motion-control"`, optional `callBackUrl`
    - payload body under `input` with `input_urls` (one character image URL), `video_urls` (one motion reference video URL), and resolution mode (`mode=720p|1080p`)
- Allowed aspects: `16:9`, `9:16`, `1:1` for Standard image-to-video only
- Allowed resolutions: `720p`, `1080p`
- Allowed durations: `5`, `10` (seconds) for Standard image-to-video only
- Kie media preflight guard (before provider submit):
  - media URLs must be valid `http(s)` URLs
  - image/video file extensions are fail-closed allowlisted
    - images: `jpg|jpeg|png|webp|gif|heic|heif|avif`
    - videos (motion control): `mp4|webm|mov|m4v`
  - signed media URLs with embedded JWT `token` are rejected when TTL is too short (`<=120s`)
  - remote media probe rejects non-success fetch status before provider dispatch (`HTTP 2xx` required)
  - remote media probe rejects content-type mismatches (`image/*` for images, `video/*` for videos; `application/octet-stream` remains compatibility-accepted)
  - deterministic route error on violation: `code=KIE_MEDIA_INPUT_INVALID`
  - runtime probe override (optional): `SHORTPULSE_KIE_MEDIA_PROBE_ENABLED=true|false` (`unset` defaults to enabled outside test runtime)
- Required fields:
  - `prompt`
  - at least one image URL (`image_url`/`image_urls` aliases accepted, normalized to `input.image_urls`)
- Optional validated fields:
  - `mode` (`std` or `pro`, default `std`)
  - `sound` (or alias `generate_audio`)
  - `multi_shots` (requires `sound=true` when enabled)
  - `multi_prompt[]` for true multi-shot Kling submissions
  - `kling_elements` for inline `@ElementName` prompt references
  - `cfg_scale`
  - canonical callback URL field `callback_url` (edge aliases `callBackUrl` / `callbackUrl` normalized at ingress)
  - Motion Control canonical fields: `input_urls`, `video_urls`, `character_orientation`, `background_source`, and resolution mode (`mode=720p|1080p`)
- Motion Control product notes:
  - Motion UI hides aspect and duration because the motion-control provider payload does not use them.
  - Motion UI keeps audio enabled as a supported setting for this lane.
  - Motion cost estimate is intentionally suppressed until provider-backed billing evidence exists for this lane.

## Product-facing payload rules
- `Single`
  - submits top-level `prompt`
  - sends first frame and optional last frame
  - keeps `multi_shots=false`
  - applies hidden prompt composition that enforces one continuous shot with no cuts or extra shot setups
- `Multi`
  - submits top-level `prompt`
  - sends first frame and optional last frame
  - keeps `multi_shots=false`
  - applies hidden prompt composition that directs the provider to treat the prompt as a multi-shot sequence
- `Custom`
  - submits `multi_prompt[]`
  - sends first frame only
  - sets `multi_shots=true`

## Pricing (ShortPulse runtime)
- Evidence source: user-provided Kie logs captured `2026-04-07` through `2026-04-09`.
- Kie credit conversion used by runtime: `1 Kie credit = $0.005`.
- Observed Kie Kling 3.0 rates used by runtime:
  - `std` mode, sound off: `14` Kie credits / second (`$0.07/s`)
  - `pro` mode, sound off: `18` Kie credits / second (`$0.09/s`)
  - sound-on rates currently keep a `1.5x` premium on those mode baselines until richer Kie evidence is captured for each lane
- ShortPulse conversion policy:
  - `rawCredits = ceil(usd * creditPerDollar * (1 + perModelMarkupBps / 10000))`
  - `credits = rawCredits` unless a row-specific round-nearest override is configured in `/admin/pricing`
- Representative observed outcomes:
  - `std`, `4s`, sound off: `56` Kie credits -> `$0.28` -> `28` billed credits before per-model overrides
  - `pro`, `4s`, sound off: `72` Kie credits -> `$0.36` -> `36` billed credits before per-model overrides

## Guardrails
1. Kling 3.0 is always on; this model no longer depends on a rollout enable flag or model allowlist.
2. Public `/api/fal/*` routes remain unchanged.
3. Character-scoped media isolation is fail-closed for video submit payloads (`/characters/` paths and character metadata fields are rejected before provider dispatch).
4. Kie submit upstream errors include redacted media diagnostics in telemetry metadata (`media_diagnostics`) for faster `422 file format` triage without logging raw signed URLs.

## Ongoing Maintenance
1. Refresh primary-source capture when Kie updates the motion-control docs.
2. Keep status/result payload shape parity covered in provider integration tests.
