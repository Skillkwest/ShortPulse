# Kie.ai Nano Banana Image API Reference

Reference for integrating Kie.ai’s Nano Banana model (`google/nano-banana`) via the createTask endpoint.

## Authentication
- Set your Kie API key and send `Authorization: Bearer YOUR_API_KEY`.
- Keep the key server-side; do not expose in client code.

## Create Task
```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KIE_API_KEY" \
  -d '{
    "model": "google/nano-banana",
    "input": {
      "prompt": "A surreal painting of a giant banana floating in space...",
      "output_format": "png",
      "image_size": "1:1"
    }
  }'
```

### Input
- `model` (string): `google/nano-banana`
- `input.prompt` (string, required)
- `input.output_format` (enum): `png` | `jpeg` (default `png`)
- `input.image_size` (enum): `1:1`, `9:16`, `16:9`, `3:4`, `4:3`, `3:2`, `2:3`, `5:4`, `4:5`, `21:9`, or `auto` (we clamp to allowed set)
- `callBackUrl` (optional): receive POST callback on completion.

### Response
- `data.taskId`: task identifier for status polling.

## Status & Callbacks
- Poll status via existing Kie status endpoint (returns `state`, `resultUrls`, etc.).
- If `callBackUrl` is provided, Kie posts completion payloads matching the status response shape.

## Pricing (ShortPulse)
- Provider rate: **$0.039 per image** (~4 credits in Kie UI).
- Credits value: $0.01 → `credits = ceil(0.039 / 0.01) = 4`.
- We debit 4 credits per request; aspect choice does not change cost.

## Defaults we use in AI Studio
- output_format: `png`
- image_size: clamped to allowed set, default `1:1` if invalid
- images per request: 1

## Notes
- Keep the API key server-side; proxy through our Next API routes.
- Aspect normalization: if a user selects an aspect outside the allowed list, we fall back to `auto`/`1:1`.
