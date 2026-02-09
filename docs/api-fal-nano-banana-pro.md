# Fal.ai Nano Banana Pro Image API Reference

Documentation for integrating the `fal-ai/nano-banana-pro` queue through our `/api/fal` proxies.

## Authentication
- Configure `FAL_KEY` in the runtime and keep it on the server.
- The proxies append `Authorization: Key $FAL_KEY` before forwarding to Fal.ai.

## Submit (text-to-image)
### Proxy endpoint
`POST /api/fal/nano-banana-pro-submit` accepts the same payload shape we send to Fal.

### Fal.ai queue
`POST https://queue.fal.run/fal-ai/nano-banana-pro` expects:

```json
{
  "prompt": "An editorial photo of a smartwatch floating above a satin fabric.",
  "num_images": 1,
  "aspect_ratio": "4:5",
  "output_format": "png",
  "resolution": "1K"
}
```

### Input description
- `prompt` (string): required text description for the image (up to 20k chars).
- `num_images` (integer): defaults to 1; we always request 1.
- `aspect_ratio` (enum): `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `4:5`, `3:4`, `2:3`, `9:16`, `1:1`. Invalid values fall back to `4:5`.
- `output_format` (enum): `png`, `jpeg`, `webp`. We send `png`.
- `resolution` (enum): `1K`, `2K`, `4K`. Defaults to `1K`.
- `seed` (integer): optional random seed.
- `sync_mode` (boolean): when true Fal returns data URIs directly instead of relying on the queue history.
- `limit_generations` (boolean): experimental flag to limit per-round generations to one result.
- `enable_web_search` (boolean): when true Fal can look up web data; enabling adds a flat surcharge.

## Status & results
- Poll `POST /api/fal/nano-banana-pro-status` with `{ "requestId": "..." }`.
- The proxy fetches `/requests/$REQUEST_ID/status` and, once completed, `/requests/$REQUEST_ID`.
- Payloads mirror the queue response (status, resultJson/images/description).
- Responses include `status` (e.g., `running`, `completed`, `failed`) and `images` metadata.

## Output schema
- `images` (list of `ImageFile`):
  - `url` (string)
  - `content_type` (string)
  - `file_name` (string)
  - `width`, `height` (integer)
  - `file_size`, `file_data`: optional metadata.
- `description` (string): text summary of the generated image.

Sample response:
```json
{
  "images": [
    {
      "file_name": "nano-banana-pro-output.png",
      "content_type": "image/png",
      "url": "https://storage.googleapis.com/falserverless/example_outputs/nano-banana-pro-output.png",
      "width": 1024,
      "height": 1280
    }
  ],
  "description": ""
}
```

## Pricing (ShortPulse)
- Provider rate: **$0.15 per image** → `credits = ceil(0.15 / 0.01) = 15`.
- 4K renders double to $0.30 (30 credits), and `enable_web_search` adds $0.015 (1.5 credits) when the flag is enabled.
- We charge the same as before, so all existing pricing calculations remain unchanged.

## Defaults we ship
- `num_images`: 1.
- `aspect_ratio`: clamped to the allowed list; defaults to `4:5` if the UI sends something invalid.
- `resolution`: `1K`.
- `output_format`: `png`.
- `enable_web_search`: never set from the studio UI.

## Notes
- Keep requests on the server to protect `FAL_KEY`.
- Nano Banana Pro is text-to-image only; we do not forward reference images.
