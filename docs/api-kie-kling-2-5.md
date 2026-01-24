# Kie.ai Kling 2.5 Turbo Text-to-Video API Reference

This reference covers the `kling/v2-5-turbo-text-to-video-pro` task creation workflow on Kie.ai. Use it when orchestrating prompt-based video jobs (with optional callbacks) so ShortPulse teams don’t need to open the portal every time.

## Authentication

- All requests require an `Authorization: Bearer YOUR_API_KEY` header.
- Store the API key securely (never embed it in client-side code). Rotate it immediately if compromised.

## Create a video task (`POST /api/v1/jobs/createTask`)

### Required body shape
```json
{
  "model": "kling/v2-5-turbo-text-to-video-pro",
  "callBackUrl": "https://your-domain.com/api/callback", // optional
  "input": {
    "prompt": "...",
    "duration": "5",
    "aspect_ratio": "16:9",
    "negative_prompt": "blur, distort, and low quality",
    "cfg_scale": 0.5
  }
}
```

- `model` *(required)*: Must be `"kling/v2-5-turbo-text-to-video-pro"` (text-to-video) or other supported variants.
- `callBackUrl` *(optional)*: Receive POST notifications on completion/failure.
- `input.prompt` *(required)*: Prompt up to 2500 characters describing the desired scene.
- `input.duration` (5 or 10 seconds).
- `input.aspect_ratio` (`"16:9"`, `"9:16"`, `"1:1"`).
- `input.negative_prompt`: Things to avoid (same max length as prompt).
- `input.cfg_scale`: Guidance strength between 0 and 1 (step 0.1).

### Request example (curl)
```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{...}'
```

### Response fields
- `code`: `200` (success) or other failure codes.
- `message`: Status string or error detail.
- `data.taskId`: Unique ID for polling task status.

## Callbacks

When `callBackUrl` is provided, Kie.ai POSTs the same structure as the task query response:

**Success callback**
```json
{
  "code": 200,
  "data": {
    "state": "success",
    "taskId": "...",
    "resultJson": "{\"resultUrls\":[\"https://example.com/generated.mp4\"]}",
    ...
  },
  "msg": "Playground task completed successfully."
}
```

**Failure callback**
```json
{
  "code": 501,
  "data": {
    "state": "fail",
    "failCode": "500",
    "failMsg": "Internal server error",
    "taskId": "...",
    "resultJson": null,
    ...
  },
  "msg": "Playground task failed."
}
```

- `param` contains the full create request (not just `input`).
- No callback is sent when `callBackUrl` is omitted.

## Best practices

1. Store the returned `taskId` and poll Kie.ai’s task query endpoint (not documented here) or rely on callbacks for completion.
2. Metadata tracking should happen on ShortPulse’s backend layer, not via user-supplied prompts.
3. Cache generated video URLs (from `resultJson`) in Supabase to reduce repeated API calls and associated credits.
