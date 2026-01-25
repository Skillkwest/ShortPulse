# Kie.ai Seedance 1.5 Pro Video API Reference

Use this guide for ByteDance Seedance 1.5 Pro via Fal.ai queue (text or text+image to video with optional audio). Pricing here reflects our in-app override: token-based with 1080p/10s/audio defaults.

## Authentication
- Include `Authorization: Bearer <KIE_API_KEY>` in every request.
- Keep keys server-side; do not expose to the client.

## Submit (Create Task)
`POST https://api.kie.ai/api/v1/jobs/createTask`

### Request body
```json
{
  "model": "bytedance/seedance-1.5-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "a cinematic shot of waves crashing against cliffs at sunset",
    "input_urls": [],
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "duration": "8",
    "fixed_lens": false,
    "generate_audio": true
  }
}
```

### Key parameters
- `prompt` (string, required): 3–2500 chars describing motion/scene; include dialogue/language for multilingual audio.
- `input_urls` (0–2, optional): Public image URLs (jpg/png/webp) up to 10MB each for reference.
- `aspect_ratio` (enum): `1:1`, `21:9`, `4:3`, `3:4`, `16:9`, `9:16`. Default we use: `16:9`.
- `resolution` (enum): `480p`, `720p`, or `1080p` (default/highest we use).
- `duration` (enum): `4–12` seconds (Fal queue supports 4–12). Default we use: `10`.
- `fixed_lens` (bool): Keep camera static if true.
- `generate_audio` (bool): Enable native audio (default true in-app).

### Response
- Success: `{ code: 200, data: { taskId } }`. Poll status or use callback for results.
- Errors: Non-200 codes; handle credit errors/validation gracefully.

## Pricing (in-app override)
- Token formula: `tokens = (width * height * FPS * duration) / 1024`, with FPS assumed 24 and resolution from `resolution`.
- Rates: audio `= $2.4` per million tokens; no-audio `= $1.2` per million tokens.
- Example (default 1080p/10s with audio): 1920 × 1080 × 24 × 10 → ~486,000 tokens → ~$1.17 → 117 credits (ceil).
- Example (720p/5s with audio, reference): ~108k tokens → ~$0.26 → 26 credits.
- Credits = `ceil(usd / 0.01)`.

## Defaults we apply
- Aspect: `16:9` (allowed: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9`).
- Duration: `10` seconds.
- Resolution: `1080p` (highest offered); fall back to `720p`, then `480p`.
- Audio: on by default.

## Status / callbacks
- Poll with the task id or supply `callBackUrl` to receive POST payloads (state + `resultJson` URLs).
- Callback shape mirrors the query response; parse `resultJson` for video URLs.

## Notes
- Keep submission/polling server-side to protect keys.
- Clamp duration to supported buckets (4/8/12) and resolution to `480p`/`720p` before submission.
- If audio is disabled, we use the lower rate; otherwise default to audio-on.***
