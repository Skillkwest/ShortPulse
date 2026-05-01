# Fal.ai Seedream 5 Lite Text-to-Image API Reference

Use this guide to submit and poll Seedream 5 Lite text-to-image jobs via the Fal queue (`fal-ai/bytedance/seedream/v5/lite/text-to-image`). This keeps `FAL_KEY` server-side and aligns with AI Studio defaults and pricing.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/seedream-v5-lite-submit` and `/api/fal/seedream-status`.

## Submit (Text → Image)
`POST https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image`

Example (1 image, safety checker off):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Realistic DSLR photo of a dog eating ramen on the Great Wall, with dramatic sunset light.",
    "image_size": "auto_2K",
    "num_images": 1,
    "max_images": 1,
    "enable_safety_checker": false
  }'
```

### Parameters
- `prompt` (string, required): Scene description and style instructions.
- `image_size` (enum/string or object): `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto_2K`, `auto_3K`, or `{ width, height }`.
- `num_images` (integer): Number of generations. Default `1`.
- `max_images` (integer): Optional multi-image output cap. Default `1`.
- `seed` (integer): Optional reproducibility seed.
- `sync_mode` (boolean): If true, returns data URI and skips history.
- `enable_safety_checker` (boolean): Fal default is `true`.

## Status
- Poll: `GET https://queue.fal.run/fal-ai/bytedance/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/bytedance/requests/<request_id>`
- Proxy: `/api/fal/seedream-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "images": [
    { "url": "https://v3b.fal.media/files/example.png" }
  ],
  "seed": 42
}
```

## Defaults we apply (AI Studio)
- Aspect: `1:1` default; allowed: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.
- Resolution options: `auto_2K` (default) and `auto_3K`.
- Image size behavior: native enums for `1:1`, `4:3`, `3:4`, `16:9`, `9:16`; exact custom dimensions for `5:4`, `4:5`, `3:2`, `2:3`, `21:9`; for `auto_2K` and `auto_3K`, the client sends aspect-locked `{width,height}` objects.
- Safety checker off by default (`enable_safety_checker: false`).
- Pricing: Fal base is `$0.035` per image. ShortPulse billing uses shared conversion (`rawCredits = ceil(usd * creditPerDollar * (1 + perModelMarkupBps / 10000))`) and bills `rawCredits` unless a row-specific round-nearest override is configured, resulting in `4` credits per run before per-model overrides.
- Proxy routes: `/api/fal/seedream-v5-lite-submit` and `/api/fal/seedream-status`.
