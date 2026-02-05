# Fal.ai Kling 2.6 Motion Control (Pro) API Reference

Use this guide to submit and poll Kling 2.6 Motion Control jobs via the Fal queue. ShortPulse proxies the requests through Next.js API routes to keep `FAL_KEY` server-side.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/kling-v26-motion-control-submit` and `/api/fal/kling-status`.

## Submit (Motion Control)
`POST https://queue.fal.run/fal-ai/kling-video/v2.6/pro/motion-control`

Example:
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/kling-video/v2.6/pro/motion-control \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "An athlete performing a clean, powerful spin.",
    "image_url": "https://example.com/character.png",
    "video_url": "https://example.com/motion.mp4",
    "character_orientation": "video",
    "keep_original_sound": true
  }'
```

### Parameters
- `prompt` (string, optional): Scene description to guide the output.
- `image_url` (string, required): Reference image URL for the character.
- `video_url` (string, required): Reference video URL containing the motion to transfer.
- `character_orientation` (enum): `video` (matches reference video orientation, max 30s) or `image` (matches reference image orientation, max 10s).
- `keep_original_sound` (boolean): Keep the reference video’s audio track (default `true`).

## Status
- Poll: `GET https://queue.fal.run/fal-ai/kling-video/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/kling-video/requests/<request_id>`
- Proxies: `/api/fal/kling-status` handles status + result fetch when complete.

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
- Character orientation: `video` (best for complex motion, max 30s).
- Keep original sound: `true`.
- Pricing: `kling-2.6-motion-per-second` ($0.112/sec; defaults to 10s → 112 credits).
- Proxy route: `/api/fal/kling-v26-motion-control-submit`.

## Notes
- Both `image_url` and `video_url` must be public URLs or Base64 data URIs; local blob URLs will fail.
- Duration is inferred from the reference video; keep clips within 10s (`image`) or 30s (`video`) limits.
- If Fal updates duration/orientation rules, update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc accordingly.
