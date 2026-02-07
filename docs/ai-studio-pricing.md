# AI Studio Pricing & Model Registry

Short version: Models declare their own metadata (provider, aspects, size maps, pricing strategy). Pricing strategies consume that metadata to compute cost; UIs call a single `computeCostForModel` entry point.

## Where things live
- `frontend/features/ai-studio/logic/modelRegistry.ts` — model configs (id, provider, media type, default/allowed aspects, size map, pricing strategy, default duration/resolution/audio when relevant).
- `frontend/features/ai-studio/logic/modelSizes.ts` — reusable aspect → size maps (used by FLUX variants).
- `frontend/features/ai-studio/logic/pricingStrategies.ts` — per-strategy calculators (Fal per-MP today).
- `frontend/features/ai-studio/logic/pricing.ts` — dispatcher (`computeCostForModel`) and compatibility helpers.

## Contract
- Model config includes `pricingStrategy` and optional `sizeMap` for strategies that need dimensions.
- `computeCostForModel(modelId, { aspect })` returns `{ credits, usd, megapixels, width, height } | null`.
- UIs and hooks stay dumb: pick a model, pass parameters, render the returned cost.
- Defaults for duration/resolution/audio are read from `modelRegistry` (e.g., Veo 3.1 → 8s @ 1080p with audio) and reused by cost chips and debit logic. Use `buildDefaultPricingParams(modelId)` when you need a consistent baseline.

## Adding a model
1) Add a `ModelConfig` entry in `modelRegistry.ts` with `defaultAspect`, `allowedAspects`, and `pricingStrategy`.
2) Provide a `sizeMap` in `modelSizes.ts` if the strategy needs dimensions.
3) If pricing differs, add a new strategy in `pricingStrategies.ts` and reference it from the model.
4) Write tests covering the size map and cost output.

## Current strategies
- `fal-flux2-per-mp`: $0.012 per MP, credits at $0.01 each. Uses the model’s `sizeMap`.
- `fal-flux2-pro-per-mp`: $0.03 for the first MP + $0.015 each additional MP, then converted to credits at $0.01 each.
- `google-nano-banana-per-image`: $0.039 flat per image (4 credits); currently used by the `fal-ai/nano-banana` queue.
- `nano-banana-per-image`: $0.15 per image (15 credits). 4K renders double to $0.30 (30 credits) and enabling web search adds $0.015 (1.5 credits); resolution/web search flags are passed via the pricing parameters (default resolution 1K). Currently used by the `fal-ai/nano-banana-pro` queue.
- `seedream-per-image`: $0.04 per image (4 credits). 4K renders double to $0.08 (8 credits); no web-search surcharge is applied for this model.
- `kling-2.6-motion-per-second`: $0.112 per second; defaults to 10s. This strategy powers `fal-ai/kling-video/v2.6/pro/motion-control`.
- `kling-3-per-second`: $0.224 per second with audio off, $0.336 per second with audio on (default), $0.392 per second when voice control is used with audio; defaults to 10s. This strategy powers `fal-ai/kling-video/v3/pro/image-to-video` and `fal-ai/kling-video/v3/pro/text-to-video`.
- `veo-3-per-second`: 1080p w/ audio $0.40 per second (default), 4K w/ audio $0.60 per second; audio-off tiers are $0.20/$0.40 per second. Defaults to 8s @ 1080p with audio on. Used by `fal-ai/veo3.1` and `fal-ai/veo3.1/first-last-frame-to-video`.
- `sora-2-pro-per-second`: Tiered per-second pricing (standard vs high) using 10s/15s tiers; powers `fal-ai/sora-2/text-to-video/pro` with audio on. We request 8s by default (queue supports 4/8/12s) while charging at the 10s tier for consistency.
- `gpt41nano-per-token`: $0.10 per 1M input tokens + $0.025 per 1M output tokens, converted to credits at $0.01 each (minimum 1 credit per request).

### GPT-4.1 Nano (text)
- Assumptions: token pricing is per 1M tokens; we ceil to whole credits with a 1-credit minimum.
- Formula: `usd = (inputTokens * 0.10 / 1_000_000) + (outputTokens * 0.025 / 1_000_000)`; `credits = ceil(usd / 0.01)` (at least 1).
- Model config lives in `modelRegistry.ts` with strategy `gpt41nano-per-token`. Aspects are unused for text.

## Tests
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers Fal/flux variants, Kling defaults (motion control + v3), and token pricing.
- `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts` ensures every registered model with a pricing strategy returns a non-null cost with its default params.
