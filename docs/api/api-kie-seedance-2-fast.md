# Kie.ai Seedance 2.0 Fast (Active Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/seedance-2-fast`.

## Scope

- Provider: `kie`
- Model id: `kie-ai/seedance-2-fast`
- Canonical source reference: [Kie Seedance 2.0 Fast](https://docs.kie.ai/market/bytedance/seedance-2-fast)
- Runtime status: active always-on Kie video lane
- Primary-source snapshot: refreshed from Kie docs on `2026-06-19`

## Current Runtime Contract

- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`
- Submit shape normalizes to:
  - root: `model="bytedance/seedance-2-fast"`, optional `callBackUrl`
  - payload body under `input`
- Allowed aspects: `1:1`, `21:9`, `4:3`, `3:4`, `16:9`, `9:16`
- Allowed resolutions: `480p`, `720p`
- Allowed durations: integer seconds from `4` through `15`
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
- Provider-facing Seedance image inputs use `/api/kie/upload-url` with
  `admissionProfile="kie_seedance_reference_image"` before Kie temp upload. This applies to
  `first_frame_url`, `last_frame_url`, and `reference_image_urls`, including direct image slots and
  linked Character/Element image references.
- Seedance image admission preserves the original ShortPulse media asset and normalizes only the
  provider-facing bytes: still images must be readable, under `30 MB`, within aspect ratio `0.4..2.5`,
  and both width and height must land within `300..6000` px. Undersized stills are upscaled,
  oversized stills are downscaled, and invalid aspect/unreadable inputs fail before provider submit.
- Supabase image transformations are prohibited; Seedance admission uses app-owned server-side image
  encoding only.

## Related Routes

- Submit proxy: `/api/fal/kie-seedance-2-fast-submit`
- Status proxy: `/api/fal/kie-seedance-2-fast-status`
