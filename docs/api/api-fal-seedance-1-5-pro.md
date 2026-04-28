# Fal.ai Seedance 1.5 Pro Text-to-Video API Reference

Provider reference for Seedance 1.5 Pro text-to-video jobs via the Fal queue (`fal-ai/bytedance/seedance/v1.5/pro/text-to-video`). ShortPulse no longer exposes a Fal proxy route for this model; active ShortPulse Seedance generation uses the Kie Seedance lanes.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side. ShortPulse keeps this page as provider-reference material only.

## Submit (Text → Video)
`POST https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video`

Example (10s, 1080p-equivalent tier, audio on):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Cinematic dolly through a misty forest at sunrise, soft shafts of light, subtle camera roll, natural ambient audio.",
    "duration": "10",
    "aspect_ratio": "16:9",
    "negative_prompt": "blur, distort, low quality",
    "cfg_scale": 0.5,
    "enable_safety_checker": false
  }'
```

### Parameters
- `prompt` (string, required): Scene description.
- `duration` (enum): Commonly `10` (defaults in AI Studio); queue may accept other lengths.
- `aspect_ratio` (enum): `16:9` (default), `9:16`, `1:1`, `4:3`, `3:4`, `21:9`.
- `negative_prompt` (string): Optional; we default to `"blur, distort, and low quality"`.
- `cfg_scale` (float): Optional guidance strength (default `0.5`).
- `enable_safety_checker` (boolean): Default true on Fal; ShortPulse sends `false` for minimum filtering.
- Additional audio/resolution controls are handled by the provider; AI Studio assumes audio on and 1080p-equivalent for pricing.

## Status
- Provider queue URLs may resolve through multiple base paths (`/fal-ai/bytedance/requests`, `/fal-ai/bytedance/seedance/requests`, or model-specific paths).
- ShortPulse active routes: use `POST /api/fal/kie-seedance-submit`, `POST /api/fal/kie-seedance-status`, or the Kie Seedance 2 routes for active Seedance generation.

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
- Aspect: `16:9` default (allowed: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9`).
- Duration: 10s; audio on; resolution tier equivalent to 1080p (used for pricing).
- Safety: `enable_safety_checker: false` (minimum filtering).
- Pricing: `seedance-1.5-per-second` (token-based; audio on).
- ShortPulse route status: retired from the active Fal route surface.

## Notes
- Keep prompts safe for public URLs; avoid PII/sensitive content.
- If Fal updates duration/aspect enums, update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc.***
