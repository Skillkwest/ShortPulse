# AI Studio Pricing & Model Catalog

Short version: models declare metadata in runtime catalog/registry, pricing strategies compute provider USD, and one shared versioned model-pricing policy applies credit conversion, markup, rounding, and per-model overrides so UI estimates and server debits stay in parity.

## Where things live
- `frontend/lib/model-runtime/modelCatalog.ts` — canonical provider/model API contracts (submit/status aliases, defaults, validated fields, docs source + verification date).
- `frontend/lib/model-runtime/modelRegistry.ts` — runtime model metadata (labels, media type, pricing strategy).
- `frontend/lib/model-runtime/modelSizes.ts` — reusable aspect → size maps.
- `frontend/lib/model-runtime/pricingStrategies.ts` — per-strategy USD calculators.
- `frontend/lib/model-runtime/pricingCredits.ts` — shared USD→credits conversion (markup + rounding policy).
- `frontend/lib/server/api/modelPricingControlPlane.ts` — versioned runtime control-plane resolver for the active pricing policy document.
- `frontend/lib/model-runtime/pricing.ts` — dispatcher (`computeCostForModel`) and helpers.
- `frontend/features/ai-studio/logic/*` re-export runtime pricing modules for compatibility.
- `frontend/pages/api/pricing/model-policy.ts` — authenticated client read route for the active policy snapshot.
- `frontend/pages/api/admin/pricing/model-policy/apply.ts` / `rollback.ts` — admin mutation routes for versioned policy activation and rollback.
- `sql/migrations/096_add_model_pricing_control_plane.sql` — persistent policy versions/runtime pointers/audit events + service-role RPCs.

## Contract
- Model config includes `pricingStrategy` and optional `sizeMap` for dimension-aware strategies.
- `computeCostForModel(modelId, params, pricingPolicy?)` returns `{ credits, usd, rawCredits, usdRaw, megapixels, width, height } | null`.
- Defaults for duration/resolution/audio come from catalog/registry and drive both UI estimate chips and server charge inputs.
- Active model-pricing policy document fields:
  - `global.creditUsdScale`
  - `global.markupBps`
  - `global.defaultRoundingMode`
  - `global.defaultRoundingIncrement`
  - `perModel[modelId].creditUsdScale`
  - `perModel[modelId].markupBps`
  - `perModel[modelId].roundingIncrement`
- Default policy:
  - Base conversion: `1 credit = $0.01`
  - Markup: `+3%` before quantization
  - Default quantization: `rawCredits = ceil(markedCredits)`, `credits = ceil(rawCredits / 5) * 5`
- Per-model overrides:
  - Blank override fields in the admin panel inherit the global setting.
  - Filled override fields fully replace the corresponding global value for that model.
- Blocked-pricing models remain legacy/no-markup until provider evidence is supplied.
- Current blocked set: none.
- `usdRaw` is provider USD before markup/quantization; `usd` is billed USD (`credits * 0.01`).
- Runtime authority: admin edits create a new versioned policy document and update the control-plane singleton; AI Studio clients and server billing both resolve that same active document with a short cache TTL.
- ElevenLabs sound generation now bills through the shared model-pricing engine for:
  - `eleven_multilingual_v2` (voiceover) by billed character count
  - `eleven_multilingual_sts_v2` (voice changer) by processed source duration
  - `eleven_text_to_sound_v2` (sound effects) by generation or explicit duration
  - `music_v1` (music) by requested duration
- `metadata_only` ElevenLabs rows remain informational only for supporting/provider-preview models that are not user-billable through the shared runtime pricing policy.

## Current strategies
- `fal-economy-image-per-mp`: `fal-ai/flux-2/klein/9b` uses `$0.006/MP`; `fal-ai/bria/background/remove` uses fixed `$0.018` per generation. Any model-specific billed result now comes from the shared global policy plus explicit per-model overrides in the admin pricing panel.
- `fal-fill-per-mp`: `fal-ai/flux-pro/v1/fill` uses `$0.05/MP` with provider MP-ceil behavior.
- `google-nano-banana-per-image`: `$0.039` flat per image.
- `nano-banana-2-per-image`: base `$0.08` with resolution multipliers (`0.5K x0.75`, `2K x1.5`, `4K x2`) plus optional web-search surcharge `+$0.015`.
- `nano-banana-per-image`: base `$0.15`, `4K` doubles, optional web-search surcharge `+$0.015`.
- `seedream-per-image`: base `$0.04`; strategy supports `4K` multiplier in runtime.
- `seedream-5-lite-per-image`: `$0.035` per image.
- `kling-3-per-second`:
  - Fal lanes: `$0.112/s` audio-off, `$0.168/s` audio-on, `$0.196/s` audio+voice
  - Kie lane (`kie-ai/kling-3.0`): bill on Kie `mode` rather than raw `resolution`; observed `std` audio-off = `14` Kie credits/s (`$0.07/s`), observed `pro` audio-off = `18` Kie credits/s (`$0.09/s`), and current runtime keeps a `1.5x` sound-on premium for those mode baselines until richer Kie evidence is captured.
- `veo-3-per-second`: Fal lanes use `$0.20/$0.40` (no-audio/audio) for non-4K and `$0.40/$0.60` for 4K; `kie-ai/veo-3.1-fast-i2v` uses fixed `$0.40` per video from current Kie pricing evidence.
- `seedance-1.5-per-second`: Kie-log-backed rate table for `kie-ai/seedance-1.5-pro`: `720p` `$0.0175/s` audio-off and `$0.035/s` audio-on; `1080p` `$0.0375/s` audio-off and `$0.075/s` audio-on; `480p` remains a conservative interim baseline pending direct Kie evidence.
- `gpt41nano-per-token`: `$0.10` per 1M input + `$0.025` per 1M output, then shared markup/quantization policy.

## Tests
- `frontend/lib/model-runtime/__tests__/pricingCredits.test.ts` covers conversion policy (default rounding, legacy-policy normalization, boundary behavior, markup ordering).
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers strategy formulas including Kie Kling and Kie Veo calculations.
- `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts` runs matrix coverage over supported runtime settings and rounding-policy assertions.
- `frontend/tests/api/generation-billing.reservations.test.ts` + `frontend/tests/api/generation-billing.pricing-params.test.ts` cover server parity (`buildPricingParams` vs `computeCostForModel`) and reservation metadata consistency.
