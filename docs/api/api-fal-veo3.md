# Fal.ai Veo 3.1 Text-to-Video API Reference

Provider reference for Veo 3.1 text-to-video jobs via the Fal queue (`fal-ai/veo3.1`). ShortPulse no longer exposes a Fal proxy route for this model; active ShortPulse Veo generation uses the Kie Veo 3.1 Fast lane.

## Authentication
- Set `FAL_KEY` in the runtime and send `Authorization: Key $FAL_KEY` on every request.
- Keep keys server-side. ShortPulse keeps this page as provider-reference material only.

## Submit (Text → Video)
`POST https://queue.fal.run/fal-ai/veo3.1`

Example (8s, 1080p, audio on):
```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/veo3.1 \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Two person street interview in New York City. Host and guest trade lines about Veo 3.1 coming to Fal.",
    "aspect_ratio": "16:9",
    "duration": "8s",
    "resolution": "1080p",
    "generate_audio": true,
    "auto_fix": true
  }'
```

### Parameters
- `prompt` (string, required): Scene description; include action, style, camera, and dialogue where relevant.
- `aspect_ratio` (enum): `16:9` (default) or `9:16`.
- `duration` (enum): `4s`, `6s`, or `8s` (default is `8s`).
- `resolution` (enum): `720p`, `1080p` (default), or `4k`.
- `generate_audio` (boolean): Defaults to `true` (ShortPulse leaves this on).
- `negative_prompt` (string): Optional.
- `seed` (integer): Optional reproducibility seed.
- `auto_fix` (boolean): Defaults to `true` to allow Fal to rewrite invalid prompts.

## Status
- Poll: `GET https://queue.fal.run/fal-ai/veo3.1/requests/<request_id>/status`
- Result: `GET https://queue.fal.run/fal-ai/veo3.1/requests/<request_id>`
- ShortPulse active route: use `POST /api/fal/kie-veo-submit` and `POST /api/fal/kie-veo-status` for active Veo generation.

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
- Aspect: `16:9` (allowed: `16:9`, `9:16`, `1:1` fallback handled to default).
- Duration: 8s requested; pricing uses the existing `veo-3-per-second` strategy (unchanged).
- Resolution: `1080p`; audio on; `auto_fix: true`.
- ShortPulse route status: retired from the active Fal route surface.

## Notes
- Keep prompts safe for public URLs; avoid PII.
- The queue returns `video.url`; AI Studio polls until `status` is success/completed.
- If Fal adds new enums (durations/resolutions), update `modelRegistry.ts`, `useAiStudioState.ts`, and this doc accordingly.***
