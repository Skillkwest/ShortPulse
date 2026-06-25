# Kie.ai GPT Image 2 Text-to-Image API Reference

Reference for integrating `kie-ai/gpt-image-2-text-to-image` through ShortPulse queued `/api/fal` compatibility proxies.

## Authentication

- Set `KIE_API_KEY` or `SHORTPULSE_KIE_API_KEY` in the server runtime.
- Requests are proxied server-side; the browser never receives the Kie bearer token.

## Submit

### Proxy endpoint

`POST /api/fal/kie-gpt-image-2-submit`

### Kie endpoint

`POST https://api.kie.ai/api/v1/jobs/createTask`

ShortPulse accepts the same top-level text-to-image payload shape as other Create image lanes and normalizes it to Kie `createTask`:

```json
{
  "prompt": "A cinematic night city poster with neon reflections on a rainy street.",
  "aspect_ratio": "16:9",
  "resolution": "2K"
}
```

Provider payload after server normalization:

```json
{
  "model": "gpt-image-2-text-to-image",
  "input": {
    "prompt": "A cinematic night city poster with neon reflections on a rainy street.",
    "aspect_ratio": "16:9",
    "size": "16:9",
    "resolution": "2K",
    "enable_safety_checker": false,
    "safety_tolerance": 5
  }
}
```

## Input fields

- `prompt` is required, non-empty, and capped at 20,000 characters.
- `aspect_ratio` defaults to `auto`; allowed values are `auto`, `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `5:4`, `4:5`, `16:9`, `9:16`, `2:1`, `1:2`, `3:1`, `1:3`, `21:9`, and `9:21`.
- `resolution` defaults to `1K`; allowed values are `1K`, `2K`, and `4K`.
- Kie rejects some aspect/resolution combinations, so ShortPulse normalizes them before submit: `auto` always submits `1K`, and `1:1` with requested `4K` submits `2K`.
- For concrete non-`auto` aspects, ShortPulse also sends `input.size` with the same aspect token as `input.aspect_ratio`. This preserves Kie's documented `aspect_ratio` field while giving the GPT Image 2 backend an explicit shape token across `1K`, `2K`, and `4K`.
- ShortPulse submits provider safety at the least restrictive setting: `enable_safety_checker: false` and `safety_tolerance: 5`.
- `callBackUrl` is supported at the provider boundary when supplied by server/runtime callers, but AI Studio uses polling for this lane.

## Status & result fetching

- Poll `POST /api/fal/kie-gpt-image-2-status` with `{ "requestId": "..." }`.
- The submit response returns Kie `data.taskId`; ShortPulse exposes that value as `request_id`.
- Status polling uses `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}` through the shared Kie job-status proxy.
- Result extraction accepts common Kie image result envelopes, including `resultUrls`, `result_urls`, `image_urls`, `images[].url`, and parsed `resultJson`.

## Pricing

- Provider cost: `$0.03` per image at `1K`, `$0.05` at `2K`, and `$0.08` at `4K`.
- Credit conversion uses the shared ShortPulse model-pricing policy:
  - `rawCredits = ceil(usd * creditPerDollar * (1 + perModelMarkupBps / 10000))`
  - `credits = rawCredits` unless an admin pricing row override is configured.

## Defaults we ship

- Model id: `kie-ai/gpt-image-2-text-to-image`
- Provider model: `gpt-image-2-text-to-image`
- Workflow: text-to-image only
- Aspect: `auto`
- Resolution: `1K`
- Provider safety: `enable_safety_checker: false`, `safety_tolerance: 5`
- Output count: one image per submit
- Routes: `/api/fal/kie-gpt-image-2-submit` and `/api/fal/kie-gpt-image-2-status`

## Notes

- This is intentionally separate from retired direct OpenAI `gpt-image-2` routes, which are disabled and should not be used for new GPT Image 2 work.
- Kie image-to-image support lives in the separate `kie-ai/gpt-image-2-image-to-image` lane.
