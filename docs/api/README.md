# API Reference Index

Purpose: canonical integration references for first-party API routes and external model/provider APIs used by ShortPulse.

## Scope
- First-party Next.js API route map (`api-internal-routes`).
- OpenAI platform references (`api-responses`, `api-chat-completions`).
- Fal model references used by AI Studio generation routes.
- Request payload defaults, status polling behavior, output shapes, and pricing notes.

## File conventions
- Naming: `api-<provider>-<model>.md`.
- First-party exception: use `api-internal-*.md` for route-contract docs maintained by the app team.
- Every API doc should include: auth, submit endpoint, status/result flow, key params, output schema, and ShortPulse defaults.
- Keep implementation details aligned with `frontend/pages/api/*` proxies and `frontend/features/ai-studio/logic/*` pricing/model registry.

## Current docs
- `docs/api/api-internal-routes.md`
- `docs/api/api-responses.md`
- `docs/api/api-chat-completions.md`
- `docs/api/api-fal-kling-3-pro-image-to-video.md`
- `docs/api/api-fal-kling-3-pro-text-to-video.md`
- `docs/api/api-fal-veo3.md`
- `docs/api/api-fal-veo3-image-to-video.md`
- `docs/api/api-fal-veo3-first-last-frame.md`
- `docs/api/api-fal-sora-2-pro.md`
- `docs/api/api-fal-seedance-1-5-pro.md`
- `docs/api/api-fal-seedance-1-5-pro-i2v.md`
- `docs/api/api-fal-flux-2.md`
- `docs/api/api-fal-flux-2-edit.md`
- `docs/api/api-fal-flux-2-pro.md`
- `docs/api/api-fal-flux-2-pro-edit.md`
- `docs/api/api-fal-flux-dev.md`
- `docs/api/api-fal-nano-banana.md`
- `docs/api/api-fal-nano-banana-edit.md`
- `docs/api/api-fal-nano-banana-pro.md`
- `docs/api/api-fal-nano-banana-pro-edit.md`
- `docs/api/api-fal-seedream-4-5.md`
- `docs/api/api-fal-seedream-4-5-edit.md`

## Maintenance checklist
1. Add/update the model in code (`modelRegistry.ts`, pricing, submit/status handlers).
2. Add/update the API doc in this folder.
3. Link it in `docs/README.md`.
4. Run `npm -C frontend run docs:check`.
