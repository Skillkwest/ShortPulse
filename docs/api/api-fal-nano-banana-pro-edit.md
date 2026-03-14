# Fal.ai Nano Banana Pro Edit (Image-to-Image) API Reference

Reference for integrating the Nano Banana Pro image-to-image/edit queue (`fal-ai/nano-banana-pro/edit`) via our `/api/fal` proxies.

## Authentication
- Set `FAL_KEY` in the runtime and keep it server-side.
- Proxies add `Authorization: Key $FAL_KEY` before forwarding.

## Submit (image-to-image/edit)
### Proxy endpoint
`POST /api/fal/nano-banana-pro-edit-submit` forwards to the Fal queue.

### Fal queue
`POST https://queue.fal.run/fal-ai/nano-banana-pro/edit` accepts:
```json
{
  "prompt": "make a photo of the man driving the car down the california coastline",
  "num_images": 1,
  "aspect_ratio": "auto",
  "output_format": "png",
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png",
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input-2.png"
  ],
  "resolution": "1K"
}
```

### Input fields
- `prompt` (string): required edit prompt.
- `image_urls` (string[]): required references; supports public URLs or base64 data URIs. We send up to 8.
- `num_images` (int): defaults to 1.
- `aspect_ratio` (enum): `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` (defaults to `auto` if invalid).
- `output_format` (enum): `png`, `jpeg`, `webp` (defaults to `png`).
- `resolution` (enum): `1K`, `2K`, `4K` (defaults to `1K`).
- `seed` (int), `sync_mode` (boolean), `limit_generations` (boolean), `enable_web_search` (boolean): optional, not set via UI.

## Status & results
- Poll `POST /api/fal/nano-banana-pro-edit-status` with `{ "requestId": "..." }`.
- The proxy fetches `GET https://queue.fal.run/fal-ai/nano-banana-pro/requests/$REQUEST_ID/status`; when complete it fetches `/requests/$REQUEST_ID`.
- Responses mirror Fal (status plus `images`/`description` if available).

## Output schema
- `images`: array of `{ url, content_type, file_name, width, height, file_size?, file_data? }`.
- `description`: optional string summary.

## Pricing (ShortPulse)
- Same as Nano Banana Pro text-to-image: base **$0.15 per image**.
- Conversion: `markedCredits = usd * 100 * 1.03`, `rawCredits = ceil(markedCredits)`, billed credits `= ceil(rawCredits / 5) * 5`.
- Current outcomes: 1K/2K = 20 credits, 4K = 35 credits, and enabling `web_search` adds $0.015 then rounds to the next 5-credit step.
- Aspect/resolution choice does not change the flat per-image price in our UI; references are required.

## Notes
- Keep requests on the server; do not expose `FAL_KEY` in the browser.
- This edit model is separate from `fal-ai/nano-banana-pro` (text-to-image) and requires `image_urls`.
