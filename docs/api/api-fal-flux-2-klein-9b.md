# Fal.ai FLUX 2 Klein 9B API Reference

Reference for integrating Fal.ai FLUX 2 Klein 9B (`fal-ai/flux-2/klein/9b`) in ShortPulse.

## Authentication
- Set `FAL_KEY` on the server.
- Send `Authorization: Key $FAL_KEY` on every request.

## Queue workflow
1) Submit
```bash
response=$(curl --request POST \
  --url https://queue.fal.run/fal-ai/flux-2/klein/9b \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "cinematic portrait in light rain",
    "image_size": "landscape_4_3",
    "num_images": 1,
    "output_format": "png"
  }')
REQUEST_ID=$(echo "$response" | grep -o '"request_id": *"[^"]*"' | sed 's/"//g' | cut -d: -f2)
```
2) Status aliases used by ShortPulse
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2/requests/$REQUEST_ID/status \
  --header "Authorization: Key $FAL_KEY"

curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/$REQUEST_ID/status \
  --header "Authorization: Key $FAL_KEY"
```
3) Result aliases used by ShortPulse
```bash
curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2/requests/$REQUEST_ID \
  --header "Authorization: Key $FAL_KEY"

curl --request GET \
  --url https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/$REQUEST_ID \
  --header "Authorization: Key $FAL_KEY"
```

## Schema (key fields)
- `prompt` (string, required)
- `image_size` (string enum or object)
- `num_images` (number)
- `num_inference_steps` (number)
- `guidance_scale` (number)
- `seed` (number)
- `enable_safety_checker` (boolean)
- `sync_mode` (boolean)
- `output_format` (enum: `png`, `jpeg`, `webp`)

## ShortPulse defaults
- Default aspect: `4:3` (via `image_size`)
- Allowed aspects: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`
- Safety checker: off by default (`enable_safety_checker: false`)
- Timeout budget: 60s

## Pricing (ShortPulse)
- FLUX 2 Klein 9B is an explicit fixed-price exception in ShortPulse.
- It is billed at **1 credit per run**.

## Source
- Fal model page: `https://fal.ai/models/fal-ai/flux-2/klein/9b/api`
- Catalog source of truth: `frontend/lib/model-runtime/modelCatalog.ts`
