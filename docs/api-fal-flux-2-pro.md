# Fal.ai FLUX 2 PRO Text-to-Image API Reference

Reference for integrating Fal.ai’s FLUX 2 PRO (`fal-ai/flux-2-pro`) queue endpoint.

## Authentication
- Set `FAL_KEY` in the environment.
- Send `Authorization: Key $FAL_KEY` on every request. Keep keys server-side only.

## Queue workflow
1) Submit
```bash
response=$(curl --request POST \
  --url https://queue.fal.run/fal-ai/flux-2-pro \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "An intense close-up ...",
    "image_size": "landscape_4_3",
    "safety_tolerance": "5",
    "enable_safety_checker": false,
    "output_format": "png"
  }')
REQUEST_ID=$(echo "$response" | grep -o '"request_id": *\"[^\"]*\"' | sed 's/\"//g' | cut -d: -f2)
```
2) Status
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2-pro/requests/$REQUEST_ID/status \
  --header "Authorization: Key $FAL_KEY"
```
3) Result
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2-pro/requests/$REQUEST_ID \
  --header "Authorization: Key $FAL_KEY"
```

## Schema (key fields)
- `prompt` (string, required)
- `image_size` (enum or `{ width, height }`, defaults to `landscape_4_3`). Enums: `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`.
- `seed` (integer)
- `safety_tolerance` (enum 1–5, default 2). We set to **5** and `enable_safety_checker` false for lowest filtering.
- `enable_safety_checker` (boolean, default true). We set **false**.
- `output_format` (enum `jpeg` | `png`, default `jpeg`). We use **png**.
- `sync_mode` (boolean): return data URI when true; skipped in our flow.

### Output
- `images`: array of `{ url, content_type, width, height }`
- `seed`

## Pricing (ShortPulse)
- Provider rate: **$0.03 for the first megapixel**, **$0.015 for each additional (rounded up) megapixel**.
- Credits are valued at $0.01 each.
- Calculation: `megapixels = (width * height) / 1_000_000`; `mpUnits = max(1, ceil(megapixels))`; `usd_raw = 0.03 + max(0, mpUnits - 1) * 0.015`; `credits = ceil(usd_raw / 0.01)` (minimum 1). Aspect → size mapping: 1:1=1024x1024, 4:3=1200x900, 3:4=900x1200, 16:9=1344x756, 9:16=756x1344.

## Defaults we use in AI Studio
- Safety: `enable_safety_checker: false`, `safety_tolerance: "5"` (least restrictive available).
- Output format: png
- Image size: aspect-driven map listed above; default aspect `4:3`
- Images per request: 1

## Notes
- Stream endpoint: `https://fal.run/fal-ai/flux-2-pro/stream` is available if progressive responses are needed.
- Keep keys server-side; never expose `FAL_KEY` in the client.
