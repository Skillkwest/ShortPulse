# AI Studio Pricing & Model Catalog

Short version: the admin pricing grid now owns final AI usage billed credits. Models still declare metadata and provider-cost context in the runtime catalog, but billable UI display and server debit must both resolve the same canonical `Billed credits` variant row authored through `/admin/pricing`.

## Where things live

- `frontend/lib/model-runtime/modelCatalog.ts` — canonical provider/model API contracts and product intent (submit/status aliases, defaults, validated fields, docs source + verification date, lifecycle, surfaces, billable flag, display family/order).
- `frontend/lib/model-runtime/modelRegistry.ts` — catalog-derived runtime model metadata and surface helpers (`listPickerModelConfigs()`, `listPricingModelConfigs()`, `listRuntimeModelConfigs()`).
- `frontend/lib/model-runtime/modelSizes.ts` — reusable aspect → size maps.
- `frontend/lib/model-runtime/pricingStrategies.ts` — per-strategy USD calculators.
- `frontend/lib/model-runtime/pricingCredits.ts` — shared USD→credits conversion with per-model markup and optional row-specific round-nearest behavior.
- `frontend/lib/server/api/modelPricingControlPlane.ts` — legacy/shared-policy control-plane surface retained only as migration-era architecture until billed lanes stop depending on it.
- `frontend/lib/model-runtime/pricing.ts` — dispatcher (`computeCostForModel`) and helpers.
- `frontend/features/ai-studio/logic/clientPricingDisplay.ts` — current client pricing adapter; this is not the durable end-state authority once billed lanes are fully migrated onto canonical admin-priced variant lookup.
- `frontend/features/ai-studio/logic/*` re-export runtime pricing modules for compatibility.
- `frontend/pages/api/pricing/model-policy.ts` — legacy/shared-policy snapshot route retained until billed lanes stop depending on shared-policy authority.
- `frontend/pages/api/admin/pricing/model-policy/apply.ts` / `rollback.ts` — admin mutation routes for versioned policy activation and rollback.
- `frontend/pages/api/admin/generation-trace.ts` + `frontend/pages/admin/generation-trace.tsx` — operator observability surface for estimate-vs-debit mismatch review via persisted `pricing_observability` metadata.
- `sql/migrations/096_add_model_pricing_control_plane.sql` — persistent policy versions/runtime pointers/audit events + service-role RPCs.

## Contract

- Model config includes lifecycle/surface metadata, `pricingStrategy`, and optional `sizeMap` for dimension-aware strategies.
- AI Studio picker options are derived from active catalog models with the `picker` surface; `/admin/pricing` model rows are derived from active, billable catalog models with the `pricing` surface.
- The canonical AI usage billed-credit value is the published `Billed credits` result calculated by `/admin/pricing` from admin-controlled inputs.
- Billable UI surfaces must resolve and display that exact canonical billed-credit row for the user's real billed configuration.
- Server-side debit must resolve and charge that same canonical billed-credit row for the same configuration.
- If the canonical published fixed row or self-contained quantity rule is unavailable, billable UI and debit must fail closed instead of inventing fallback credits. Quantity rules preserve the admin workbook's cost-credit rounding followed by its snapshotted markup and final rounding increment; runtime does not consult provider-rate inputs.
- Defaults for duration/resolution/audio come from catalog/registry and drive both UI estimate chips and server charge inputs.
- Shared-policy/runtime pricing math is deprecated as final billed-credit authority. It may remain temporarily as migration plumbing only until billed display and debit paths are fully moved onto canonical variant-row lookup.
- Active model-pricing policy document fields:
  - `global.creditUsdScale`
  - `perModel[modelId].creditUsdScale`
  - `perModel[modelId].markupBps`
  - `perModel[modelId].roundingIncrement`
  - `perModel[modelId].billingVariantProfile` for explicit policy-gated customer variant contracts
- Default policy:
  - Base conversion: `1 credit = $0.01`
  - Markup is model-specific only; legacy top-level markup fields are ignored during normalization.
  - Default credits: `rawCredits = ceil(providerUsd * creditUsdScale * (1 + modelMarkupBps / 10000))`, `credits = rawCredits`
- Per-model overrides:
  - Blank model markup fields calculate as `0%`; filled model markup fields control only that model.
  - Filled credit-conversion override fields replace the global conversion value for that model.
  - `roundingIncrement` is row-specific only. Blank means no additional round-nearest behavior.
- Blocked-pricing models remain legacy/no-markup until provider evidence is supplied.
- Current blocked set: none.
- `usdRaw` is provider USD before markup/rounding; `usd` is billed USD (`credits * 0.01`).
- Runtime authority target: admin edits define canonical billed-credit variant rows, and both AI Studio clients and server billing must consume that same stored variant value.
- Phase-1 billable surfaces on this contract are:
  - core AI Studio create/edit/image/video generate + regenerate flows
  - standard create primary generate
  - explicit assistant-output apply + follow-on primary generate
  - Pulse artifact generate
  - Music
  - Sound Effects
  - Voiceover
  - Voice Changer
- Explicit non-billable helper exclusions on this contract are:
  - style extraction
  - Voice Design preview/create helper flows
  - voice clone helper flow
