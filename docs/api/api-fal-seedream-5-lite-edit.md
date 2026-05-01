# Fal.ai Seedream 5 Lite Image-to-Image (Edit) API Reference

Use this guide to submit and poll Seedream 5 Lite image editing jobs via the Fal queue (`fal-ai/bytedance/seedream/v5/lite/edit`). This keeps `FAL_KEY` server-side and aligns with AI Studio defaults and pricing.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/seedream-v5-lite-edit-submit` and `/api/fal/seedream-status`.

## Submit (Image → Image/Edit)
`POST https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/edit`

Example (1 image, safety checker off):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/edit \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Replace the product with the one from reference 2 and keep the original lighting direction.",
    "image_size": "auto_2K",
    "num_images": 1,
    "max_images": 1,
    "enable_safety_checker": false,
    "image_urls": [
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png"
    ]
  }'
```

### Parameters
- `prompt` (string, required): Edit instructions for input images.
- `image_urls` (list<string>, required): Reference images; API allows up to 10.
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
- Image size behavior mirrors text-to-image: native enums for core ratios, exact custom dimensions for `5:4`, `4:5`, `3:2`, `2:3`, `21:9`, and aspect-locked `{width,height}` output for `auto_2K`/`auto_3K`.
- Safety checker off by default (`enable_safety_checker: false`).
- Reference cap: client passes up to 10 `image_urls` (matching API max).
- Pricing: Fal base is `$0.035` per image. ShortPulse billing conversion yields `4` credits per run by default before per-model overrides.
- Proxy routes: `/api/fal/seedream-v5-lite-edit-submit` and `/api/fal/seedream-status`.
