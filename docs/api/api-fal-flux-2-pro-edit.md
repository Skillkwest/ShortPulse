# Fal.ai FLUX 2 PRO Edit (Image-to-Image) API Reference

Reference for integrating the FLUX 2 PRO image-to-image/edit queue (`fal-ai/flux-2-pro/edit`) via our `/api/fal` proxies.
ShortPulse catalog model id: `fal/flux-2-pro/edit`.

## Authentication
- Set `FAL_KEY` in the runtime; keep it server-side.
- Proxies add `Authorization: Key $FAL_KEY` before forwarding.

## Submit (image-to-image/edit)
### Proxy endpoint
`POST /api/fal/flux2pro-edit-submit` forwards to the Fal queue.

### Fal queue
`POST https://queue.fal.run/fal-ai/flux-2-pro/edit` accepts:
```json
{
  "prompt": "Change his clothes to casual suit and tie",
  "guidance_scale": 2.5,
  "num_inference_steps": 28,
  "image_size": {
    "width": 2016,
    "height": 1152
  },
  "num_images": 1,
  "safety_tolerance": "5",
  "enable_safety_checker": false,
  "output_format": "png",
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/flux2_dev_edit_input.png"
  ]
}
```

### Input fields
- `prompt` (string): required edit prompt.
- `image_urls` (string[]): required references; up to 4; supports public URLs or base64 data URIs.
- `image_size` (enum or `{ width, height }`): same enums as text-to-image (`square`, `square_hd`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`); custom width/height allowed.
- `guidance_scale` (float): defaults to 2.5 (we set low by default).
- `num_inference_steps` (int): defaults to 28 (we use the edit defaults).
- `num_images` (int): defaults to 1.
- `safety_tolerance` (enum 1–5): defaults to 2; we set **"5"** and `enable_safety_checker: false` to minimize filtering.
- `enable_safety_checker` (boolean): defaults true; disabled in ShortPulse per product direction.
- `output_format` (enum): `png`, `jpeg`, `webp` (we send `png`).
- `acceleration`, `seed`, `sync_mode`, `enable_prompt_expansion`: optional, not set via UI.

## Status & results
- Poll `POST /api/fal/flux2pro-edit-status` with `{ "requestId": "..." }`.
- Proxy fetches `GET https://queue.fal.run/fal-ai/flux-2-pro/requests/$REQUEST_ID/status`; when complete it fetches `/requests/$REQUEST_ID`.
- Responses mirror Fal (status plus `images`/`timings`/`seed` when present).

## Output schema
- `images`: array of `{ url, content_type, file_name?, width, height, file_size?, file_data? }`.
- `timings`, `seed`, `prompt`, `has_nsfw_concepts`.

## Pricing (ShortPulse)
- Provider pricing: **$0.03 for the first megapixel of output**, plus **$0.015 per extra megapixel of input and output** (rounded up to nearest MP).
- Runtime normalization for deterministic debit parity: edit input is treated as normalized `1 MP`; output MP is rounded up from selected output size.
- Credit conversion:
  - `markedCredits = usd * 100 * 1.03`
  - `rawCredits = ceil(markedCredits)`
  - `credits = ceil(rawCredits / 5) * 5`
- Default lane (`4:3` output) outcome: `$0.06` -> `rawCredits=7` -> `10` billed credits.
- Aspect → size map matches text-to-image; default aspect `4:3` (1024x768 class), see `falSizeForAspect`.

## Defaults we use in AI Studio
- Safety: `enable_safety_checker: false`, `safety_tolerance: "5"` (least restrictive).
- Image params: `guidance_scale: 2.5`, `num_inference_steps: 28`, `num_images: 1`, `output_format: "png"`.
- Required references: we send up to 4 `image_urls`; generations fail fast when none are provided.

## Notes
- Keep requests on the server; do not expose `FAL_KEY` in the client.
- Streaming endpoint exists but is not wired in the UI.
