# Kie.ai Sora 2 Pro Text-to-Video API Reference

Use this guide to integrate the Kie.ai Sora 2 Pro text-to-video model (Standard/720p and High/1080p). Pricing is tiered: Standard 10s = 150 credits ($1.50), Standard 15s = 270 credits ($2.70); High 10s = 330 credits ($3.30), High 15s = 630 credits ($6.30). Credits = `ceil(usd / 0.01)`.

## Authentication
- Include `Authorization: Bearer <KIE_API_KEY>` on every request.
- Keep keys server-side; do not expose to clients.

## Submit (Text → Video)
`POST https://api.kie.ai/v1/sora2pro/text-to-video` (path illustrative; keep server-side proxying consistent with other Kie integrations)

### Request body
```json
{
  "prompt": "a happy dog running in the garden",
  "character_id_list": [],
  "aspect_ratio": "16:9",
  "n_frames": "10",
  "size": "high",
  "remove_watermark": false
}
```

### Parameters
- `prompt` (string, required): Motion + content description; include style/mood cues.
- `character_id_list` (array, optional): Up to 5 IDs created in the Kie Sora character tool; omit when referencing public characters by `@Name` in prompt.
- `aspect_ratio` (enum): `16:9` (Landscape) or `9:16` (Portrait).
- `n_frames` (enum): `10` or `15` seconds clip length.
- `size` (enum): `standard` (720p) or `high` (1080p).
- `remove_watermark` (bool): Enable to request watermark removal on output.

### Response
- Success: task/job id plus initial state; poll or await callback for completion.
- Errors: HTTP 4xx/5xx with message; handle credit exhaustion and validation errors.

## Pricing (applied in-app)
- 720p (`size: standard`): 10s → 150 credits ($1.50), 15s → 270 credits ($2.70).
- 1080p (`size: high`): 10s → 330 credits ($3.30), 15s → 630 credits ($6.30) (default).
- Credits: `ceil(usd / 0.01)`. Examples:
  - 10s @1080p → $5.00 → 500 credits.
  - 10s @720p → $3.00 → 300 credits.
  - 15s @1080p → $7.50 → 750 credits.

## Defaults we apply
- Aspect: `16:9` (allowed: `16:9`, `9:16`).
- Duration: 10s unless overridden by the user.
- Resolution: `high` / 1080p (default); 720p uses `size: standard`.
- Audio: enabled by default (model returns synchronized audio).

## Status / callbacks
- Poll the provider status endpoint with the task id or supply a callback URL to receive completion payloads (state + result URLs). Mirror existing Kie status handling for parsing `resultJson`/video URLs.

## Notes
- Keep submission/polling server-side to avoid exposing keys.
- Validate `aspect_ratio` against allowed values before submission.
- If image-to-video variants are added later, extend this doc with their payload shape and adjust defaults accordingly.
