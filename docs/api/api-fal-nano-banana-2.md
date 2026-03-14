# Fal.ai Nano Banana 2 Image API Reference

Reference for integrating the `fal-ai/nano-banana-2` queue via ShortPulse `/api/fal` proxies.

## Authentication
- Set `FAL_KEY` in the runtime and keep it server-side.
- Requests are proxied; the server appends `Authorization: Key $FAL_KEY`.

## Submit (text-to-image)
### Proxy endpoint
`POST /api/fal/nano-banana-2-submit`

### Fal queue endpoint
`POST https://queue.fal.run/fal-ai/nano-banana-2`

Example payload:
```json
{
  "prompt": "An action shot of a black lab swimming in an inground suburban pool.",
  "num_images": 1,
  "aspect_ratio": "auto",
  "output_format": "png",
  "resolution": "1K"
}
```

### Input fields
- `prompt` (string): required prompt.
- `num_images` (int): defaults to `1`; ShortPulse sends `1`.
- `aspect_ratio` (enum): `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`.
- `output_format` (enum): `png`, `jpeg`, `webp`.
- `resolution` (enum): `0.5K`, `1K`, `2K`, `4K` (default `1K`).
- `seed` (int): optional.
- `safety_tolerance` (enum `1..6`): optional API-only moderation strictness.
- `sync_mode` (boolean): optional direct data URI mode.
- `limit_generations` (boolean): optional Fal flag to limit to one generation per prompt round.
- `enable_web_search` (boolean): optional web-search augmentation.

## Status & result fetching
- Poll `POST /api/fal/nano-banana-2-status` with `{ "requestId": "..." }`.
- Proxy status source: `GET https://queue.fal.run/fal-ai/nano-banana-2/requests/$REQUEST_ID/status`.
- On completion, proxy fetches `GET .../requests/$REQUEST_ID` and returns normalized payload.

## Output schema
- `images`: list of `ImageFile` objects (`url`, `content_type`, `file_name`, optional `width`, `height`, `file_size`).
- `description`: optional string.

## Pricing (ShortPulse)
- Base provider cost: `$0.08` per image.
- Resolution multipliers:
  - `0.5K` -> `x0.75`
  - `1K` -> `x1`
  - `2K` -> `x1.5`
  - `4K` -> `x2`
- Web search surcharge: `+$0.015` when enabled.
- Credit conversion:
  - `markedCredits = usd * 100 * 1.03`
  - `rawCredits = ceil(markedCredits)`
  - `credits = ceil(rawCredits / 5) * 5`

## Defaults we ship
- `num_images`: `1`
- `aspect_ratio`: clamped to allowed list with `auto` fallback
- `output_format`: `png`
- `resolution`: `1K`
- `enable_web_search`: not exposed in AI Studio UI

## Notes
- Keep `FAL_KEY` server-side only.
- `fal-ai/nano-banana-2` is text-to-image; image-edit flows use `fal-ai/nano-banana-2/edit`.
