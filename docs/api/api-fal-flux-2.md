# Fal.ai FLUX 2 Text-to-Image API Reference

Reference for integrating Fal.ai’s FLUX 2 (`fal-ai/flux-2`) text-to-image queue endpoint.
ShortPulse catalog model id: `fal/flux-2`.

## Authentication
- Set `FAL_KEY` in the environment.
- Send `Authorization: Key $FAL_KEY` on every request. Keep keys server-side only.

## Queue workflow
1) Submit
```bash
response=$(curl --request POST \
  --url https://queue.fal.run/fal-ai/flux-2 \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Dutch angle close-up...",
    "guidance_scale": 15,
    "num_inference_steps": 41,
    "image_size": "landscape_4_3",
    "num_images": 1,
    "output_format": "png"
  }')
REQUEST_ID=$(echo "$response" | grep -o '"request_id": *\"[^\"]*\"' | sed 's/\"//g' | cut -d: -f2)
```
2) Status
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2/requests/$REQUEST_ID/status \
  --header "Authorization: Key $FAL_KEY"
```
3) Result
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2/requests/$REQUEST_ID \
  --header "Authorization: Key $FAL_KEY"
```

## Schema (key fields)
- `prompt` (string, required)
- `guidance_scale` (float, default 2.5) — we use **15** as the model-tuned default.
- `num_inference_steps` (int, default 28) — we use **41** as the model-tuned default.
- `image_size` (enum or `{ width, height }`, defaults to `landscape_4_3`). Enums: `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`.
- `num_images` (int, default 1)
- `acceleration` (enum: `none`, `regular`, `high`, default `regular`)
- `enable_prompt_expansion` (boolean)
- `enable_safety_checker` (boolean, default true)
- `output_format` (enum: `jpeg`, `png`, `webp`, default `png`)
- `seed`, `sync_mode`, `file_data`-style inputs as supported by Fal’s file handling.

### Output
- `images`: array of `{ url, content_type, width, height }`
- `prompt`, `seed`, `timings`, `has_nsfw_concepts`

## Pricing (ShortPulse)
- Provider rate: **$0.012 per megapixel**.
- Credits are valued at $0.01 each.
- Calculation: `megapixels = (width * height) / 1_000_000`, `usd_raw = megapixels * 0.012`, `rawCredits = ceil(usd_raw / 0.01)`, `credits = ceil(rawCredits / 5) * 5`. We use aspect → size mapping (1:1=1024x1024, 4:3=1200x900, 3:4=900x1200, 16:9=1344x756, 9:16=756x1344).

## Defaults we use in AI Studio
- Guidance scale: **15**
- Inference steps: **41**
- Output format: **png**
- Image size: aspect-driven map listed above; default aspect `4:3`
- Safety checker: off by default (`enable_safety_checker: false`)
- Images per request: 1

## Notes
- Use streaming (`https://fal.run/fal-ai/flux-2/stream`) for progressive responses if needed.
- Keep keys server-side; never expose `FAL_KEY` in the client.***
