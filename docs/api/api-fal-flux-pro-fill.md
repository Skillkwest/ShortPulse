# Fal.ai FLUX Pro Fill API Reference

Reference for integrating FLUX Pro Fill inpaint (`fal-ai/flux-pro/v1/fill`) through ShortPulse Fal proxies.
ShortPulse catalog model id: `fal-ai/flux-pro/v1/fill`.

## Authentication
- Set `FAL_KEY` in the server runtime only.
- Proxies attach `Authorization: Key $FAL_KEY` for upstream Fal requests.

## Submit (Inpaint)
### Proxy endpoint
Active client path:
- `POST /api/fal/image-submit` with `modelId: "fal-ai/flux-pro/v1/fill"`

Legacy dedicated submit route:
- `POST /api/fal/flux-pro-fill-submit`
- retained for direct proxy coverage/tests, but not the primary client submit path.

### Fal queue
`POST https://queue.fal.run/fal-ai/flux-pro/v1/fill`

Example payload:
```json
{
  "prompt": "remove the selected object and blend naturally",
  "image_url": "https://cdn.example.com/base.png",
  "mask_url": "https://cdn.example.com/mask.png",
  "num_images": 1,
  "output_format": "png"
}
```

### Input fields
- `prompt` (string, required)
- `image_url` (string, required): base image.
- `mask_url` (string, required): inpaint mask.
- `output_format` (enum, optional): `png` or `jpeg` (ShortPulse uses `png`).
- `num_images` (number, optional)
- `seed` (number, optional)
- `sync_mode` (boolean, optional)
- `enhance_prompt` (boolean, optional)

## Status and result
- Active client polling path:
  - `POST /api/fal/image-status` with `{ "modelId": "fal-ai/flux-pro/v1/fill", "requestId": "..." }`
- Legacy dedicated status route:
  - `POST /api/fal/flux-pro-fill-status`
- Proxy checks configured status base URLs and fetches result on completion.
- Catalog fallback bases include both:
  - `https://queue.fal.run/fal-ai/flux-pro/requests`
  - `https://queue.fal.run/fal-ai/flux-pro/v1/fill/requests`

## Output schema
- Standard Fal image result payload (`images[]` and/or `image` URL objects depending on upstream response shape).

## ShortPulse defaults and wiring notes
- Used as hidden internal inpaint model (not exposed in picker).
- Expert Edit inpaint flow submits flattened base image + exported mask window.
- Expert Edit inpaint currently supports only the primary base image plus mask. Secondary prompt-reference images are not transmitted to FLUX Fill.
- Polling provider token: `fal-flux-pro-fill`.

## Pricing (ShortPulse)
- Uses pricing strategy `fal-flux2-pro-per-mp`.

## Security notes
- Never expose `FAL_KEY` in browser code.
- Keep requests server-side through `/api/fal/*` routes.
