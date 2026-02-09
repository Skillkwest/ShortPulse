# Fal.ai FLUX.1 [dev] Text-to-Image API Reference

Reference for ShortPulse engineers integrating Fal.ai’s FLUX.1 [dev] text-to-image flow transformer (`fal-ai/flux/dev`) via the Queue API (plus optional streaming). Includes auth, enqueue/poll lifecycle, schema, and output details.

## Authentication

- Set environment variable `FAL_KEY` and send `Authorization: Key $FAL_KEY` header.
- Never expose the key on client-side code; use a secure backend gateway.

## Queue workflow

1. **Submit** the request:
   ```bash
   response=$(curl --request POST \
     --url https://queue.fal.run/fal-ai/flux/dev \
     --header "Authorization: Key $FAL_KEY" \
     --header "Content-Type: application/json" \
     --data '{ "prompt": "..." }')
   REQUEST_ID=$(echo "$response" | grep -o '"request_id": *"[^"]*"' | sed 's/"request_id": *//; s/"//g')
   ```
2. **Check status**:
   ```bash
   curl --request GET \
     --url https://queue.fal.run/fal-ai/flux/requests/$REQUEST_ID/status \
     --header "Authorization: Key $FAL_KEY"
   ```
3. **Fetch result**:
   ```bash
   curl --request GET \
     --url https://queue.fal.run/fal-ai/flux/requests/$REQUEST_ID \
     --header "Authorization: Key $FAL_KEY"
   ```
- Queue handles long-running workloads; use webhooks when you can instead of blocking.

## Streaming support

- Stream responses in near real time by hitting `https://fal.run/fal-ai/flux/dev/stream` with the same payload and headers; keep `--no-buffer` to receive SSE chunks.

## Schema

### Input fields
- `prompt` (string, required): Describe the desired image.
- `image_size` (enum or width/height): Defaults to `landscape_4_3`. Can be `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, or a `{ "width": ..., "height": ... }` object.
- `num_inference_steps` (integer, default 28): More steps = sharper details.
- `seed` (integer): Repeatable output when reusing model + prompt.
- `guidance_scale` (float, default 3.5): CFG strength for prompt adherence.
- `sync_mode` (boolean): If true, response is returned as data URI; skip history storage.
- `num_images` (integer, default 1): How many images to generate.
- `enable_safety_checker` (boolean, default true): Run the safety filter.
- `output_format` (enum, default `jpeg`): Choose `jpeg` or `png`.
- `acceleration` (enum, default `none`): `none`, `regular`, or `high`.

### Output shape
- `images`: Array of generated images (`url`, `content_type`, `width`, `height`).
- `prompt`: Echo of the input prompt.
- `timings`: Performance metadata.
- `seed`: Deterministic seed used.
- `has_nsfw_concepts`: Boolean list if safety checker flagged content.

## File inputs

- The API accepts Base64 data URIs or publicly accessible URLs for any file-like attribute; uploads happen via Fal.ai storage/API if needed.

## Best practices

1. Document the `seed` if you need deterministic re-generation (same seed + prompt + model results in identical output).
2. Use streaming (`/stream` endpoint) for progressive rendering or UI previews.
3. Favor `large` image_size values only when needed to control cost/time; test `acceleration` settings for throughput vs quality.
