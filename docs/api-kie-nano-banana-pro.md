# Kie.ai Nano Banana Pro Image Generation Reference

Summary of the `nano-banana-pro` task creation workflow on Kie.ai—policy, payload, and callback expectations for ShortPulse teams.

## Authentication

- Send `Authorization: Bearer YOUR_API_KEY` header with every request.
- Keep the API key secure and rotate immediately if compromised; never embed in client-side code.

## Create a task (`POST /api/v1/jobs/createTask`)

### Payload
```json
{
  "model": "nano-banana-pro",
  "callBackUrl": "https://your-domain.com/api/callback", // optional
  "input": {
    "prompt": "...",
    "image_input": ["https://..."], // optional reference images
    "aspect_ratio": "1:1",
    "resolution": "1K",
    "output_format": "png"
  }
}
```

- `model`: Must specify `nano-banana-pro`.
- `callBackUrl`: Optional completion webhook; system posts status on success/failure.
- `input.prompt` (required): Text description (up to 20k characters) for generation.
- `input.image_input`: Optional array (up to 8 URLs) for control or reference.
- `input.aspect_ratio`: Choose from `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`, or `auto`.
- `input.resolution`: `1K`, `2K`, or `4K`.
- `input.output_format`: `png` or `jpg`.

### Response

- `code`: `200` for success; other values indicate failure.
- `message`: Summary or error detail.
- `data.taskId`: Keep this ID to poll status or map callbacks.

## Callbacks

- When `callBackUrl` is supplied, Kie.ai POSTs a JSON payload similar to the query result.
- Success payload contains `state: "success"`, `resultJson` with `resultUrls`, timestamps, and `taskId`.
- Failure payload includes `state: "fail"` plus `failCode`, `failMsg`, and `resultJson: null`.
- `param` includes the full create request (model + input) for auditing.
- No callback is sent if `callBackUrl` is omitted.

## Best practices

1. Cache `resultJson.resultUrls` once videos/images are finished; avoid costing repeated credits.
2. Validate reference URL accessibility and size (≤ 30 MB) before submitting.
3. Capture `taskId` for troubleshooting and tie it to Supabase records; use callbacks or the task query API to detect completion.
