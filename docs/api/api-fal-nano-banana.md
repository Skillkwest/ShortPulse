# Fal.ai Nano Banana Image API Reference

Reference for integrating the `fal-ai/nano-banana` queue via our Next `/api/fal` proxies.

## Authentication
- Set `FAL_KEY` in the runtime environment and keep it server-side.
- The proxies add `Authorization: Key $FAL_KEY` before forwarding payloads to Fal.ai.

## Submit (text-to-image)
### Local proxy
Posts go to `POST /api/fal/nano-banana-submit` with the prompt payload.

### Queue endpoint (Fal.ai)
`POST https://queue.fal.run/fal-ai/nano-banana` expects:

```json
{
  "prompt": "A detailed product photo of a smartwatch on a white background.",
  "num_images": 1,
  "aspect_ratio": "1:1",
  "output_format": "png"
}
```

### Input fields
- `prompt` (string): required text describing the desired image.
- `num_images` (integer): number of outputs. ShortPulse sends `1`.
- `aspect_ratio` (enum): `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`. Unknown values revert to `1:1`.
- `output_format` (enum): `png`, `jpeg`, `webp`. We request `png`.
- `sync_mode` (boolean): optional; when `true` Fal returns data URIs instead of queue history.
- `limit_generations` (boolean): experimental flag to limit per-round generations.

## Status & result fetching
- Poll `POST /api/fal/nano-banana-status` with `{ "requestId": "..." }`.
- The proxy hits `GET https://queue.fal.run/fal-ai/nano-banana/requests/$REQUEST_ID/status`.
- Once completed, the proxy also fetches `GET https://queue.fal.run/fal-ai/nano-banana/requests/$REQUEST_ID` and returns the merged payload.
- Responses include `status` (e.g., `running`, `completed`, `failed`) and the final JSON (images, description, etc.).

## Output schema
- `images` (list of `ImageFile`):
  - `url` (string): public link to the generated image.
  - `content_type` (string): MIME type (e.g., `image/png`).
  - `file_name` (string): generated filename.
  - `width`, `height` (integer): pixel dimensions.
- `description` (string): optional text summary.

Sample output:
```json
{
  "images": [
    {
      "file_name": "nano-banana-output.png",
      "content_type": "image/png",
      "url": "https://storage.googleapis.com/falserverless/example_outputs/nano-banana-output.png",
      "width": 1024,
      "height": 1024
    }
  ],
  "description": ""
}
```

## Pricing (ShortPulse)
- Provider rate: **$0.039 per image** → `credits = ceil(0.039 / 0.01) = 4`.
- We debit 4 credits per render regardless of aspect, matching the prior Nano Banana pricing.

## Defaults we use
- `num_images`: 1.
- `aspect_ratio`: clamped to the allowed list (1:1 fallback). Aspect selection in the UI maps directly to this field.
- `output_format`: `png`.
- We never enable `sync_mode` or `limit_generations` from the studio UI.

## Notes
- Keep requests on the server to avoid leaking `FAL_KEY`.
- The `fal-ai/nano-banana` queue is text-to-image only; no reference images are passed.
