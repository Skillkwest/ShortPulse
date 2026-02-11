# Fal.ai Seedance 1.5 Pro Image-to-Video API Reference

Use this guide to submit and poll Seedance 1.5 Pro image-to-video jobs via the Fal queue (`fal-ai/bytedance/seedance/v1.5/pro/image-to-video`). This keeps `FAL_KEY` server-side and matches AI Studio defaults.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/seedance-i2v-submit` and `/api/fal/seedance-i2v-status`.

## Submit (Image to Video)
`POST https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video`

Example (5s, 720p, audio on, with start and end frames):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "A man is crying and he says \"I should not have done it. I regret everything\"",
    "image_url": "https://v3b.fal.media/files/example/start_image.png",
    "end_image_url": "https://v3b.fal.media/files/example/end_image.png",
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "duration": "5",
    "generate_audio": true,
    "enable_safety_checker": true
  }'
```

### Parameters
- `prompt` (string, required): Scene description.
- `image_url` (string, required): URL of the starting image.
- `end_image_url` (string, optional): URL of the ending image.
- `aspect_ratio` (enum): `16:9` (default), `9:16`, `1:1`, `4:3`, `3:4`, `21:9`.
- `resolution` (enum): `480p`, `720p` (default), `1080p`.
- `duration` (enum): `4`, `5` (default), `6`, `7`, `8`, `9`, `10`, `11`, `12` seconds.
- `camera_fixed` (boolean, optional): Whether to fix the camera position.
- `seed` (integer, optional): Random seed for reproducibility (-1 for random).
- `enable_safety_checker` (boolean): Default true.
- `generate_audio` (boolean): Default true.

## Status
- Poll: `GET https://queue.fal.run/fal-ai/bytedance/seedance/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/bytedance/seedance/requests/<request_id>`
- Proxies: `/api/fal/seedance-i2v-status` proxies status + result when complete.

**Typical result**
```json
{
  "video": {
    "url": "https://v3b.fal.media/files/..._output.mp4",
    "content_type": "video/mp4"
  },
  "seed": 42
}
```

## Defaults we apply (AI Studio)
- Aspect: `16:9` default (allowed: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9`).
- Duration: 5s; audio on; resolution: 720p.
- Pricing: `seedance-1.5-per-second` (token-based; audio on).
- Proxy routes: `/api/fal/seedance-i2v-submit` and `/api/fal/seedance-i2v-status`.

## Pricing
- 720p 5-second video with audio: ~$0.26
- Token calculation: `tokens = (height × width × FPS × duration) / 1024`
- 1 million video tokens with audio: $2.4
- Without audio: $1.2 per million tokens

## Notes
- Keep prompts safe for public URLs; avoid PII/sensitive content.
- Supports start & end frame for keyframe-driven video generation.
- If Fal updates duration/aspect enums, update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc.
