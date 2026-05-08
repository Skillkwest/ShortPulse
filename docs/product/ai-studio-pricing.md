# AI Studio Pricing & Model Catalog

Short version: models declare metadata in runtime catalog/registry, pricing strategies compute provider USD, and one shared versioned model-pricing policy applies credit conversion plus per-model markup/rounding so UI estimates and server debits stay in parity.

## Where things live

- `frontend/lib/model-runtime/modelCatalog.ts` — canonical provider/model API contracts and product intent (submit/status aliases, defaults, validated fields, docs source + verification date, lifecycle, surfaces, billable flag, display family/order).
- `frontend/lib/model-runtime/modelRegistry.ts` — catalog-derived runtime model metadata and surface helpers (`listPickerModelConfigs()`, `listPricingModelConfigs()`, `listRuntimeModelConfigs()`).
- `frontend/lib/model-runtime/modelSizes.ts` — reusable aspect → size maps.
- `frontend/lib/model-runtime/pricingStrategies.ts` — per-strategy USD calculators.
- `frontend/lib/model-runtime/pricingCredits.ts` — shared USD→credits conversion with per-model markup and optional row-specific round-nearest behavior.
- `frontend/lib/server/api/modelPricingControlPlane.ts` — versioned runtime control-plane resolver for the active pricing policy document.
- `frontend/lib/model-runtime/pricing.ts` — dispatcher (`computeCostForModel`) and helpers.
- `frontend/features/ai-studio/logic/*` re-export runtime pricing modules for compatibility.
- `frontend/pages/api/pricing/model-policy.ts` — authenticated client read route for the active policy snapshot.
- `frontend/pages/api/admin/pricing/model-policy/apply.ts` / `rollback.ts` — admin mutation routes for versioned policy activation and rollback.
- `sql/migrations/096_add_model_pricing_control_plane.sql` — persistent policy versions/runtime pointers/audit events + service-role RPCs.

## Contract

- Model config includes lifecycle/surface metadata, `pricingStrategy`, and optional `sizeMap` for dimension-aware strategies.
- AI Studio picker options are derived from active catalog models with the `picker` surface; `/admin/pricing` model rows are derived from active, billable catalog models with the `pricing` surface.
- `computeCostForModel(modelId, params, pricingPolicy?)` returns `{ credits, usd, rawCredits, usdRaw, megapixels, width, height } | null`.
- Defaults for duration/resolution/audio come from catalog/registry and drive both UI estimate chips and server charge inputs.
- Active model-pricing policy document fields:
  - `global.creditUsdScale`
  - `perModel[modelId].creditUsdScale`
  - `perModel[modelId].markupBps`
  - `perModel[modelId].roundingIncrement`
- Default policy:
  - Base conversion: `1 credit = $0.01`
  - Markup is model-specific only; legacy top-level markup fields are ignored during normalization.
  - Default shared-policy markup in the admin pricing workspace is `60%` unless a model or variant override is supplied.
  - Default credits: `rawCredits = ceil(providerUsd * creditUsdScale * (1 + modelMarkupBps / 10000))`, `credits = rawCredits`
- Per-model overrides:
  - Blank model markup fields inherit the active shared-policy default (`60%` in the current admin grid baseline); filled model markup fields control only that model.
  - Filled credit-conversion override fields replace the global conversion value for that model.
  - `roundingIncrement` is row-specific only. The current admin pricing workspace defaults to whole-credit rounding and hides the dedicated Round Up column from the primary grid.
- Blocked-pricing models remain legacy/no-markup until provider evidence is supplied.
- Current blocked set: none.
- `usdRaw` is provider USD before markup/rounding; `usd` is billed USD (`credits * 0.01`).
- Runtime authority: admin edits create a new versioned policy document and update the control-plane singleton; AI Studio clients and server billing both resolve that same active document with a short cache TTL.
- `/admin/pricing` is the operator-facing review surface for that policy: grouped parent rows summarize model families, expandable variant rows carry the editable provider-cost and markup inputs, and browser-local draft state survives refreshes until the operator applies or resets the draft.
- ElevenLabs sound generation now bills through the shared model-pricing engine for:
  - `eleven_multilingual_v2` (voiceover) by billed character count
  - `eleven_multilingual_sts_v2` (voice changer) by processed source duration
  - `eleven_text_to_sound_v2` (sound effects) by generation or explicit duration
  - `music_v1` (music) by requested duration
