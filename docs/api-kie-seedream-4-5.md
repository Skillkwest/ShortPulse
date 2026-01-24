# Kie.ai Seedream 4.5 Text-to-Image API Reference

Track the `seedream/4.5-text-to-image` task workflow for ShortPulse integrations: authentication, payload shape, response format, and callbacks.

## Authentication
- Include `Authorization: Bearer YOUR_API_KEY` on every request.
- Keep the key private; rotate immediately if leaked.

## Create task (`POST /api/v1/jobs/createTask`)

### Payload
```json
{
  "model": "seedream/4.5-text-to-image",
  "callBackUrl": "https://your-domain.com/api/callback", // optional
  "input": {
    "prompt": "...",
    "aspect_ratio": "1:1",
    "quality": "basic"
  }
}
```
- `model`: must be `seedream/4.5-text-to-image`.
- `callBackUrl`: Optional webhook for completion/failure notifications.
- `input.prompt` (required): Descriptive text (<=3000 chars).
- `input.aspect_ratio` (required): Choose one of `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `2:3`, `3:2`, or `21:9`.
- `input.quality` (required): `basic` (2K) or `high` (4K).

### Response
- `code`: `200` indicates success; other codes signal issues (validation, limits, server errors).
- `message`: Human-readable result or error.
- `data.taskId`: Persist this ID for polling status or matching callbacks.

## Query task status

- `POST https://api.kie.ai/api/v1/jobs/queryTask` with `{"taskId":"<taskId>"}`
- Returns the same structure as the callback payload (`state`, `resultJson`, `param`, timestamps, `failCode`, `failMsg`, etc.).
- Use the endpoint when you need to pull results or detect completion without relying solely on callbacks.

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/queryTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"taskId":"task_12345678"}'
```

ShortPulse should proxy this request via a backend helper (such as `frontend/pages/api/kei/task-status.ts`) to keep `KEI_API_KEY` off the client.

## Callbacks
- With `callBackUrl`, the API posts the same shape as the task query response.
- Success payload includes `state: "success"`, `resultJson.resultUrls` with generated images, timestamps, and `taskId`.
- Failure payload includes `state: "fail"`, `failCode`, `failMsg`, and `resultJson: null`.
- `param` contains the full request for auditing.
- No callback is sent if `callBackUrl` is omitted.

## Best practices
1. Cache `resultJson.resultUrls` once outputs are delivered; avoid re-running tasks that already succeeded.
2. Validate prompt length (<= 3000 chars) and aspect ratio selection before submitting.
3. Record `taskId` alongside Supabase/shortflow metadata for easier troubleshooting.
4. If you skip `callBackUrl`, poll `POST /api/v1/jobs/queryTask` periodically so you can mark completion and capture `resultJson`.
