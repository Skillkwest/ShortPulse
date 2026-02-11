# API Reference Index

Purpose: canonical integration references for external model/provider APIs used by ShortPulse.

## Scope
- OpenAI platform references (`api-responses`, `api-chat-completions`).
- Fal model references used by AI Studio generation routes.
- Request payload defaults, status polling behavior, output shapes, and pricing notes.

## File conventions
- Naming: `api-<provider>-<model>.md`.
- Every API doc should include: auth, submit endpoint, status/result flow, key params, output schema, and ShortPulse defaults.
- Keep implementation details aligned with `frontend/pages/api/*` proxies and `frontend/features/ai-studio/logic/*` pricing/model registry.

## Maintenance checklist
1. Add/update the model in code (`modelRegistry.ts`, pricing, submit/status handlers).
2. Add/update the API doc in this folder.
3. Link it in `docs/README.md`.
4. Run `npm -C frontend run docs:check`.
