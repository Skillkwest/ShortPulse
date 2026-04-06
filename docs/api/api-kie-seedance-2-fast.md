# Kie.ai Seedance 2.0 Fast (Runtime-Gated Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/seedance-2-fast`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/seedance-2-fast`
- Canonical source reference: [Kie Seedance 2.0 Fast](https://docs.kie.ai/market/bytedance/seedance-2-fast)
- Runtime status: runtime-gated
- Primary-source snapshot: captured from Kie docs on `2026-04-06`

## Current Runtime Contract
- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`
- Submit shape normalizes to:
  - root: `model="bytedance/seedance-2-fast"`, optional `callBackUrl`
  - payload body under `input`
- Allowed aspects: `1:1`, `21:9`, `4:3`, `3:4`, `16:9`, `9:16`
- Allowed resolutions: `720p`, `1080p`
- Allowed durations: `5`, `10` (seconds)
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

## Product-facing payload rules
- Visible phase-1 product support:
  - prompt-only text-to-video
  - first-frame image-to-video
  - first/last-frame image-to-video
- Phase-2 backend/state pipeline is also wired for:
  - `reference_image_urls`
  - `reference_video_urls`
  - `reference_audio_urls`
  - `return_last_frame`
  - `web_search`
- Frame mode and multimodal reference mode are mutually exclusive.

## Related Routes
- Submit proxy: `/api/fal/kie-seedance-2-fast-submit`
- Status proxy: `/api/fal/kie-seedance-2-fast-status`
