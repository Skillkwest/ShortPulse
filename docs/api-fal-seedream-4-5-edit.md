# Fal.ai Seedream 4.5 Image-to-Image (Edit) API Reference

Use this guide to submit and poll Seedream 4.5 image editing jobs via the Fal queue (`fal-ai/bytedance/seedream/v4.5/edit`). This keeps `FAL_KEY` server-side and aligns with AI Studio defaults and pricing.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/seedream-edit-submit` and `/api/fal/seedream-status`.

## Submit (Image → Image/Edit)
`POST https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit`

Example (1 image, safety checker off):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Replace the product in Figure 1 with that in Figure 2 and add the title text from Figure 3 at the top.",
    "image_size": "landscape_16_9",
    "num_images": 1,
    "enable_safety_checker": false,
    "image_urls": [
      "https://storage.googleapis.com/falserverless/example_inputs/seedreamv45/seedream_v45_edit_input_1.png",
      "https://storage.googleapis.com/falserverless/example_inputs/seedreamv45/seedream_v45_edit_input_2.png",
      "https://storage.googleapis.com/falserverless/example_inputs/seedreamv45/seedream_v45_edit_input_3.png"
    ]
  }'
```

### Parameters
- `prompt` (string, required): Edit instructions for the input images.
- `image_urls` (list<string>, required): Reference images for editing. Up to 10 are supported by the API.
- `image_size` (enum/string or object): One of `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto_2K`, `auto_4K`, or a `{ width, height }` object. Fal notes width/height must be between 1920 and 4096 (or total pixels between 25601440 and 40964096) when custom sizes are used.
- `num_images` (integer): Default 1.
- `max_images` (integer): Optional multi-image batches.
- `seed` (integer): Optional reproducibility seed.
- `sync_mode` (boolean): If true, returns data URI and skips history.
- `enable_safety_checker` (boolean): Defaults to `true` on Fal.

## Status
- Poll: `GET https://queue.fal.run/fal-ai/bytedance/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/bytedance/requests/<request_id>`
- Proxies: `/api/fal/seedream-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "images": [
    { "url": "https://storage.googleapis.com/falserverless/example_outputs/seedreamv45/seedream_v45_edit_output.png" }
  ]
}
```

## Defaults we apply (AI Studio)
- Aspect: `1:1` default; allowed: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.
- Image size enum is derived from aspect (shared mapping with text-to-image).
- Safety checker off by default (`enable_safety_checker: false`) to honor the “minimum safety” request.
- `num_images = 1`; references are passed from the reference grid (up to 4 today, API allows 10).
- Pricing: unchanged (`seedream-per-image` → 4 credits; 4K doubles to 8 credits).
- Proxy routes: `/api/fal/seedream-edit-submit` (submit) and `/api/fal/seedream-status` (status/result).

## Notes
- Keep prompts safe for public URLs; avoid PII and sensitive content.
- The queue returns `images[].url`; AI Studio polls until `status` is success/completed.
- If Fal updates size constraints or enum values, update `resolveSeedreamImageSize`, `modelRegistry.ts`, and this doc accordingly.***
