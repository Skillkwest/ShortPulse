# Fal.ai Sora 2 Pro Text-to-Video API Reference

Use this guide to submit and poll Sora 2 Pro text-to-video jobs via the Fal queue (`fal-ai/sora-2/text-to-video/pro`). This keeps `FAL_KEY` server-side and mirrors the pricing defaults already used in AI Studio.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep `FAL_KEY` out of client code; use the Next.js API proxy (`/api/fal/sora-submit` / `/api/fal/sora-status`).

## Submit (Text → Video)
`POST https://queue.fal.run/fal-ai/sora-2/text-to-video/pro`

Example (10s pricing tier, 8s requested to match the Fal duration enum):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/sora-2/text-to-video/pro \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue.",
    "resolution": "1080p",
    "aspect_ratio": "16:9",
    "duration": 8,
    "delete_video": true
  }'
```

### Parameters
- `prompt` (string, required): Scene description.
- `resolution` (enum): `1080p` (default) or `720p`.
- `aspect_ratio` (enum): `16:9` (default) or `9:16`.
- `duration` (enum): `4`, `8`, or `12` seconds. AI Studio requests `8` seconds by default while pricing at the 10s tier for consistency.
- `delete_video` (boolean): Whether to delete after generation (defaults true per Fal docs).

## Status
- Poll: `GET https://queue.fal.run/fal-ai/sora-2/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/sora-2/requests/<request_id>`
- Proxies: `/api/fal/sora-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "video": {
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/sora-2-pro-t2v-output.mp4"
  },
  "video_id": "video_123"
}
```

## Defaults we apply (AI Studio)
- Aspect: `16:9` (allowed: `16:9`, `9:16`).
- Duration: 8s requested (Fal enum 4/8/12); priced using the 10s high-tier in `sora-2-pro-per-second`.
- Resolution: `1080p` default; audio on by default (model returns audio).
- Proxy routes: `/api/fal/sora-submit` for submit; `/api/fal/sora-status` for status/result.

## Notes
- Keep prompts safe for public URLs and avoid leaking PII.
- The queue returns video URLs directly; AI Studio polls until `status` is success/completed, then reads `video.url`.
- If Fal adds more enums (duration/resolution), update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc.***
