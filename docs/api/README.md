# API Reference Index

Purpose: canonical integration references for first-party API routes and external model/provider APIs used by ShortPulse.

## Scope
- First-party Next.js API route map (`api-internal-routes`).
- OpenAI platform references (`api-responses`, `api-chat-completions`).
- OpenAI image-model references used by AI Studio create-image flows.
- Fal and Kie model references used by AI Studio generation routes.
- Request payload defaults, status polling behavior, output shapes, and pricing notes.

## File conventions
- Naming: `api-<provider>-<model>.md`.
- First-party exception: use `api-internal-*.md` for route-contract docs maintained by the app team.
- Every API doc should include: auth, submit endpoint, status/result flow, key params, output schema, and ShortPulse defaults.
- Keep implementation details aligned with `frontend/pages/api/*` proxies and the canonical model catalog in `frontend/lib/model-runtime/modelCatalog.ts`.

## Current docs
- `docs/api/api-internal-routes.md`
- `docs/api/api-responses.md`
- `docs/api/api-chat-completions.md`
- `docs/api/api-openai-gpt-image-2.md`
- `docs/api/api-elevenlabs-audio-models.md`
- `docs/api/api-fal-kling-3-pro-image-to-video.md`
- `docs/api/api-fal-kling-3-pro-text-to-video.md`
- `docs/api/api-fal-veo3.md`
- `docs/api/api-fal-veo3-image-to-video.md`
- `docs/api/api-fal-veo3-first-last-frame.md`
- `docs/api/api-fal-seedance-1-5-pro.md` (legacy/disabled)
- `docs/api/api-fal-seedance-1-5-pro-i2v.md` (legacy/disabled)
- `docs/api/api-kie-veo-3-1-fast-image-to-video.md`
- `docs/api/api-kie-kling-3-0.md`
- `docs/api/api-kie-seedance-1-5-pro.md` (deprecated compatibility lane)
- `docs/api/api-kie-seedance-2.md`
- `docs/api/api-kie-seedance-2-fast.md`
- `docs/api/api-fal-flux-2-klein-9b.md`
- `docs/api/api-fal-flux-pro-fill.md`
- `docs/api/api-fal-flux-kontext-inpaint.md`
- `docs/api/api-fal-bria-background-remove.md`
- `docs/api/api-fal-nano-banana-2.md`
- `docs/api/api-fal-nano-banana-2-edit.md`
- `docs/api/api-fal-nano-banana-pro.md`
- `docs/api/api-fal-nano-banana-pro-edit.md`
- `docs/api/api-fal-seedream-4-5.md`
- `docs/api/api-fal-seedream-4-5-edit.md`
- `docs/api/api-fal-seedream-5-lite.md`
- `docs/api/api-fal-seedream-5-lite-edit.md`

## Maintenance checklist
1. Add/update the model in code (`frontend/lib/model-runtime/modelCatalog.ts`, pricing, submit/status handlers).
2. Add/update the API doc in this folder.
3. Link it in `docs/README.md`.
4. Re-run the provider contract verification workflow in `docs/sops/sop_model_api_contract_reverification.md` when the external contract changed or the catalog verification window is stale.
5. Run `npm -C frontend run docs:check`.
