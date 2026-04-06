# AI Studio Pricing & Model Catalog

Short version: models declare metadata in runtime catalog/registry, pricing strategies compute provider USD, and one shared converter applies markup + rounding so UI estimates and server debits stay in parity.

## Where things live
- `frontend/lib/model-runtime/modelCatalog.ts` — canonical provider/model API contracts (submit/status aliases, defaults, validated fields, docs source + verification date).
- `frontend/lib/model-runtime/modelRegistry.ts` — runtime model metadata (labels, media type, pricing strategy).
- `frontend/lib/model-runtime/modelSizes.ts` — reusable aspect → size maps.
- `frontend/lib/model-runtime/pricingStrategies.ts` — per-strategy USD calculators.
- `frontend/lib/model-runtime/pricingCredits.ts` — shared USD→credits conversion (markup + rounding policy).
- `frontend/lib/model-runtime/pricing.ts` — dispatcher (`computeCostForModel`) and helpers.
- `frontend/features/ai-studio/logic/*` re-export runtime pricing modules for compatibility.

## Contract
- Model config includes `pricingStrategy` and optional `sizeMap` for dimension-aware strategies.
- `computeCostForModel(modelId, params)` returns `{ credits, usd, rawCredits, usdRaw, megapixels, width, height } | null`.
- Defaults for duration/resolution/audio come from catalog/registry and drive both UI estimate chips and server charge inputs.
- Credit policy:
  - Base conversion: `1 credit = $0.01`
  - Markup: `+3%` before quantization
  - Default quantization: `rawCredits = ceil(markedCredits)`, `credits = ceil(rawCredits / 5) * 5`
  - Exception quantization (no nearest-5): `fal-ai/flux-2/klein/9b`, `fal-ai/bria/background/remove` use `credits = rawCredits`
- Blocked-pricing models remain legacy/no-markup until provider evidence is supplied.
- Current blocked set: none.
- `usdRaw` is provider USD before markup/quantization; `usd` is billed USD (`credits * 0.01`).

## Current strategies
- `fal-flux2-per-mp`: `$0.012/MP`; `fal/flux-2/edit` includes normalized `1 MP` input + output MP.
- `fal-flux2-klein-per-mp`: `fal-ai/flux-2/klein/9b` uses `$0.006/MP` with ceil-only exception rounding; `fal-ai/bria/background/remove` uses fixed `$0.018` per generation with ceil-only exception rounding.
- `fal-flux2-pro-per-mp`: `fal/flux-2-pro` uses `$0.03` first MP + `$0.015` each additional MP (MP rounded up); `fal/flux-2-pro/edit` uses same schedule plus normalized `1 MP` input allowance for deterministic edit-lane parity; `fal-ai/flux-pro/v1/fill` uses `$0.05/MP` with provider MP-ceil behavior.
- `google-nano-banana-per-image`: `$0.039` flat per image.
- `nano-banana-2-per-image`: base `$0.08` with resolution multipliers (`0.5K x0.75`, `2K x1.5`, `4K x2`) plus optional web-search surcharge `+$0.015`.
- `nano-banana-per-image`: base `$0.15`, `4K` doubles, optional web-search surcharge `+$0.015`.
- `seedream-per-image`: base `$0.04`; strategy supports `4K` multiplier in runtime.
- `seedream-5-lite-per-image`: `$0.035` per image.
- `kling-3-per-second`:
  - Fal lanes: `$0.112/s` audio-off, `$0.168/s` audio-on, `$0.196/s` audio+voice
  - Kie lane (`kie-ai/kling-3.0`): `1080p` `$0.135/s` audio-off, `$0.20/s` audio-on; `720p` `$0.10/s` audio-off, `$0.15/s` audio-on.
- `veo-3-per-second`: Fal lanes use `$0.20/$0.40` (no-audio/audio) for non-4K and `$0.40/$0.60` for 4K; `kie-ai/veo-3.1-fast-i2v` uses fixed `$0.30` per video.
- `seedance-1.5-per-second`: token formula (`tokens = width*height*24*duration/1024`), `$2.4` per 1M tokens with audio / `$1.2` without audio.
- `gpt41nano-per-token`: `$0.10` per 1M input + `$0.025` per 1M output, then shared markup/quantization policy.

## Tests
- `frontend/lib/model-runtime/__tests__/pricingCredits.test.ts` covers conversion policy (default rounding, exception rounding, boundary behavior, markup ordering).
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers strategy formulas including Kie Kling and Kie Veo calculations.
- `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts` runs matrix coverage over supported runtime settings and rounding-policy assertions.
- `frontend/tests/api/generation-billing.reservations.test.ts` + `frontend/tests/api/generation-billing.pricing-params.test.ts` cover server parity (`buildPricingParams` vs `computeCostForModel`) and reservation metadata consistency.
