# Fal.ai Imagen 4 Fast Text-to-Image API Reference

Reference for integrating Fal.ai’s Imagen 4 Fast (`fal-ai/imagen4/preview/fast`) queue endpoint.

## Authentication
- Set `FAL_KEY` in the environment.
- Send `Authorization: Key $FAL_KEY` on every request. Keep keys server-side only.

## Queue workflow
1) Submit
```bash
response=$(curl --request POST \
  --url https://queue.fal.run/fal-ai/imagen4/preview/fast \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Atmospheric narrative illustration...",
    "aspect_ratio": "1:1",
    "num_images": 1,
    "output_format": "png"
  }')
REQUEST_ID=$(echo "$response" | grep -o '"request_id": *"[^"]*"' | sed 's/"//g' | cut -d: -f2)
```
2) Status
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/imagen4/requests/$REQUEST_ID/status \
  --header "Authorization: Key $FAL_KEY"
```
3) Result
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/imagen4/requests/$REQUEST_ID \
  --header "Authorization: Key $FAL_KEY"
```

## Schema (key fields)
- `prompt` (string, required)
- `aspect_ratio` (enum, defaults to `1:1`): `1:1`, `16:9`, `9:16`, `4:3`, `3:4`
- `num_images` (integer, default 1)
- `output_format` (enum `jpeg` | `png` | `webp`, default `png`)
- `sync_mode` (boolean): return data URI when true; skipped in our flow.

### Output
- `images`: array of `{ url, content_type, width, height }`
- `description`: optional text description

## Pricing (ShortPulse)
- Provider rate: **$0.02 per image**.
- Credits are valued at $0.01 each.
- Calculation: `usd = 0.02`, `credits = ceil(usd / 0.01)` (minimum 1). Aspect selection does not change cost.

## Defaults we use in AI Studio
- Aspect ratio: defaults to `1:1` (clamped to allowed set if needed)
- Output format: png
- Images per request: 1

## Notes
- Keep keys server-side; never expose `FAL_KEY` in the client.
