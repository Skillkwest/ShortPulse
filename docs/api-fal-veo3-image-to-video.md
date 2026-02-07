# Fal.ai Veo 3.1 Image-to-Video API Reference

Use this guide to submit and poll Veo 3.1 image-to-video jobs via the Fal queue (`fal-ai/veo3.1/image-to-video`). This keeps `FAL_KEY` server-side and matches AI Studio defaults and pricing.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/veo-image-to-video-submit` and `/api/fal/veo-image-to-video-status`.

## Submit (Image → Video)
`POST https://queue.fal.run/fal-ai/veo3.1/image-to-video`

Example (8s, 720p, audio on):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/veo3.1/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Slow push-in on a neon-lit ramen stand at night with steam and passing umbrellas.",
    "image_url": "https://example.com/reference.jpg",
    "aspect_ratio": "16:9",
    "duration": "8s",
    "resolution": "720p",
    "generate_audio": true
  }'
```

### Parameters
- `prompt` (string, required): How to animate the input image (action, style, camera, ambiance).
- `image_url` (string, required): Publicly reachable image in 16:9 or 9:16; larger than 720p recommended.
- `aspect_ratio` (enum): `16:9`, `9:16`, or `auto` (default `auto`).
- `duration` (enum): `4s`, `6s`, `8s` (default `8s`).
- `resolution` (enum): `720p` (default), `1080p`, or `4k`.
- `generate_audio` (boolean): Defaults to `true`.
- `negative_prompt`, `seed`, `auto_fix` (optional).

## Status
- Poll: `GET https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests/<request_id>`
- Proxies: `/api/fal/veo-image-to-video-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "video": {
    "url": "https://v3b.fal.media/files/..._i2v_output.mp4",
    "content_type": "video/mp4"
  }
}
```

## Defaults we apply (AI Studio)
- Aspect: `16:9` (allowed: `16:9`, `9:16`; other values fall back to `auto`).
- Duration: 8s; Resolution: `720p`; Audio: on.
- Proxy routes: `/api/fal/veo-image-to-video-submit` for submit; `/api/fal/veo-image-to-video-status` for status/result.

## Pricing
- Strategy: `veo-3-per-second`.
- Rates (USD): 720p/1080p — $0.20/s (audio off) or $0.40/s (audio on). 4K — $0.40/s (audio off) or $0.60/s (audio on).
- Credits: `ceil(usd / $0.01)`. AI Studio debits on submit using the requested duration/resolution/audio flags.

## Notes
- Safety filters apply to both input image and generated content.
- If Fal expands supported durations/resolutions, update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc to keep defaults aligned.***
