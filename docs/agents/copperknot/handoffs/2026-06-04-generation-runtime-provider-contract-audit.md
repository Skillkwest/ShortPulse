# Next-Agent Handoff: Generation Runtime And Provider Contract Audit

## Lane Id

`generation-runtime-provider-contract-audit-2026-06-04`

## Copy/Paste Use

- This packet is intended for Bactuo as the generation lifecycle/provider owner.
- Copperknot owns final readiness interpretation after the returned closeout.
- Treat this as a provider-contract and generation-lifecycle audit first. Do not broaden into UI redesign, pricing policy, production deployment, or environment mutation.

## Why This Task

- Launch system: `Generation runtime and providers`
- Launch state: `Below Bar - Handoff Ready`
- Evidence level: `Locally Tested`
- Human risk: `High`
- Operational risk: `High`
- Technical risk: `High`
- Why now: after Recovery, Media Library, Storage, Create/Pulse, and AI Studio shell lanes were handed off or locally strengthened, this is the next unblocked July 7 queue item.
- Why Copperknot is stopping: the lane spans OpenAI direct-complete routes, Fal/Kie submit/status/recovery adapters, ElevenLabs audio generation routes, provider env posture, live provider compatibility, and Bactuo's known architecture-consolidation risks around identity, settlement, and visibility. That is significant Bactuo-owned generation lifecycle work, not a couple Copperknot patches.

## Current Copperknot Evidence

- Branch and branch guard are `production`.
- `README.md` and `docs/routes.md` define active provider surfaces:
  - Fal/Kie routes under `/api/fal/*`
  - GPT Image 2 routes under `/api/openai/image-generate` and `/api/openai/image-edit`
  - ElevenLabs routes under `/api/elevenlabs/*`
- `docs/agents/bactuo/generation-recovery-settlement-source-map.md` identifies the core truth stack:
  - lifecycle: `ai_generations`
  - provider attempts: `generation_attempts`
  - canonical outputs: `ai_generation_outputs`
  - projection/publication: `generation_projection`, `generation_publications`
  - billing: `ai_credit_reservations`, `ai_credit_ledger`
- `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md` says the system is salvageable but under-consolidated, with known risk from fragmented lineage, cross-provider identifier drift, settlement/visibility ordering, projection sprawl, and diagnostics drift.
- `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts` centralizes provider submit dispatch, canonical provider request-id extraction, Kie payload normalization, Kie media guards, and trusted submit targets.
- `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts` centralizes provider-specific status/result/response-probe dispatch for Fal and Kie.
- `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts` centralizes Kie runtime flags, model allowlisting, always-on Kie model handling, trusted hosts, and trusted submit/status URL resolution.
- `frontend/lib/model-runtime/modelCatalog.ts` is the canonical model metadata/catalog surface for provider, lifecycle, execution mode, submit handler, pricing metadata, allowed aspects/resolutions/durations, and API provenance.
- Current generated Fal/Kie submit/status modules are labeled as generated canonical route wrappers from `scripts/lib/fal_route_inventory.js`, not generic compatibility wrappers.
- Current `npm -C frontend run validate` and `npm -C frontend run validate:phase11:fal-regression` both run `npm run fal:routes:check`, so generated wrapper drift is now part of the routine and provider-specific validation bars.

## Validation Already Run

- `npm -C frontend run test -- lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderPolicy.test.ts lib/server/providerIntegration/__tests__/statusProviderSelection.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts lib/server/providerIntegration/__tests__/canonicalProviderPayload.test.ts lib/server/providerIntegration/__tests__/providerHeaderUtils.test.ts lib/server/providerIntegration/__tests__/kieEnvelopeNormalizer.test.ts lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts lib/server/providerIntegration/__tests__/kieSubmitMediaGuards.test.ts lib/server/providerIntegration/__tests__/kieSubmitTransportContracts.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/model-runtime/__tests__/providerModelIds.test.ts lib/model-runtime/__tests__/falModelIds.test.ts lib/model-runtime/__tests__/modelCatalogDefaultRoles.test.ts`
  - `19` files / `125` tests passed.
- `npm -C frontend run fal:routes:check`
  - passed; `17` route families checked.
- `npm -C frontend run test -- features/ai-studio/hooks/taskSubmission/__tests__/routing.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts features/ai-studio/hooks/taskSubmission/__tests__/videoPayloads.test.ts features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts features/ai-studio/hooks/taskSubmission/__tests__/seedreamSubmission.test.ts features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts features/ai-studio/hooks/taskSubmission/__tests__/outputLifecyclePatches.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submitInvariants.test.ts features/ai-studio/hooks/taskSubmission/__tests__/preflightTimeout.test.ts`
  - `9` files / `96` tests passed.

## Required Context

Read first:

- `AGENTS.md`
- `docs/agents/bactuo/README.md`
- `docs/agents/bactuo/AGENTS.md`
- `docs/agents/bactuo/memory.md`
- `docs/agents/bactuo/standard-operating-procedure.md`
- `docs/agents/bactuo/generation-recovery-settlement-source-map.md`
- `docs/agents/bactuo/ownership-manifest.md`
- `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/sops/sop_provider_incident_response.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_video_generation.md`
- `docs/api/api-openai-gpt-image-2.md`
- `docs/api/api-elevenlabs-audio-models.md`
- current Kie/Fal API docs for active models listed in `docs/api/`

Inspect first:

