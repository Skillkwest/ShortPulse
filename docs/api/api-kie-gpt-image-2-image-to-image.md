# Kie.ai GPT Image 2 Image-to-Image API Reference

Reference for integrating `kie-ai/gpt-image-2-image-to-image` through ShortPulse queued `/api/fal` compatibility proxies.

## Authentication

- Set `KIE_API_KEY` or `SHORTPULSE_KIE_API_KEY` in the server runtime.
- Requests are proxied server-side; the browser never receives the Kie bearer token.

## Submit

### Proxy endpoint

`POST /api/fal/kie-gpt-image-2-edit-submit`

### Kie endpoint

`POST https://api.kie.ai/api/v1/jobs/createTask`

ShortPulse accepts the top-level image-to-image payload shape used by AI Studio edit lanes and normalizes it to Kie `createTask`:

```json
{
  "prompt": "Preserve the subject identity and turn this into a cinematic poster portrait.",
  "input_urls": ["https://cdn.example.com/reference.png"],
  "aspect_ratio": "4:5",
  "resolution": "2K"
}
```

Provider payload after server normalization:

```json
{
  "model": "gpt-image-2-image-to-image",
  "input": {
    "prompt": "Preserve the subject identity and turn this into a cinematic poster portrait.",
    "input_urls": ["https://cdn.example.com/reference.png"],
    "aspect_ratio": "4:5",
    "resolution": "2K",
    "enable_safety_checker": false,
    "safety_tolerance": 5
  }
}
```

## Input fields

- `prompt` is required, non-empty, and capped at 20,000 characters.
- `input_urls` is required and supports 1-16 reference image URLs. Compatibility aliases accepted before normalization include `image_url`, `image_urls`, `imageUrl`, `imageUrls`, `input_url`, and `inputUrl`.
- `aspect_ratio` defaults to `auto`; allowed values are `auto`, `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `5:4`, `4:5`, `16:9`, `9:16`, `2:1`, `1:2`, `3:1`, `1:3`, `21:9`, and `9:21`.
- `resolution` defaults to `1K`; allowed values are `1K`, `2K`, and `4K`.
- Kie rejects some aspect/resolution combinations, so ShortPulse normalizes them before submit: `auto` always submits `1K`, and `1:1` with requested `4K` submits `2K`.
- ShortPulse submits provider safety at the least restrictive setting: `enable_safety_checker: false` and `safety_tolerance: 5`.
- `callBackUrl` is supported at the provider boundary when supplied by server/runtime callers, but AI Studio uses polling for this lane.

## Status & result fetching

- Poll `POST /api/fal/kie-gpt-image-2-edit-status` with `{ "requestId": "..." }`.
- The submit response returns Kie `data.taskId`; ShortPulse exposes that value as `request_id`.
- Status polling uses `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}` through the shared Kie job-status proxy.
- Result extraction accepts common Kie image result envelopes, including `resultUrls`, `result_urls`, `image_urls`, `images[].url`, and parsed `resultJson`.

## Pricing

- Provider cost: `$0.03` per image at `1K`, `$0.05` at `2K`, and `$0.08` at `4K`.
- Credit conversion uses the shared ShortPulse model-pricing policy:
  - `rawCredits = ceil(usd * creditPerDollar * (1 + perModelMarkupBps / 10000))`
  - `credits = rawCredits` unless an admin pricing row override is configured.

## Defaults we ship

- Model id: `kie-ai/gpt-image-2-image-to-image`
- Provider model: `gpt-image-2-image-to-image`
- Workflow: image-to-image only
- Aspect: `auto`
- Resolution: `1K`
- Input references: 1-16 image URLs
- Provider safety: `enable_safety_checker: false`, `safety_tolerance: 5`
- Output count: one image per submit
- Routes: `/api/fal/kie-gpt-image-2-edit-submit` and `/api/fal/kie-gpt-image-2-edit-status`

## Notes

- This is intentionally separate from the Kie `kie-ai/gpt-image-2-text-to-image` lane.
- This is also separate from OpenAI `gpt-image-2`, which remains a direct synchronous OpenAI route.
