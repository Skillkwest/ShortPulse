# AI Studio Pricing & Model Catalog

Short version: Models declare their own metadata (provider, aspects, size maps, pricing strategy). Pricing strategies consume that metadata to compute cost; UIs call a single `computeCostForModel` entry point.

## Where things live
- `frontend/lib/model-runtime/modelCatalog.ts` — canonical provider/model API contracts (submit/status aliases, defaults, validated fields, doc source + verification date).
- `frontend/features/ai-studio/logic/modelRegistry.ts` — UI/runtime metadata (labels, media type, pricing strategy) derived from catalog defaults.
- `frontend/features/ai-studio/logic/modelSizes.ts` — reusable aspect → size maps (used by FLUX variants).
- `frontend/features/ai-studio/logic/pricingStrategies.ts` — per-strategy calculators (Fal per-MP today).
- `frontend/features/ai-studio/logic/pricing.ts` — dispatcher (`computeCostForModel`) and compatibility helpers.

## Contract
- Model config includes `pricingStrategy` and optional `sizeMap` for strategies that need dimensions.
- `computeCostForModel(modelId, { aspect })` returns `{ credits, usd, rawCredits, usdRaw, megapixels, width, height } | null`.
- UIs and hooks stay dumb: pick a model, pass parameters, render the returned cost.
- Defaults for duration/resolution/audio are sourced from the model catalog and surfaced through `modelRegistry` (e.g., Veo 3.1 → 8s @ 1080p with audio) for cost chips and debit logic. Use `buildDefaultPricingParams(modelId)` when you need a consistent baseline.
- Credit conversion is two-step and shared across estimations/debits for all models except explicit fixed-price exceptions: `rawCredits = ceil(usd / 0.01)`, then `credits = ceil(rawCredits / 5) * 5`.
- `usdRaw` is provider-estimated pre-rounding USD; `usd` is the billed USD equivalent (`credits * 0.01`).
- KEI pricing is excluded from active model options and KEI runtime/API surfaces are decommissioned.

## Adding a model
1) Add/update the model API contract in `frontend/lib/model-runtime/modelCatalog.ts`.
2) Add/update the `ModelConfig` entry in `modelRegistry.ts` with label/media/pricing metadata.
3) Provide a `sizeMap` in `modelSizes.ts` if the strategy needs dimensions.
4) If pricing differs, add a new strategy in `pricingStrategies.ts` and reference it from the model.
5) Write tests covering the size map and cost output.

## Current strategies
- `fal-flux2-per-mp`: $0.012 per MP, then converted with 5-credit step rounding. Uses the model’s `sizeMap`.
- `fal-flux2-klein-per-mp`: FLUX.2 Lite (`fal-ai/flux-2/klein/9b`) is intentionally fixed at 1 credit per run (does not apply 5-credit step rounding), while still using the model size map for dimensional metadata.
- `fal-flux2-pro-per-mp`: $0.03 for the first MP + $0.015 each additional MP, then converted with 5-credit step rounding.
- `google-nano-banana-per-image`: $0.039 flat per image, rounded to the nearest 5-credit step (currently bills 5 credits); used by the `fal-ai/nano-banana` queue.
- `nano-banana-2-per-image`: base $0.08 per image with resolution multipliers (`0.5K x0.75`, `1K x1`, `2K x1.5`, `4K x2`) and optional web-search surcharge `+$0.015`, then converted with the shared 5-credit step rounding policy; used by `fal-ai/nano-banana-2` and `fal-ai/nano-banana-2/edit`.
- `nano-banana-per-image`: $0.15 per image (15 credits). 4K renders double to $0.30 (30 credits) and enabling web search adds $0.015 (1.5 credits); resolution/web search flags are passed via the pricing parameters (default resolution 1K). Currently used by the `fal-ai/nano-banana-pro` queue.
- `seedream-per-image`: $0.04 per image, rounded to the nearest 5-credit step (currently 5 credits). 4K doubles to $0.08 and rounds to 10 credits; no web-search surcharge.
- `kling-3-per-second`: $0.224 per second with audio off, $0.336 per second with audio on (default), $0.392 per second when voice control is used with audio; defaults to 10s. This strategy powers `fal-ai/kling-video/v3/pro/image-to-video` and `fal-ai/kling-video/v3/pro/text-to-video`.
- `veo-3-per-second`: 1080p w/ audio $0.40 per second (default), 4K w/ audio $0.60 per second; audio-off tiers are $0.20/$0.40 per second. Defaults to 8s @ 1080p with audio on. Used by `fal-ai/veo3.1`, `fal-ai/veo3.1/first-last-frame-to-video`, and `fal-ai/veo3.1/image-to-video`.
- `sora-2-pro-per-second`: Tiered per-second pricing (standard vs high) using 10s/15s tiers; powers `fal-ai/sora-2/text-to-video/pro` with audio on. We request 8s by default (queue supports 4/8/12s) while charging at the 10s tier for consistency.
- `gpt41nano-per-token`: $0.10 per 1M input tokens + $0.025 per 1M output tokens, converted with 5-credit step rounding.

### GPT-4.1 Nano (text)
- Assumptions: token pricing is per 1M tokens.
- Formula: `usd = (inputTokens * 0.10 / 1_000_000) + (outputTokens * 0.025 / 1_000_000)`; `rawCredits = ceil(usd / 0.01)`; `credits = ceil(rawCredits / 5) * 5`.
- Model config lives in `modelRegistry.ts` with strategy `gpt41nano-per-token`. Aspects are unused for text.

## Tests
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers Fal/flux variants, Kling defaults (motion control + v3), and token pricing.
- `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts` ensures every registered model with a pricing strategy returns a non-null cost with its default params.
