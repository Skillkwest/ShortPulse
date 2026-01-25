# Fal.ai Kling 2.5 Turbo Pro Image-to-Video API Reference

Use this guide to submit and poll Kling 2.5 Turbo Pro image-to-video jobs via the Fal queue (`fal-ai/kling-video/v2.5-turbo/pro/image-to-video`). This keeps `FAL_KEY` server-side and matches AI Studio defaults (requires an image reference).

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/kling-v25-image-to-video-submit` and `/api/fal/kling-v25-image-to-video-status`.

## Submit (Image → Video)
`POST https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video`

Example (10s, 16:9):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Slow push-in on a neon-lit alley, rain-slick pavement, reflective puddles, cinematic mood.",
    "image_url": "https://example.com/reference.jpg",
    "duration": "10",
    "aspect_ratio": "16:9",
    "negative_prompt": "blur, distort, and low quality",
    "cfg_scale": 0.5
  }'
```

### Parameters
- `prompt` (string, required): Scene description.
- `image_url` (string, required): Reference image URL.
- `duration` (enum/string): Defaults to `10` seconds in AI Studio.
- `aspect_ratio` (enum): `16:9` (default), `9:16`, or `1:1`.
- `negative_prompt` (string): Defaults to `"blur, distort, and low quality"`.
- `cfg_scale` (float): Optional guidance strength (default `0.5`).

## Status
- Poll: `GET https://queue.fal.run/fal-ai/kling-video/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/kling-video/requests/<request_id>`
- Proxies: `/api/fal/kling-v25-image-to-video-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "video": {
    "url": "https://v3b.fal.media/files/..._output.mp4",
    "content_type": "video/mp4"
  }
}
```

## Defaults we apply (AI Studio)
- Aspect: `16:9` default (allowed: `16:9`, `9:16`, `1:1`).
- Duration: 10s; resolution tier not specified by provider; audio handling follows provider defaults.
- Pricing: `kling-2.5-per-duration` ($0.35 for 5s + $0.07/additional s; defaults to 10s → 70 credits).
- Proxy routes: `/api/fal/kling-v25-image-to-video-submit` and `/api/fal/kling-v25-image-to-video-status`.

## Notes
- Image reference is mandatory; AI Studio blocks submission without `image_url`.
- Keep prompts and references safe for public URLs; avoid PII.
- If Fal updates duration/aspect enums, update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc accordingly.***
