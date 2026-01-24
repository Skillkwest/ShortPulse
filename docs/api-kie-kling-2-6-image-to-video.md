# Kie.ai Kling 2.6 Image-to-Video API Reference

This doc describes how to create Kling 2.6 image-to-video tasks (`kling-2.6/image-to-video`) on Kie.ai, including authentication, required payload fields, and callback expectations for ShortPulse integration reference.

## Authentication

- Every request must contain `Authorization: Bearer YOUR_API_KEY`.
- Store the key securely (never leak it to client-side code).

## Create task (`POST /api/v1/jobs/createTask`)

### Request body
```json
{
  "model": "kling-2.6/image-to-video",
  "callBackUrl": "https://example.com/callback", // optional
  "input": {
    "prompt": "...",
    "image_urls": ["https://..."],
    "sound": false,
    "duration": "5"
  }
}
```

- `model`: Must be `"kling-2.6/image-to-video"` (or other Kling 2.6 variants for text-to-video).
- `callBackUrl`: Optional endpoint to receive completion/failure notifications.
- `input.prompt` (required): Up to 2500-character textual prompt describing the desired motion/audio.
- `input.image_urls` (required): Public URL array pointing to the reference image (max 10 MB, JPEG/PNG/WEBP).
- `input.sound` (required boolean): `true` to include audio track; `false` for silent HD renders.
- `input.duration` (required): `"5"` or `"10"` seconds.

### Example request
```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{...}'
```

### Response
- `code`: `200` indicates success.
- `message`: Status string or error detail.
- `data.taskId`: Persist this ID to poll task status or correlate callbacks.

## Callbacks

- When `callBackUrl` is supplied, Kie.ai POSTs a payload identical to the query response.
- The `param` field contains the full original create request.
- No callback is sent if `callBackUrl` is omitted.

**Success callback** includes `state: "success"`, `resultJson` (e.g., `{"resultUrls":["https://example.com/generated-image.jpg"]}`), timestamps, and `taskId`.

**Failure callback** includes `state: "fail"`, `failCode`, `failMsg`, and `resultJson: null`.

## Important notes

1. Poll the Kie.ai task status endpoint (or rely on callbacks) to know when the video is ready.
2. Cache generated URLs in Supabase or another storage layer to avoid re-consuming credits.
3. Validate `image_urls` before sending: they must be publicly accessible and under 10 MB.
