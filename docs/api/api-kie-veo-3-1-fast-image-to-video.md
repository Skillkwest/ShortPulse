# Kie.ai Veo 3.1 Fast Image-to-Video (Runtime-Gated Contract)

This document tracks the internal ShortPulse runtime contract for `kie-ai/veo-3.1-fast-i2v`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/veo-3.1-fast-i2v`
- Canonical source reference: `https://api.kie.ai/api/v1/veo/generate` (Veo 3.1 API docs)
- Runtime status: runtime-gated (selectable when Kie integration is enabled and model allowlist gates pass; fail-closed otherwise)
- Primary-source snapshot: captured from Kie docs + pricing evidence on `2026-04-09`

## Current Runtime Contract
- Endpoint: `POST /api/v1/veo/generate`
- Status/details polling:
  - default model-contract endpoint: `https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}`
  - configured via `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - requires the `{requestId}` template token for the canonical record-info endpoint
  - status routes fail closed when the configured endpoint shape is invalid.
- Submit aspect field: `aspect_ratio`
- Allowed aspects: `16:9`, `9:16`
- Allowed durations: `5`, `8` (seconds)
- Allowed resolutions: `720p`, `1080p`
- Canonical ingress fields (strict):
  - `prompt`, `image_url|image_urls`, `aspect_ratio`, `duration|duration_seconds`, `resolution`, `generate_audio`
  - `generation_type`, `model`, `callback_url`, `seed`, `enable_translation`, `watermark`
- Accepted edge aliases (normalized immediately at ingress, never persisted as canonical):
  - `imageUrl|imageUrls` -> `image_url|image_urls`
  - `generationType` -> `generation_type`
  - `callBackUrl|callbackUrl` -> `callback_url`
  - `seeds` -> `seed`
  - `enableTranslation` -> `enable_translation`
- Runtime-normalized provider submit fields:
  - required: `prompt`, `imageUrls`
  - defaults: `model=veo3_fast`, `generationType=FIRST_AND_LAST_FRAMES_2_VIDEO`
  - optional validated: `aspect_ratio`, `duration`, `resolution`, `seeds (10000-99999)`, `enableTranslation`, `watermark`, `callBackUrl`
- Explicit guardrails:
  - `FIRST_AND_LAST_FRAMES_2_VIDEO` supports `1-2` images.
  - `REFERENCE_2_VIDEO` supports `1-3` images and requires `aspect_ratio=16:9`.

## Pricing (ShortPulse runtime)
- Evidence source: current public Kie Veo pricing evidence plus repo-local prior dashboard capture.
- Kie dashboard evidence rows for Google Veo 3.1 Fast:
  - current public Veo Fast pricing = `80` credits / `$0.40` per video
- Kie credit conversion shown in evidence: `1 Kie credit ~= $0.005`.
- Runtime pricing basis: fixed `$0.40` per generation (independent of duration/resolution inputs currently exposed in UI).
- First/last-frame implementation mapping: `generationType=FIRST_AND_LAST_FRAMES_2_VIDEO` in ShortPulse uses the same Fast Veo lane pricing basis (`$0.40` per generation).
- ShortPulse conversion policy:
  - `markedCredits = usd * 100 * 1.03`
  - `rawCredits = ceil(markedCredits)`
  - `credits = ceil(rawCredits / 5) * 5`
- Default lane outcome: `$0.40` -> `rawCredits=42` -> `45` billed credits.

## Guardrails
1. Kie integration remains disabled by default.
2. Kie paths fail closed unless model is explicitly allowlisted.
3. Public `/api/fal/*` routes remain unchanged.
4. Record-info lifecycle/media normalization is provider-aware:
   - lifecycle precedence includes `data.successFlag` (`0=running`, `1=completed`, `2/3=failed`)
   - terminal no-media responses are classified into recoverable `terminal_success_no_media` recovery semantics instead of hard terminal provider-error classification.
5. Character-scoped media isolation is fail-closed for video submit payloads (`/characters/` paths and character metadata fields are rejected before provider dispatch).

## Follow-up Required Before Enabling
1. Refresh primary-source capture immediately before production enablement.
2. Confirm status/result payload shape parity in provider integration tests.
