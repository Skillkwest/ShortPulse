# Kie.ai Veo 3.1 Video API Reference

Use this document when interacting with the Kie.ai Veo 3.1 generation endpoints from ShortPulse (text → video, image → video, and callback handling).

## Authentication

- Every request must include `Authorization: Bearer YOUR_API_KEY`.
- Keep the key secret (rotate if compromised, don’t expose to browser clients).

## Generate a video (`POST /api/v1/veo/generate`)

### Request payload
```json
{
  "prompt": "A dog playing in a park",
  "imageUrls": ["http://example.com/image1.jpg", "http://example.com/image2.jpg"],
  "model": "veo3_fast",
  "aspect_ratio": "16:9",
  "generationType": "REFERENCE_2_VIDEO",
  "seeds": 12345,
  "watermark": "MyBrand",
  "enableTranslation": true,
  "callBackUrl": "https://your-callback-url.com/complete"
}
```

### Key parameters

- `prompt` (string, required): Detailed description of the desired video.
- `prompt` should cover action, shots, style, mood; include reference image cues for image-to-video iterations.
- `imageUrls` (array of 1-2 URLs): Optional; provide reference frame(s) (1 image for motion around content, 2 for first/last frames). URLs must be publicly accessible.
- `model` (`veo3` or `veo3_fast`): `veo3` for high quality, `veo3_fast` for cost-efficient generation.
- `generationType` (enum): `TEXT_2_VIDEO`, `FIRST_AND_LAST_FRAMES_2_VIDEO`, or `REFERENCE_2_VIDEO`. System infers mode automatically if unset.
- `aspect_ratio`: `16:9`, `9:16`, or `Auto`.
- `seeds` (10000-99999): Optional deterministic randomness.
- `callBackUrl`: Optional completion webhook (POST on success/failure).
- `enableTranslation` (boolean default `true`): Translate prompts to English automatically.
- `watermark`: Optional string added to the output video.
- `enableFallback`: Deprecated; remove from new requests.

### Response structure

- Status code `200` indicated success (`code: 200, msg: "success", data.taskId`).
- Additional codes: `401` (Unauthorized), `402` (Insufficient credits), `422` (Validation), `429` (Rate limit), `500`/`501` (generation errors), etc.
- Always check `code` and `msg`; implementations should handle non-200 responses gracefully.

## Callbacks

- If `callBackUrl` is provided, Kie.ai POSTS completion data to that endpoint.
- Callback payload contains `code`, `data` with `state`, `taskId`, `resultUrls`, timestamps, and `param` (the original request).
- Success example includes `state: "success"` and `resultJson` (contains downloadable URLs).
- Failure example includes `state: "fail"` plus `failCode`/`failMsg`.
- No callback is issued if `callBackUrl` is omitted; poll `Get Video Details` endpoint instead (not documented here).

## Best practices

1. Explicitly set `aspect_ratio` (avoid `Auto` when production output needs a specific framing).
2. Provide web-accessible `imageUrls` for image-to-video or reference generation; validate URLs before submission.
3. Capture `taskId` from the response and stash it for status polling or URL caching in Supabase.
4. Handle every non-200 `code` from the API (credit issues, validation errors, rate limits) to keep the UI resilient.