- ElevenLabs sound generation now bills through the shared model-pricing engine for:
  - `eleven_v3` (voiceover) by billed character count
  - `eleven_multilingual_sts_v2` (voice changer) by processed source duration
  - `eleven_text_to_sound_v2` (sound effects) by generation or explicit duration
  - `music_v1` (music) by requested duration
- Voiceover Enhance (`POST /api/ai/voiceover-enhance`) is a non-audio helper route. It prepares script text for `eleven_v3` and does not reserve ElevenLabs generation credits or persist media.
- `metadata_only` ElevenLabs rows remain informational only for supporting/provider-preview models that are not user-billable through the shared runtime pricing policy.
- Billable submit paths attach `shortpulse_context.displayed_billed_credits`, `displayed_pricing_policy_version`, and the displayed variant identifier when available, plus `pricing_display_source` and `pricing_policy_ready` for diagnostics. The server rejects missing or stale evidence before reservation on covered image, video, and audio lanes; see `docs/adr/0100-pricing-policy-submit-handshake.md`.
- Seedance composition-neutral policies publish exactly one customer row per model/resolution with `per_output_second`. Image, audio, video, and mixed references do not change customer credits at fixed model/resolution/output duration. Input-video duration still selects modeled provider economics and must be known, positive, and at most 15 seconds before reservation. See `docs/adr/0101-seedance-composition-neutral-customer-pricing.md`.
- `/api/admin/pricing/model-policy/dry-run?target=seedance_composition_neutral_v1` reads the exact active policy/custom rows and returns the five-row candidate, legacy-to-target rule diff, margin envelopes, active row id, and review hash without mutation. Composition-neutral apply requires that hash plus the expected active row id; no rate or policy is activated automatically.

## Current strategies

- `fal-economy-image-per-mp`: `fal-ai/flux-2/klein/9b` uses `$0.006/MP`; `fal-ai/bria/background/remove` uses fixed `$0.018` per generation. Any model-specific billed result now comes from the shared credit conversion plus explicit per-model markup/rounding in the admin pricing panel.
- `fal-fill-per-mp`: `fal-ai/flux-pro/v1/fill` uses raw output megapixels at `$0.05/MP`.
- `nano-banana-2-per-image`: base `$0.08` with resolution multipliers (`0.5K x0.75`, `2K x1.5`, `4K x2`) plus optional web-search surcharge `+$0.015`.
- `nano-banana-per-image`: base `$0.15`, `4K` doubles, optional web-search surcharge `+$0.015`.
- `seedream-per-image`: base `$0.04`; strategy supports `4K` multiplier in runtime.
- `seedream-5-lite-per-image`: `$0.035` per image.
- `kling-3-per-second`:
  - Fal lanes: `$0.112/s` audio-off, `$0.168/s` audio-on, `$0.196/s` audio+voice
  - Kie lane (`kie-ai/kling-3.0`): bill on Kie `mode` rather than raw `resolution`; observed `std` audio-off = `14` Kie credits/s (`$0.07/s`), observed `pro` audio-off = `18` Kie credits/s (`$0.09/s`), and current runtime keeps a `1.5x` sound-on premium for those mode baselines until richer Kie evidence is captured.
- `veo-3-per-second`: Fal lanes use `$0.20/$0.40` (no-audio/audio) for non-4K and `$0.40/$0.60` for 4K; `kie-ai/veo-3.1-fast-i2v` uses fixed `$0.40` per video from current Kie pricing evidence.
- `elevenlabs-text-to-speech-per-kchar`: `eleven_v3` uses `$0.10` per 1,000 text characters.
- `elevenlabs-voice-changer-per-minute`: `eleven_multilingual_sts_v2` uses `$0.12` per processed source minute.
- `elevenlabs-sound-effect`: `eleven_text_to_sound_v2` uses `$0.12` per auto-duration API generation, or `$0.0132/s` when explicit duration is set.
- `elevenlabs-music-per-minute`: `music_v1` uses `$0.15` per generated music minute.
- `openai-text-token`: OpenAI standard short-context token rates for `gpt-5.4` (`$2.50`/M input, `$0.25`/M cached input, `$15.00`/M output), `gpt-5.4-mini` (`$0.75`/M input, `$0.075`/M cached input, `$4.50`/M output), and `gpt-5.4-nano` (`$0.20`/M input, `$0.02`/M cached input, `$1.25`/M output), then shared credit conversion plus any per-model markup and row-specific round-nearest override.

## Tests

- `frontend/lib/model-runtime/__tests__/pricingCredits.test.ts` covers conversion policy (credit ceiling, legacy-policy normalization, boundary behavior, per-model markup, and row-specific round-nearest behavior).
- `frontend/features/ai-studio/logic/__tests__/pricing.test.ts` covers strategy formulas including Kie Kling and Kie Veo calculations.
- `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts` runs matrix coverage over supported runtime settings and verifies no global round-nearest behavior is applied by default.
- `frontend/tests/api/generation-billing.reservations.test.ts` + `frontend/tests/api/generation-billing.pricing-params.test.ts` cover server parity (`buildPricingParams` vs `computeCostForModel`) and reservation metadata consistency.
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts` covers `shortpulse_context` pricing-observability metadata on billable submissions.
- `frontend/tests/api/admin-generation-trace.test.ts` covers mismatch counting plus normalized `pricingObservabilityMismatchRows` output for operator review.
