# Fal.ai FLUX 2 Edit (Image-to-Image) API Reference

Reference for integrating the FLUX.2 image-to-image/edit queue (`fal-ai/flux-2/edit`) via our `/api/fal` proxies.
ShortPulse catalog model id: `fal/flux-2/edit`.

## Authentication
- Set `FAL_KEY` in the runtime and keep it server-side.
- Proxies add `Authorization: Key $FAL_KEY` before forwarding.

## Submit (image-to-image/edit)
### Proxy endpoint
`POST /api/fal/flux2-edit-submit` forwards to the Fal queue.

### Fal queue
`POST https://queue.fal.run/fal-ai/flux-2/edit` accepts:
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
  "acceleration": "regular",
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
- `num_inference_steps` (int): defaults to 28 (we use the model default for edit).
- `num_images` (int): defaults to 1.
- `acceleration` (enum): `none`, `regular`, `high` (we send `regular`).
- `enable_safety_checker` (boolean): defaults true; we disable by default for edit per product direction.
- `output_format` (enum): `png`, `jpeg`, `webp` (we send `png`).
- `sync_mode`, `seed`, `enable_prompt_expansion`: optional, not set via UI.

## Status & results
- Poll `POST /api/fal/flux2-edit-status` with `{ "requestId": "..." }`.
- Proxy fetches `GET https://queue.fal.run/fal-ai/flux-2/requests/$REQUEST_ID/status`; when complete it fetches `/requests/$REQUEST_ID`.
- Responses mirror Fal (status plus `images`/`timings`/`seed` if available).

## Output schema
- `images`: array of `{ url, content_type, file_name, width, height, file_size?, file_data? }`.
- `timings`, `seed`, `prompt`, `has_nsfw_concepts`.

## Pricing (ShortPulse)
- Same as FLUX.2 text-to-image: **$0.012 per megapixel** → credits = `ceil((width*height/1_000_000 * 0.012) / 0.01)` (minimum 1 credit).
- Aspect/size map matches text-to-image; edit uses the same per-MP pricing.

## Notes
- Keep requests on the server; do not expose `FAL_KEY` in the browser.
- Streaming endpoint exists (`/edit/stream`) but is not wired in the UI.
