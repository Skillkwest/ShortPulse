# Billing / Credits Runtime Hardening Closeout

## Lane id

`billing-credits-runtime-hardening`

## Source handoff path

- User-provided handoff packet in the current Codex thread: `Next-Agent Handoff: Billing / Credits Runtime Hardening` (2026-05-16)

## Execution status

- bounded hardening patch complete

## Systems touched

- `Billing / credits`
- `Generation Platform` (billing-runtime ingress seam only)

## Files changed

- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/errorTelemetryPolicy.ts`
- `frontend/lib/generationAdmissionErrors.ts`
- `frontend/lib/falClient.ts`
- `frontend/lib/openAiImageClient.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`
- `frontend/lib/__tests__/openAiImageClient.admission-limit.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts`
- `frontend/tests/api/generation-billing.reservations.test.ts`
- `frontend/tests/lib/error-telemetry-policy.test.ts`
- `frontend/tests/api/openai-image-generate.test.ts`
- `frontend/tests/api/openai-image-edit.test.ts`
- `frontend/tests/api/elevenlabs-text-to-speech-route.test.ts`
- `frontend/tests/api/elevenlabs-sound-effects-route.test.ts`
- `frontend/tests/api/elevenlabs-music-route.test.ts`
- `frontend/tests/api/elevenlabs-speech-to-speech-route.test.ts`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-16-billing-credits-runtime-hardening-closeout.md`

## Summary of what changed

- Tightened the reservation hot path so explicit runtime denials no longer degrade into permissive billing bypasses.
- `insufficient_credits` from the canonical admit-and-reserve RPC now fails closed with `402` and an `INSUFFICIENT_CREDITS` code.
- `admission_limited` from the same RPC now fails closed with `429`, `Retry-After`, and a deterministic `GENERATION_ADMISSION_LIMIT` payload.
- Admission-limit logging now preserves the canonical `telemetry.api.fal_submit.admission_limited` source for Fal routes while direct OpenAI/ElevenLabs submit routes emit `telemetry.api.direct_submit.admission_limited` to avoid Fal-only telemetry misclassification.
- Direct OpenAI image and ElevenLabs audio clients now share one admission-error formatter, so `GENERATION_ADMISSION_LIMIT` and `GENERATION_ADMISSION_UNAVAILABLE` preserve retry guidance outside the Fal client path.
- Recoverable reservation-runtime unavailability still uses the existing bypass path so temporary RPC/schema outages do not become a full submit outage.
- Added focused regression coverage proving these explicit denial outcomes return `null` charge contexts instead of `billingMode: "bypass"`, and that direct routes stop before provider submission once billing has already written a fail-closed response.

## Acceptance criteria reached

- One major billing-runtime ambiguity was reduced: explicit reservation denial outcomes are now authoritative at submit time instead of being left for later settlement/recovery cleanup.
- The patch is bounded to the billing-runtime seam and does not widen into pricing catalog or Stripe control-plane redesign.

## Evidence snapshot

- Before the patch, `chargeGenerationRequest(...)` converted both `insufficient_credits` and atomic `admission_limited` outcomes into `buildBypassCharge(...)`.
- Before the follow-up hardening, the shared billing helper also emitted Fal-only admission telemetry for non-Fal routes, and only the Fal client preserved structured admission retry guidance.
- After the patch:
  - insufficient credits returns a closed `402` response immediately
  - atomic admission limits return a closed `429` response with `Retry-After`
  - Fal and direct-submit admission telemetry are split by route family
  - OpenAI image and ElevenLabs audio surfaces now render the same structured retry guidance as Fal
  - only recoverable reservation unavailability still bypasses

## Validation run

- `npm -C frontend test -- --run tests/api/generation-billing.reservations.test.ts tests/lib/error-telemetry-policy.test.ts lib/__tests__/falClient.admission-limit.test.ts lib/__tests__/openAiImageClient.admission-limit.test.ts features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts`

## Validation evidence

- Passed: focused billing/direct-submit suite (`57` tests across `11` files)
- New assertions cover:
  - fail-closed insufficient-credit RPC outcome
  - fail-closed atomic admission-limited RPC outcome with `Retry-After`
  - Fal-vs-direct telemetry source split
  - structured retry guidance for direct OpenAI image and ElevenLabs audio submits
  - route-owned early returns that skip provider submission/persistence after fail-closed billing responses

## Blockers encountered

- None

## Residual risk

- Recoverable reservation-runtime outages still use the existing bypass behavior, so the system is not yet fully strict under schema/RPC degradation.
- Fal submit routes still perform later observational admission evaluation for telemetry/backpressure; this patch only makes the billing-runtime denial seam authoritative when the atomic reservation RPC has already denied the request.

## Recommended score effect

- `Billing / credits`: recommend rerating from `6/10` toward `7/10` candidate status for this seam, because the hot-path reservation runtime now rejects explicit denials instead of pushing them into downstream settlement ambiguity.

## Recommended next step for Copperknot review

- Re-evaluate the `Billing / credits` row with this invariant in mind, then decide whether the remaining rerate blocker is now the recoverable-bypass policy under reservation-runtime outages rather than the explicit deny path itself.
