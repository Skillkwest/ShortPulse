# Kie.ai Seedance 2.0 (Active Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/seedance-2`.

## Scope

- Provider: `kie`
- Model id: `kie-ai/seedance-2`
- Canonical source reference: [Kie Seedance 2.0](https://docs.kie.ai/market/bytedance/seedance-2)
- Runtime status: active always-on Kie video lane
- Primary-source snapshot: captured from Kie docs on `2026-04-30`

## Current Runtime Contract

- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`
- Submit shape normalizes to:
  - root: `model="bytedance/seedance-2"`, optional `callBackUrl`
  - payload body under `input`
- Allowed aspects: `1:1`, `21:9`, `4:3`, `3:4`, `16:9`, `9:16`
- Allowed resolutions: `480p`, `720p`, `1080p`
- Allowed durations: `5`, `10`, `15` (seconds)
- Required fields:
  - `prompt`
- Optional validated fields:
  - `first_frame_url`
  - `last_frame_url`
  - `reference_image_urls`
  - `reference_video_urls`
  - `reference_audio_urls`
  - `aspect_ratio`
  - `resolution`
  - `duration`
  - `generate_audio`
  - `return_last_frame`
  - `web_search`
  - canonical callback URL field `callback_url` (edge aliases `callBackUrl` / `callbackUrl` normalized at ingress)

## Product-facing payload rules

- Active product support:
  - prompt-only text-to-video
  - first-frame image-to-video
  - first/last-frame image-to-video
  - multimodal reference generation
  - Kling-pattern `Single`/`Multi` shot controls with Seedance-specific hidden prompt composition
  - linked Character/Element references compiled into Seedance-native prompt + `reference_*_urls` payload fields
- Frame mode and multimodal reference mode are mutually exclusive.

## Related Routes

- Submit proxy: `/api/fal/kie-seedance-2-submit`
- Status proxy: `/api/fal/kie-seedance-2-status`
