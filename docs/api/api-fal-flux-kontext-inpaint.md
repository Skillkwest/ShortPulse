# Fal.ai FLUX Kontext Inpaint API Reference

Reference for integrating FLUX Kontext LoRA Inpaint (`fal-ai/flux-kontext-lora/inpaint`) through ShortPulse Fal proxies.
ShortPulse catalog model id: `fal-ai/flux-kontext-lora/inpaint`.

## Authentication
- Set `FAL_KEY` in the server runtime only.
- Proxies attach `Authorization: Key $FAL_KEY` for upstream Fal requests.

## Submit (Reference Inpaint)
### Proxy endpoint
Active client path:
- `POST /api/fal/flux-kontext-inpaint-submit`

### Fal queue
`POST https://queue.fal.run/fal-ai/flux-kontext-lora/inpaint`

Example payload:
```json
{
  "prompt": "replace the masked outfit with the reference garment",
  "image_url": "https://cdn.example.com/base.png",
  "mask_url": "https://cdn.example.com/mask.png",
  "reference_image_url": "https://cdn.example.com/reference.png",
  "num_images": 1,
  "output_format": "png"
}
```

### Input fields
- `prompt` (string, required)
- `image_url` (string, required): base image.
- `mask_url` (string, required): inpaint mask.
- `reference_image_url` (string, required): one secondary reference image.
- `output_format` (enum, optional): `png` or `jpeg` (ShortPulse uses `png`).
- `num_images` (number, optional)
- `seed` (number, optional)
- `guidance_scale` (number, optional)
- `num_inference_steps` (number, optional)
- `sync_mode` (boolean, optional)

## Status and result
- Active client polling path:
  - `POST /api/fal/flux-kontext-inpaint-status`
- Catalog fallback base:
  - `https://queue.fal.run/fal-ai/flux-kontext-lora/inpaint/requests`

## ShortPulse defaults and wiring notes
- Hidden internal masked-edit lane, not exposed as a normal model-picker choice.
- Selected only when inpaint prompt linking resolves to exactly one unique secondary reference token.
- Polling provider token: `fal-flux-kontext-inpaint`.

## Pricing (ShortPulse)
- Uses pricing strategy `fal-flux-kontext-inpaint-per-mp`.

## Security notes
- Never expose `FAL_KEY` in browser code.
- Keep requests server-side through `/api/fal/*` routes.
