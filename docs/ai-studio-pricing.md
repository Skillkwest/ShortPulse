# AI Studio Pricing & Model Registry

Short version: Models declare their own metadata (provider, aspects, size maps, pricing strategy). Pricing strategies consume that metadata to compute cost; UIs call a single `computeCostForModel` entry point.

## Where things live
- `frontend/features/ai-studio/logic/modelRegistry.ts` — model configs (id, provider, media type, default/allowed aspects, size map, pricing strategy).
- `frontend/features/ai-studio/logic/modelSizes.ts` — reusable aspect → size maps (e.g., Fal flux-dev).
- `frontend/features/ai-studio/logic/pricingStrategies.ts` — per-strategy calculators (Fal per-MP today).
- `frontend/features/ai-studio/logic/pricing.ts` — dispatcher (`computeCostForModel`) and compatibility helpers.

## Contract
- Model config includes `pricingStrategy` and optional `sizeMap` for strategies that need dimensions.
- `computeCostForModel(modelId, { aspect })` returns `{ credits, usd, megapixels, width, height } | null`.
- UIs and hooks stay dumb: pick a model, pass parameters, render the returned cost.

## Adding a model
1) Add a `ModelConfig` entry in `modelRegistry.ts` with `defaultAspect`, `allowedAspects`, and `pricingStrategy`.
2) Provide a `sizeMap` in `modelSizes.ts` if the strategy needs dimensions.
3) If pricing differs, add a new strategy in `pricingStrategies.ts` and reference it from the model.
4) Write tests covering the size map and cost output.

## Current strategies
- `fal-per-mp`: $0.025 per MP, credits at $0.01 each, ceiling on MP and credits. Uses the model’s `sizeMap`.
- `gpt41nano-per-token`: $0.10 per 1M input tokens + $0.025 per 1M output tokens, converted to credits at $0.01 each (minimum 1 credit per request).

### GPT-4.1 Nano (text)
- Assumptions: token pricing is per 1M tokens; we ceil to whole credits with a 1-credit minimum.
- Formula: `usd = (inputTokens * 0.10 / 1_000_000) + (outputTokens * 0.025 / 1_000_000)`; `credits = ceil(usd / 0.01)` (at least 1).
- Model config lives in `modelRegistry.ts` with strategy `gpt41nano-per-token`. Aspects are unused for text.

## Tests
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers Fal aspect resolution and rounding.
