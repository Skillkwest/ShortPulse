# Fal.ai Nano Banana 2 Edit (Image-to-Image) API Reference

Reference for integrating `fal-ai/nano-banana-2/edit` via ShortPulse `/api/fal` proxies.

## Authentication
- Configure `FAL_KEY` server-side only.
- Proxies add `Authorization: Key $FAL_KEY` before forwarding to Fal.

## Submit (image-to-image/edit)
### Proxy endpoint
`POST /api/fal/nano-banana-2-edit-submit`

### Fal queue endpoint
`POST https://queue.fal.run/fal-ai/nano-banana-2/edit`

Example payload:
```json
{
  "prompt": "Preserve composition and restyle this portrait in a cinematic look.",
  "num_images": 1,
  "aspect_ratio": "auto",
  "output_format": "png",
  "resolution": "1K",
  "image_urls": [
    "https://cdn.shortpulse.test/reference-1.png"
  ]
}
```

### Input fields
- `prompt` (string): required edit prompt.
- `image_urls` (string[]): required reference URLs; at least one image is required.
- `num_images` (int): defaults to `1`.
- `aspect_ratio` (enum): `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`.
- `output_format` (enum): `png`, `jpeg`, `webp`.
- `resolution` (enum): `0.5K`, `1K`, `2K`, `4K` (default `1K`).
- `seed` (int), `safety_tolerance` (enum `1..6`), `sync_mode` (boolean), `limit_generations` (boolean), and `enable_web_search` (boolean): optional API fields.

## Status & result fetching
- Poll `POST /api/fal/nano-banana-2-edit-status` with `{ "requestId": "..." }`.
- Proxy status source:
  - `GET https://queue.fal.run/fal-ai/nano-banana-2/requests/$REQUEST_ID/status`
  - fallback compatible base also supported via catalog aliases.
- On completion, proxy fetches `GET .../requests/$REQUEST_ID`.

## Output schema
- `images`: array of image objects (`url`, `content_type`, `file_name`, optional `width`, `height`, `file_size`).
- `description`: optional string summary.

## Pricing (ShortPulse)
- Same pricing strategy as Nano Banana 2 text-to-image:
  - Base `$0.08` per image
  - `0.5K x0.75`, `1K x1`, `2K x1.5`, `4K x2`
  - `enable_web_search` adds `$0.015`
- Credit conversion:
  - `markedCredits = usd * 100 * 1.03`
  - `rawCredits = ceil(markedCredits)`
  - `credits = ceil(rawCredits / 5) * 5`

## Defaults we ship
- `num_images`: `1`
- `aspect_ratio`: clamped to allowed list with `auto` fallback
- `output_format`: `png`
- `resolution`: `1K`
- `image_urls`: first 8 prepared references
- `enable_web_search`: not exposed in AI Studio UI

## Notes
- Keep requests server-side; do not expose `FAL_KEY` to clients.
- This edit route requires `image_urls` and is distinct from `fal-ai/nano-banana-2` text-to-image.
