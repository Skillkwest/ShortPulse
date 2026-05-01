# Fal.ai Seedream 4.5 Text-to-Image API Reference

Use this guide to submit and poll Seedream 4.5 text-to-image jobs via the Fal queue (`fal-ai/bytedance/seedream/v4.5/text-to-image`). This keeps `FAL_KEY` server-side and aligns with AI Studio defaults and pricing.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/seedream-submit` and `/api/fal/seedream-status`.

## Submit (Text → Image)
`POST https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image`

Example (1 image, safety checker off):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "A selfie of a cat, twilight at the Eiffel Tower, holding baklava, slight motion blur and overexposed, selfie angle, text 'Seedream 4.5 is on fal' at the top in crisp lettering.",
    "image_size": "landscape_4_3",
    "num_images": 1,
    "enable_safety_checker": false,
    "output_format": "png"
  }'
```

### Parameters
- `prompt` (string, required): Scene description; include composition, style, and any text overlays if needed.
- `image_size` (enum/string or object): Use Fal enums (`square`, `square_hd`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto_2K`, `auto_4K`) or provide `{ width, height }`. AI Studio sends exact sizes for non-native ratios: `5:4`→`{2400,1920}`, `4:5`→`{1920,2400}`, `3:2`→`{2880,1920}`, `2:3`→`{1920,2880}`, `21:9`→`{4032,1728}`.
- `num_images` (integer): Default 1.
- `max_images` (integer): Optional multi-image batches.
- `seed` (integer): Optional reproducibility seed.
- `sync_mode` (boolean): If true, returns data URI and skips history.
- `enable_safety_checker` (boolean): Defaults to `true`.
- `output_format` (enum): `png` (default), `jpeg`, or `webp`.

## Status
- Poll: `GET https://queue.fal.run/fal-ai/bytedance/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/bytedance/requests/<request_id>`
- Proxies: `/api/fal/seedream-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "images": [
    { "url": "https://storage.googleapis.com/falserverless/example_outputs/seedreamv45/seedream_v45_t2i_output.png" }
  ],
  "seed": 42
}
```

## Defaults we apply (AI Studio)
- Aspect: `1:1` default; allowed: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.
- Image size behavior: native enums for `1:1`, `4:3`, `3:4`, `16:9`, `9:16`; exact custom dimensions for `5:4`, `4:5`, `3:2`, `2:3`, `21:9`; output format `png`; safety checker off by default; `num_images = 1`.
- Pricing: `seedream-per-image` base is $0.04; billed credits use shared conversion (`rawCredits = ceil(usd * creditPerDollar * (1 + perModelMarkupBps / 10000))`) and equal `rawCredits` unless a row-specific round-nearest override is configured. Current outcomes before per-model overrides: base 4 credits, 4K 8 credits.
- Proxy routes: `/api/fal/seedream-submit` and `/api/fal/seedream-status`.

## Notes
- Keep prompts safe for public URLs; avoid PII and sensitive content.
- The queue returns `images[].url`; AI Studio polls until `status` is success/completed.
- If Fal adds new enums (image sizes/aspects), update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc accordingly.***