- `metadata_only` ElevenLabs rows remain informational only for supporting/provider-preview models that are not user-billable through the shared runtime pricing policy.

## Current strategies

- `fal-economy-image-per-mp`: `fal-ai/flux-2/klein/9b` uses `$0.006/MP`; `fal-ai/bria/background/remove` uses fixed `$0.018` per generation. Any model-specific billed result now comes from the shared credit conversion plus explicit per-model markup/rounding in the admin pricing panel.
- `fal-fill-per-mp`: `fal-ai/flux-pro/v1/fill` uses raw output megapixels at `$0.05/MP`.
- `google-nano-banana-per-image`: `$0.039` flat per image.
- `nano-banana-2-per-image`: base `$0.08` with resolution multipliers (`0.5K x0.75`, `2K x1.5`, `4K x2`) plus optional web-search surcharge `+$0.015`.
- `nano-banana-per-image`: base `$0.15`, `4K` doubles, optional web-search surcharge `+$0.015`.
- `seedream-per-image`: base `$0.04`; strategy supports `4K` multiplier in runtime.
- `seedream-5-lite-per-image`: `$0.035` per image.
- `kling-3-per-second`:
  - Fal lanes: `$0.112/s` audio-off, `$0.168/s` audio-on, `$0.196/s` audio+voice
  - Kie lane (`kie-ai/kling-3.0`): use [Kie pricing](https://kie.ai/pricing) as source of truth. Current shared-policy rows split by resolution and audio state in the admin grid: `1080p / audio off = $0.09/s`, `1080p / audio on = $0.135/s`, `720p / audio off = $0.07/s`, `720p / audio on = $0.105/s`.
- `veo-3-per-second`: Fal lanes use `$0.20/$0.40` (no-audio/audio) for non-4K and `$0.40/$0.60` for 4K; `kie-ai/veo-3.1-fast-i2v` currently uses fixed per-video Kie pricing evidence and is displayed in the admin grid as a flat-per-video lane rather than a pure per-second lane.
- `seedance-1.5-per-second`: use [Kie pricing](https://kie.ai/pricing) as source of truth. Current runtime/admin rows split by resolution plus `with video input` vs `no video input`: `1080p` `$0.15/s` with video input and `$0.30/s` without video input, `720p` `$0.07/s` with video input and `$0.14/s` without video input, `480p` `$0.04/s` with video input and `$0.08/s` without video input.
- `seedance-2-per-second`: use [Kie pricing](https://kie.ai/pricing) as source of truth. Current runtime/admin rows split by resolution plus `with video input` vs `no video input`: `1080p` `$0.31/s` with video input and `$0.51/s` without, `720p` `$0.125/s` with and `$0.205/s` without, `480p` `$0.0575/s` with and `$0.095/s` without.
- `seedance-2-fast-per-second`: use [Kie pricing](https://kie.ai/pricing) as source of truth. Current runtime/admin rows split by resolution plus `with video input` vs `no video input`: `720p` `$0.10/s` with and `$0.165/s` without, `480p` `$0.045/s` with and `$0.0775/s` without.
- `openai-text-token`: admin pricing uses simplified blended-character estimates rather than raw input/output token tables. The current admin grid treats these rows as `Per 50,000 characters`, with editable character count and screenshot-based provider baselines: `gpt-5.4-nano $0.009`, `gpt-5.4-mini $0.033`, `gpt-5.4 $0.141`, `gpt-5.5 $0.281`, and `gpt-5.4-pro` / `gpt-5.5-pro $1.69` per `50,000` blended characters. The `Rate Source` value stays fixed at the 50k basis while `$ at cost`, credits, billed USD, and margin scale linearly with the chosen character count.

## Tests

- `frontend/lib/model-runtime/__tests__/pricingCredits.test.ts` covers conversion policy (credit ceiling, legacy-policy normalization, boundary behavior, per-model markup, and row-specific round-nearest behavior).
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers strategy formulas including Kie Kling and Kie Veo calculations.
- `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts` runs matrix coverage over supported runtime settings and verifies no global round-nearest behavior is applied by default.
- `frontend/tests/api/generation-billing.reservations.test.ts` + `frontend/tests/api/generation-billing.pricing-params.test.ts` cover server parity (`buildPricingParams` vs `computeCostForModel`) and reservation metadata consistency.
