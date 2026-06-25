# GPT Image 2

Purpose: document the ShortPulse `gpt-image-2` integration that powers AI Studio Create -> Image and standard Edit through authenticated internal OpenAI routes.

## ShortPulse entrypoints

- Client submit routes:
  - `POST /api/openai/image-generate`
  - `POST /api/openai/image-edit`
- Server transport:
  - OpenAI Images API `POST /v1/images/generations`
  - OpenAI Images API `POST /v1/images/edits`
- Route source of truth:
  - `frontend/pages/api/openai/image-generate.ts`
  - `frontend/pages/api/openai/image-edit.ts`
  - `frontend/lib/server/openaiImageGeneration.ts`
  - `frontend/lib/model-runtime/openAiImage2.ts`

## Auth

- ShortPulse route auth: route-level bearer auth via `requireApiUser`
- Provider auth: server-owned `OPENAI_API_KEY`

## Current scope

- Workflows:
  - AI Studio Create -> Image
  - AI Studio standard Edit
- Character Mode note:
  - Direct OpenAI `gpt-image-2` is not a Create Character Mode model. Character Mode GPT Image 2 state resolves through the queued Kie `kie-ai/gpt-image-2-image-to-image` lane.
- Model id: `gpt-image-2`
- Outputs per request: `n = 1`
- Supported sizes:
  - `1008x1792`
  - `1024x1024`
  - `1024x1280`
  - `1024x1536`
  - `1152x2048`
  - `1280x1024`
  - `1536x1024`
  - `1664x2080`
  - `1792x1008`
  - `2048x1152`
  - `2048x2048`
  - `2080x1664`
  - `2160x3840`
  - `2560x3200`
  - `2880x2880`
  - `3200x2560`
  - `3840x2160`
- Supported quality tiers:
  - `low`
  - `medium`
  - `high`
- Edit input fidelity:
  - ShortPulse bills and records GPT Image 2 edit inputs as high fidelity.
  - Do not forward `input_fidelity` to OpenAI for `gpt-image-2`; the provider processes image inputs at high fidelity automatically and rejects the parameter.
- Output format: `png`
- Moderation mode: `low` (ShortPulse default; least restrictive documented OpenAI Images setting supported by this lane)
- Standard edit inputs:
  - up to 8 reference images through the current AI Studio client path
  - optional mask on the route contract for future/power-user parity
  - optional internal media-ref extensions for app-owned inputs so the route can resolve direct provider-safe file inputs at dispatch time instead of trusting stale durable signed URLs
- Still not in scope:
  - streaming
  - Responses tool path

## Request contracts

Create route body:

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

Edit route body:

```json
{
  "prompt": "restyle this portrait",
  "size": "1024x1024",
  "quality": "medium",
  "images": [
    { "image_url": "https://example.com/base.png" },
    { "image_url": "https://example.com/reference.png" }
  ],
  "mask": { "image_url": "https://example.com/mask.png" },
  "shortpulse_internal_media_refs": [
    {
      "version": 1,
      "kind": "storage_object",
      "bucket": "media_library",
      "storagePath": "user-1/library/base.png"
    }
  ],
  "shortpulse_internal_edit_media_refs": {
    "base_image": {
      "version": 1,
      "kind": "storage_object",
      "bucket": "media_library",
      "storagePath": "user-1/library/base.png"
    },
    "mask_image": {
      "version": 1,
      "kind": "storage_object",
      "bucket": "media_library",
      "storagePath": "user-1/library/mask.png"
    },
    "reference_image": {
      "version": 1,
      "kind": "storage_object",
      "bucket": "media_library",
      "storagePath": "user-1/library/ref.png"
    }
  },
  "project_id": "project-uuid-optional",
  "generation_replay": {},
  "character_context": {},
  "style_context": {},
  "shortpulse_context": {}
}
```

Validation rules:

- `prompt` is required and trimmed.
- `size` must be one of the supported exact output sizes.
- `quality` must be one of `low | medium | high`.
- `images` is required for `/api/openai/image-edit` and must contain `1..8` image URLs.
- `input_fidelity` is optional compatibility input for `/api/openai/image-edit`; when omitted or supplied as a legacy `low | high` value, ShortPulse bills and records `high`. The OpenAI provider request must omit `input_fidelity` for `gpt-image-2`.
- `mask` is optional for `/api/openai/image-edit`.
- `shortpulse_internal_media_refs` is an optional ShortPulse extension carrying canonical app-owned media descriptors for general edit references. When present, the route resolves direct provider-safe file inputs immediately before provider dispatch and must prefer those over stale app-owned signed URLs supplied by the client.
- `shortpulse_internal_edit_media_refs` is an optional ShortPulse extension carrying canonical app-owned descriptors for edit-specific `base_image`, `mask_image`, and `reference_image` inputs.
- `project_id` is optional; when present, successful direct-complete generations are eagerly associated to the owned project so restore/reopen can find them without waiting for later workspace-save backfill.
- Server enforces `n = 1`; callers do not supply arbitrary counts.

## Aspect and quality mapping

AI Studio maps aspect and resolution selection onto exact output sizes:

| Aspect         | 1K          | 2K          | 4K          |
| -------------- | ----------- | ----------- | ----------- |
| `9:16`         | `1008x1792` | `1152x2048` | `2160x3840` |
| `4:5`          | `1024x1280` | `1664x2080` | `2560x3200` |
| `1:1` / `auto` | `1024x1024` | `2048x2048` | `2880x2880` |
| `5:4`          | `1280x1024` | `2080x1664` | `3200x2560` |
| `16:9`         | `1792x1008` | `2048x1152` | `3840x2160` |

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

Billing is deterministic and request-shape based.

- Shared conversion policy still applies:
  - `1 credit = $0.01`
  - `+3%` markup
  - credit ceiling plus any row-specific round-nearest override
- Raw provider output price table used by the runtime:
  - `1024x1024`: `low $0.006`, `medium $0.053`, `high $0.211`
  - `1024x1536`: `low $0.005`, `medium $0.041`, `high $0.165`
  - `1536x1024`: `low $0.005`, `medium $0.041`, `high $0.165`
- Standard edit pricing adds deterministic input-image surcharges based on:
  - output size proxy
  - input image count
  - `input_fidelity`
  - optional mask presence
- Billing mode is direct debit, not Fal-style reservation capture.
- Route failures refund through the shared generation-billing helper.

## Notes

- This lane is intentionally separate from the Fal image submit/status registry.
- Both routes are synchronous from the client perspective: no provider polling is required once the request returns successfully.
- The direct OpenAI routes are configured as long-running Vercel Functions with a 300 second ceiling. Provider generation/edit calls use app-owned 240 second request timeouts, internal file uploads use 60 second timeouts, and best-effort provider file cleanup uses a 15 second timeout so route failures stay controlled and refundable before the platform terminates the request.
- The AI Studio output lifecycle uses the direct-complete path for this model instead of the queue/poll path used by Fal image runs.
