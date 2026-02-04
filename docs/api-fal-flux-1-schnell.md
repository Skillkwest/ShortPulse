# Fal.ai FLUX.1 [schnell] Text-to-Image API Reference

Reference for integrating Fal.ai’s FLUX.1 [schnell] (`fal-ai/flux-1/schnell`) queue endpoint.

## Authentication
- Set `FAL_KEY` in the environment.
- Send `Authorization: Key $FAL_KEY` on every request. Keep keys server-side only.

## Queue workflow
1) Submit
```bash
response=$(curl --request POST \
  --url https://queue.fal.run/fal-ai/flux-1/schnell \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Extreme close-up of a single tiger eye...",
    "num_inference_steps": 4,
    "guidance_scale": 3.5,
    "image_size": "landscape_4_3",
    "num_images": 1,
    "output_format": "jpeg",
    "enable_safety_checker": true,
    "acceleration": "regular"
  }')
REQUEST_ID=$(echo "$response" | grep -o '"request_id": *\"[^\"]*\"' | sed 's/\"//g' | cut -d: -f2)
```
2) Status
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-1/requests/$REQUEST_ID/status \
  --header "Authorization: Key $FAL_KEY"
```
3) Result
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-1/requests/$REQUEST_ID \
  --header "Authorization: Key $FAL_KEY"
```

## Schema (key fields)
- `prompt` (string, required)
- `num_inference_steps` (int, default 4)
- `guidance_scale` (float, default 3.5)
- `image_size` (enum or `{ width, height }`, default `landscape_4_3`). Enums: `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`.
- `seed` (int)
- `sync_mode` (boolean)
- `num_images` (int, default 1)
- `enable_safety_checker` (boolean, default true)
- `output_format` (enum: `jpeg`, `png`, default `jpeg`)
- `acceleration` (enum: `none`, `regular`, `high`, default `regular`)

### Output
- `images`: array of `{ url, content_type, width, height }`
- `prompt`, `seed`, `timings`, `has_nsfw_concepts`

## Pricing (ShortPulse)
- Provider rate: **$0.003 per megapixel**.
- Credits are valued at $0.01 each.
- Calculation: `megapixels = (width * height) / 1_000_000`, `usd_raw = megapixels * 0.003`, `credits = ceil(usd_raw / 0.01)` (minimum 1 credit). We use aspect → size mapping (1:1=1024x1024, 4:3=1200x900, 3:4=900x1200, 16:9=1344x756, 9:16=756x1344).

## Defaults we use in AI Studio
- Inference steps: **4**
- Guidance scale: **3.5**
- Output format: **jpeg**
- Image size: aspect-driven map listed above; default aspect `4:3`
- Safety checker: enabled
- Acceleration: `regular`
- Images per request: 1

## Notes
- Keep keys server-side; never expose `FAL_KEY` in the client.
