# OpenAI GPT Image 2

Purpose: document the ShortPulse phase-1 `gpt-image-2` integration that powers AI Studio Create -> Image through the authenticated internal OpenAI route.

## ShortPulse entrypoint

- Client submit route: `POST /api/openai/image-generate`
- Server transport: OpenAI Images API `POST /v1/images/generations`
- Route source of truth:
  - `frontend/pages/api/openai/image-generate.ts`
  - `frontend/lib/server/openaiImageGeneration.ts`
  - `frontend/lib/model-runtime/openAiImage2.ts`

## Auth

- ShortPulse route auth: route-level bearer auth via `requireApiUser`
- Provider auth: server-owned `OPENAI_API_KEY`

## Phase-1 scope

- Workflow: AI Studio Create -> Image only
- Model id: `gpt-image-2`
- Outputs per request: `n = 1`
- Supported sizes:
  - `1024x1024`
  - `1024x1536`
  - `1536x1024`
- Supported quality tiers:
  - `low`
  - `medium`
  - `high`
- Output format: `png`
- Moderation mode: `auto`
- Not in scope:
  - edits
  - Responses tool path
  - streaming
  - Character Mode

## Request contract

ShortPulse route body:

```json
{
  "prompt": "cinematic portrait",
  "size": "1024x1024",
  "quality": "medium",
  "project_id": "project-uuid-optional",
  "generation_replay": {},
  "character_context": {},
  "style_context": {},
  "shortpulse_context": {}
}
```

Validation rules:

- `prompt` is required and trimmed.
- `size` must be one of the supported phase-1 sizes.
- `quality` must be one of `low | medium | high`.
- `project_id` is optional; when present, successful direct-complete generations are eagerly associated to the owned project so restore/reopen can find them without waiting for later workspace-save backfill.
- Server enforces `n = 1`; callers do not supply arbitrary counts in phase 1.

## Aspect and quality mapping

AI Studio maps aspect selection onto the supported size matrix:

- `1:1` / `auto` -> `1024x1024`
- portrait ratios such as `4:5`, `3:4`, `2:3`, `9:16` -> `1024x1536`
- landscape ratios such as `5:4`, `4:3`, `3:2`, `16:9`, `21:9` -> `1536x1024`

AI Studio resolution selection for this model is treated as quality selection:

- `low`
- `medium`
- `high`

Unknown or legacy image-resolution values fall back to `medium`.

## Response contract

The provider returns base64 image data. ShortPulse:

1. decodes `b64_json`
2. uploads the generated PNG into private media storage
3. persists canonical generation/output/publication/projection rows
4. returns the normalized AI Studio output payload

Route response shape:

```json
{
  "output": {
    "provider": "openai-image",
    "mode": "image",
    "generationId": "gen_123",
    "mediaFileId": "media_123",
    "requestId": "req_123",
    "previewUrl": "https://...",
    "resultUrls": ["https://..."],
    "previewStoragePath": "user-id/generations/images/...",
    "fullStoragePath": "user-id/generations/images/...",
    "mimeType": "image/png",
    "modelId": "gpt-image-2",
    "savedMediaIds": ["media_123"]
  }
}
```

## Billing

Phase-1 billing is deterministic and request-shape based.

- Shared conversion policy still applies:
  - `1 credit = $0.01`
  - `+3%` markup
  - nearest-5 credit rounding
- Phase-1 raw provider price table used by the runtime:
  - `1024x1024`: `low $0.006`, `medium $0.053`, `high $0.211`
  - `1024x1536`: `low $0.005`, `medium $0.041`, `high $0.165`
  - `1536x1024`: `low $0.005`, `medium $0.041`, `high $0.165`
- Billing mode is direct debit, not Fal-style reservation capture.
- Route failures refund through the shared generation-billing helper.

## Notes

- This lane is intentionally separate from the Fal image submit/status registry.
- The route is synchronous from the client perspective: no provider polling is required once the request returns successfully.
- The AI Studio output lifecycle uses the direct-complete path for this model instead of the queue/poll path used by Fal image runs.
