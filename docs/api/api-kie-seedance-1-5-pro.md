# Kie.ai Seedance 1.5 Pro (Active Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/seedance-1.5-pro`.

Status: deprecated compatibility lane as of May 11, 2026. New picker-visible selection should use `kie-ai/seedance-2`; persisted restores normalize through catalog `replacementModelId`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/seedance-1.5-pro`
- Canonical source reference: [Kie Seedance 1.5 Pro](https://docs.kie.ai/market/bytedance/seedance-1-5-pro)
- Runtime status: active always-on Kie video lane
- Primary-source snapshot: captured from Kie docs on `2026-04-06`

## Current Runtime Contract
- Endpoint: `POST /api/v1/jobs/createTask`
- Status/details polling:
  - default model-contract endpoint: `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`
  - configured via `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - requires the `{requestId}` template token for the canonical record-info endpoint
- Submit shape normalizes to:
  - root: `model="bytedance/seedance-1.5-pro"`, optional `callBackUrl`
  - payload body under `input`
  - product-level behavior inferred from image count:
    - `0` images: prompt-only generation
    - `1` image: first-frame image-to-video
    - `2` images: first/last-frame image-to-video
- Allowed aspects: `1:1`, `21:9`, `4:3`, `3:4`, `16:9`, `9:16`
- Allowed resolutions: `480p`, `720p`, `1080p`
- Allowed durations: `4`, `8`, `12` (seconds)
- Required fields:
  - `prompt`
- Optional validated fields:
  - `input_urls` (`0-2` http(s) URLs)
  - `aspect_ratio`
  - `resolution`
  - `duration`
  - `generate_audio`
  - `fixed_lens`
  - `nsfw_checker`
  - canonical callback URL field `callback_url` (edge aliases `callBackUrl` / `callbackUrl` normalized at ingress)

## Product-facing payload rules
- Prompt-only:
  - submits top-level prompt under `input.prompt`
  - omits `input.input_urls`
- One-image:
  - submits the first frame as `input.input_urls[0]`
- Two-image:
  - submits first and last frames as `input.input_urls[0..1]`
- All active Seedance 1.5 submissions also pass:
  - `aspect_ratio`
  - `duration`
  - `resolution`
  - optional `generate_audio`
  - optional `fixed_lens`

## Pricing (ShortPulse runtime)
- Runtime billing now uses Kie-log-backed active-lane rates rather than the old token estimator.
- Kie credit conversion used by runtime: `1 Kie credit = $0.005`.
- Observed rates from recent Kie logs:
  - `720p`, audio off: `14` Kie credits for `4s` (`3.5` credits/s, `$0.0175/s`)
  - `720p`, audio on: `84` Kie credits for `12s` (`7` credits/s, `$0.035/s`)
  - `1080p`, audio off: `90` Kie credits for `12s` (`7.5` credits/s, `$0.0375/s`)
  - `1080p`, audio on: `180` Kie credits for `12s` (`15` credits/s, `$0.075/s`)
- `480p` remains a conservative interim baseline until direct Kie evidence is captured.

## Guardrails
1. Public `/api/fal/*` route contracts remain stable even though the provider path is Kie-backed.
2. Seedance 1.5 accepts at most two input URLs.
3. Character-scoped media URLs remain blocked for video submits.

## Related Routes
- Submit proxy: `/api/fal/kie-seedance-submit`
- Status proxy: `/api/fal/kie-seedance-status`

## Legacy docs
- `docs/api/api-fal-seedance-1-5-pro.md`
- `docs/api/api-fal-seedance-1-5-pro-i2v.md`

Those documents are retained as historical references for disabled Fal routes and are not the active product contract.