- `frontend/lib/model-runtime/modelCatalog.ts`
- `frontend/lib/model-runtime/providerModelIds.ts`
- `frontend/lib/model-runtime/falModelIds.ts`
- `frontend/lib/server/providerIntegration/*`
- `frontend/pages/api/fal/*`
- `frontend/pages/api/openai/image-generate.ts`
- `frontend/pages/api/openai/image-edit.ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- `frontend/pages/api/elevenlabs/music.ts`
- `frontend/pages/api/elevenlabs/sound-effects.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/*`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/lib/server/elevenlabs.ts`
- `frontend/lib/server/falIntegration/*`
- `frontend/lib/server/api/directGenerationSettlement.ts`
- `frontend/lib/server/api/generationBilling/*`

## Scoped Task

Prove or disprove whether active provider runtime contracts are launch-reliable enough for July 7.

Answer:

1. Are active model ids, providers, route wrappers, submit handlers, status/result paths, allowed payload fields, and client submit payloads internally consistent?
2. Do OpenAI direct-complete image routes, Kie/Fal queued routes, and ElevenLabs audio routes normalize provider output into the same generation/output lifecycle expectations?
3. Do provider adapters preserve one clear distinction between lifecycle truth, provider-attempt truth, canonical output truth, billing truth, and projection/publication truth?
4. Are Kie/Fal trusted URL, status/result, media guard, and transport normalization contracts sufficient for launch, or do any live-provider edge cases remain untested?
5. Which production-safe checks can prove env/provider posture without spending credits, and which minimal generation smokes would require explicit approval?
6. Does this lane need a narrow source fix now, or should it remain part of Bactuo's staged generation-kernel consolidation plan?

## Owned Write Surface

Preferred output is a findings/closeout report. Code changes are allowed only for narrow provider-contract regressions that preserve current UI/UX, billing policy, and intended behavior.

Allowed code/docs changes if needed:

- `frontend/lib/server/providerIntegration/*`
- `frontend/lib/model-runtime/*`
- `frontend/pages/api/fal/*`
- `scripts/lib/fal_route_inventory.js`
- `frontend/pages/api/openai/image-generate.ts`
- `frontend/pages/api/openai/image-edit.ts`
- `frontend/pages/api/elevenlabs/*`
- `frontend/features/ai-studio/hooks/taskSubmission/*`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/lib/server/elevenlabs.ts`
- `frontend/lib/server/falIntegration/*`
- `frontend/lib/server/api/directGenerationSettlement.ts`
- `frontend/lib/server/api/generationBilling/*`
- directly corresponding tests
- Bactuo source map or architecture plan if shipped contract changes

## Forbidden Scope

- No UI, UX, visual, or intended behavior changes.
- No pricing-policy, plan, entitlement, or Stripe/subscription changes.
- No production env mutation or credential exposure.
- No commit, push, deploy, release, destructive data operation, Docker Supabase flow, credit-consuming production generation test, or Supabase image transformation.
- No bypassing payload validation, trusted-host checks, billing settlement, or lifecycle ordering to make a provider call work.
- No broad generation-kernel implementation unless the lane is explicitly approved as architecture consolidation.

## Suggested Proof

Local/non-credit:

- Re-run Copperknot's provider contract slice after any source change.
- Re-run task-submission payload matrix and routing tests after any client submit change.
- Run `npm -C frontend run fal:routes:check` after route inventory or wrapper changes.
- Run `npm -C frontend run validate:phase11:fal-regression` for the provider-lane validation bar when a full local provider regression pass is warranted; it now starts with `fal:routes:check`.
- Run `npm -C frontend run type-check` and `npm -C frontend run lint` after code changes.
- Run `npm -C frontend run docs:check` after doc changes.

Production-safe:

- Confirm production URL `https://www.shortpulse.ai`.
- Check route parity for active provider routes without invoking generation.
- Check protected routes fail closed unauthenticated where applicable.
- Inspect production env posture only through approved non-secret mechanisms; do not print secrets.
- If authenticated non-credit UI proof is available, verify model picker and Generate disabled/guardrail behavior without submitting generation.

Approval-gated:

- If provider compatibility cannot be proven without real generation, propose the smallest paid/credit-consuming smoke matrix and stop for approval.
- Suggested minimal smoke, only if approved:
  - one GPT Image 2 direct-complete image run,
  - one Kie video run from the active low-cost/shortest allowed lane,
  - one ElevenLabs audio run from the active lowest-cost lane,
  - Fal image route only if still active in the public launch picker and not already covered by retained production evidence.

## Done State

Stop when one of these is true:

- Local/provider-contract proof and production-safe checks support launch-watch posture, with exact remaining credit-consuming smokes named.
- A narrow provider-contract regression is fixed and validated, with remaining production proof named.
- Production/env/provider proof is blocked by credentials, approval, or credit cost, with exact next owner/action named.
- Fresh evidence shows the lane requires Bactuo architecture-consolidation implementation; stop and return a staged implementation handoff instead of continuing.

## Stop Rules

- Stop immediately if the next step requires credit-consuming generation, environment mutation, deploy/release, pricing policy, broad architecture rewrite, or cross-agent ownership beyond Bactuo.
- Stop instead of patching if validation begins oscillating or if the source problem spans more than a couple focused passes.
- If a non-generation owner is needed, create a focused follow-on handoff rather than absorbing that work into Bactuo.

## Required Closeout Report

Create:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/YYYY-MM-DD-generation-runtime-provider-contract-audit-closeout.md`

Required contents:

- lane id
- source handoff path
- execution status
- production target and freshness
- provider/model surfaces inspected
- files changed
- active model id/route matrix
- OpenAI proof
- Kie/Fal proof
- ElevenLabs proof
- lifecycle/settlement/projection interpretation
- production-safe checks run
- credit-consuming proof requested or explicitly not run
- validation commands
- self-audit findings
- residual risk
- recommended Copperknot readiness decision
