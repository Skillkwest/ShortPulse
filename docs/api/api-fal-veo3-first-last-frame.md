# Fal.ai Veo 3.1 First/Last Frame API Reference

Use this guide to submit and poll Veo 3.1 first/last frame jobs via the Fal queue. ShortPulse proxies the requests through Next.js API routes to keep `FAL_KEY` server-side.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side; ShortPulse proxies through `/api/fal/veo-first-last-frame-submit` and `/api/fal/veo-status`.

## Submit (First/Last Frame → Video)
`POST https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video`

Example:
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "A smooth camera push-in while the subject smiles between frames.",
    "first_frame_url": "https://example.com/first.jpeg",
    "last_frame_url": "https://example.com/last.jpeg",
    "aspect_ratio": "16:9",
    "duration": "8s",
    "resolution": "720p",
    "generate_audio": true
  }'
```

### Parameters
- `prompt` (string, required): Text prompt describing how to animate between the frames.
- `first_frame_url` (string, required): URL or data URI for the first frame.
- `last_frame_url` (string, required): URL or data URI for the last frame.
- `aspect_ratio` (enum): `auto` (default), `16:9`, or `9:16`.
- `duration` (enum): `4s`, `6s`, `8s` (default `8s`).
- `resolution` (enum): `720p` (default), `1080p`, `4k`.
- `generate_audio` (boolean): Generate audio (default `true`).
- `negative_prompt` (string, optional): Negative prompt guidance.
- `seed` (integer, optional): Random seed.
- `auto_fix` (boolean, optional): Allow the service to rewrite prompts that fail validation.

## Status
- Poll: `GET https://queue.fal.run/fal-ai/veo3.1/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/veo3.1/requests/<request_id>`
- Proxies: `/api/fal/veo-status` handles status + result fetch when complete.

**Typical result**
```json
{
  "video": {
    "url": "https://storage.googleapis.com/falserverless/example_outputs/veo31-flf2v-output.mp4"
  }
}
```

## Defaults we apply (AI Studio)
- Aspect: `16:9` default (allowed: `16:9`, `9:16`).
- Duration: 8s.
- Resolution: 720p.
- Audio: `generate_audio: true`.
- Pricing: `veo-3-per-second` ($0.20/sec audio off, $0.40/sec audio on for 720p/1080p; 4K $0.40/$0.60).
- Proxy route: `/api/fal/veo-first-last-frame-submit`.

## Notes
- Input images must be ≤ 8MB each; prefer hosted URLs or Base64 data URIs.
- Safety filters apply to inputs and generated output.
- If Fal updates duration/aspect enums, update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc accordingly.
