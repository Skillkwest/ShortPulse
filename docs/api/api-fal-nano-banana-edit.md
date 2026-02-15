# Fal.ai Nano Banana Edit (Image-to-Image) API Reference

Reference for integrating the Nano Banana image-to-image/edit queue (`fal-ai/nano-banana/edit`) via our `/api/fal` proxies.

## Authentication
- Set `FAL_KEY` in the runtime and keep it server-side.
- Requests to Fal are proxied; we add `Authorization: Key $FAL_KEY` before forwarding.

## Submit (image-to-image/edit)
### Proxy endpoint
`POST /api/fal/nano-banana-edit-submit` forwards to the Fal queue.

### Fal queue
`POST https://queue.fal.run/fal-ai/nano-banana/edit` accepts:
```json
{
  "prompt": "make a photo of the man driving the car down the california coastline",
  "num_images": 1,
  "aspect_ratio": "auto",
  "output_format": "png",
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png",
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input-2.png"
  ]
}
```

### Input fields
- `prompt` (string): required edit prompt.
- `image_urls` (string[]): required reference images; supports public URLs or base64 data URIs. We send up to 8.
- `num_images` (int): defaults to 1.
- `aspect_ratio` (enum): `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` (defaults to `auto` if invalid).
- `output_format` (enum): `png`, `jpeg`, `webp` (defaults to `png`).
- `sync_mode` (boolean): optional data URI return path; not enabled in the UI.
- `limit_generations` (boolean): optional; not used in the UI.

## Status & results
- Poll `POST /api/fal/nano-banana-edit-status` with `{ "requestId": "..." }`.
- The proxy fetches `GET https://queue.fal.run/fal-ai/nano-banana/requests/$REQUEST_ID/status`; when complete it fetches `/requests/$REQUEST_ID` for results.
- Responses mirror Fal (status plus `images`/`description` if available).

## Output schema
- `images`: array of `{ url, content_type, file_name, width, height, file_size?, file_data? }`.
- `description`: optional string summary.

## Pricing (ShortPulse)
- Same as Nano Banana text-to-image: **$0.039 per image**.
- Conversion: `rawCredits = ceil(0.039 / 0.01) = 4`, billed credits `= ceil(4 / 5) * 5 = 5`.
- Aspect choice does not affect cost; reference images are required for this edit model.

## Notes
- Keep requests on the server; do not expose `FAL_KEY` in the browser.
- The edit model is distinct from `fal-ai/nano-banana` (text-to-image) and requires `image_urls`.
