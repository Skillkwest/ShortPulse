# Recovery, Settlement, And Output Integrity Handoff

Status: marked handoff for Bactuo continuation; Copperknot implementation stopped after five focused passes.

## Large-Lane Stop Marker

Copperknot has already made five focused source and validation passes in this lane. Under the July 7 goal prompt, this is now too large for Copperknot to keep personally pushing by momentum. The lane is therefore marked for Bactuo continuation, with Copperknot retaining readiness acceptance authority after Bactuo returns evidence.

If Bactuo determines the remaining work also exceeds a couple focused passes, Bactuo should stop, mark the sub-lane, and return a narrower handoff rather than broadening the recovery/settlement architecture further.

## Launch Authority

- Copperknot authority: `docs/agents/copperknot/july-7-launch-authority.md`
- System map: `docs/agents/copperknot/july-7-system-map.md`
- Current queue: `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- Current board: `docs/agents/copperknot/july-7-launch-board.md`
- Bactuo local instructions: `docs/agents/bactuo/AGENTS.md`
- Architecture baseline: `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`
- Source map: `docs/agents/bactuo/generation-recovery-settlement-source-map.md`

## Human Promise

A user must not see a recovered generation as successful unless the app can also trust the billing settlement, output records, publication/projection state, and ownership lineage behind that success.

Preserve the current UI, UX, and intended behavior. This lane is source integrity work; visible redesign is out of scope unless Copperknot explicitly reopens the lane with evidence that the current experience cannot meet the July 7 launch promise.

## Copperknot Pass Completed On 2026-06-03

Implemented a first source-level architecture reduction:

- Added `frontend/lib/server/api/generationLineageResolver.ts` as the shared provider-request lineage resolver.
- Routed recovery request lookup through the resolver while preserving recovery's strict attempt-authority behavior.
- Routed billing settlement repair through the resolver while preserving projection-as-repair-evidence behavior.
- Changed recovered-success recovery branches so billing settlement completes before visible projection/publication sync.
- Added resolver contract tests and recovery ordering assertions.

Second Copperknot pass in the same lane:

- Extended the lineage resolver to expose generation attempt id and user id from `generation_attempts`.
- Routed direct terminal settlement attempt context through the shared resolver.
- Routed Fal webhook observation identity through the shared resolver.
- Changed direct terminal failure so billing settlement completes before failure projection sync.
- Added direct-failure ordering coverage and resolver-backed webhook test coverage.

Third Copperknot pass in the same lane:

- Changed projection lineage resolution so projection repair evidence still counts when `source_ref` is absent.
- Extended persisted status reads to find projection state by `provider_request_id` as well as `request_id`.
- Routed persisted status generation-id fallback through the shared provider-request lineage resolver before the legacy `ai_generations.request_id` fallback.
- Extended admin generation trace expansion through `generation_projection.provider_request_id` and `generation_projection.request_id` so diagnostics can find projection-only lineage when attempt rows are missing.
- Added status-persisted and admin-trace regression coverage for those fallback paths.

Fourth Copperknot pass in the same lane:

- Added direct-provider settlement gates for OpenAI image generate/edit and ElevenLabs text-to-speech, music, sound effects, and speech-to-speech.
- Moved direct-provider billing capture into the shared persistence helpers before output records, media library rows, publications, projections, and project associations can become visible.
- Added persistence-helper regression coverage proving failed settlement prevents output records, media visibility, publication, projection, and project association.
- Added route-level coverage proving direct OpenAI/ElevenLabs routes invoke settlement through the pre-visible gate instead of after persistence returns.

Fifth Copperknot pass in the same lane:

- Extended per-user admin health projection billing evidence to read `generation_projection` by `source_ref`, `provider_request_id`, and `request_id`.
- Extended fleet admin user-health scans to use successful projection media found by provider/request lineage before flagging cost-without-success risk.
- Fixed direct-provider settlement callback TypeScript narrowing by pinning the already-approved charge before async pre-visible settlement callbacks.
- Fixed projection status read typing so the shared status/projection helper has a non-optional Supabase admin client inside query closures.
- Added regression coverage for the exact false-positive class where charge `source_ref` differs from projection `source_ref`, but successful projection media is discoverable through provider/request lineage.

## Current Evidence

- `npm -C frontend run test -- lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/api/__tests__/directGenerationSettlement.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts lib/server/falIntegration/__tests__/recoveryMediaPersistence.test.ts lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchAcquisition.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/generationControlPlane/__tests__/controlPlaneWake.test.ts`
- Result: `13` test files passed, `110` tests passed.
- `npx eslint lib/server/api/generationLineageResolver.ts lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/directGenerationSettlement.ts lib/server/api/__tests__/directGenerationSettlement.test.ts lib/server/falIntegration/falWebhookIngress.ts lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/api/generationBilling/settlementService.ts lib/server/falIntegration/recoveryGenerationLookup.ts lib/server/falIntegration/recoveryExecution.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
- Result: passed with `0` errors and `0` warnings.
- `npm -C frontend run test -- lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/api/__tests__/directGenerationSettlement.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts lib/server/falIntegration/__tests__/recoveryMediaPersistence.test.ts lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchAcquisition.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/generationControlPlane/__tests__/controlPlaneWake.test.ts tests/api/fal-status-persisted-results.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-status.ownership.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts tests/api/admin-generation-trace.test.ts`
- Result: `18` test files passed, `184` tests passed.
- `npx eslint pages/api/admin/generation-trace.ts tests/api/admin-generation-trace.test.ts lib/server/api/falStatusPersistedResults.ts lib/server/api/generationProjection.ts lib/server/api/generationLineageResolver.ts tests/api/fal-status-persisted-results.test.ts lib/server/api/__tests__/generationLineageResolver.test.ts`
- Result: passed with `0` errors and `0` warnings.
- `npm -C frontend run test -- tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts`
- Result: `9` test files passed, `61` tests passed.
- `npx eslint pages/api/openai/image-generate.ts pages/api/openai/image-edit.ts pages/api/elevenlabs/text-to-speech.ts pages/api/elevenlabs/music.ts pages/api/elevenlabs/sound-effects.ts pages/api/elevenlabs/speech-to-speech.ts lib/server/openaiImageGeneration.ts lib/server/elevenlabs.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts`
- Result: passed with `0` errors and `0` warnings.
- `npm -C frontend run test -- lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/api/__tests__/directGenerationSettlement.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts lib/server/falIntegration/__tests__/recoveryMediaPersistence.test.ts lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchAcquisition.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/generationControlPlane/__tests__/controlPlaneWake.test.ts tests/api/fal-status-persisted-results.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-status.ownership.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts tests/api/admin-generation-trace.test.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts`
- Result: `27` test files passed, `245` tests passed.
- `npm -C frontend run test -- tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-snapshot.test.ts tests/lib/admin-user-health-fleet-scan.test.ts tests/lib/admin-user-health-policy.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts`
- Result: `15` test files passed, `82` tests passed.
- `npx eslint lib/server/adminUserHealth/snapshot.ts lib/server/adminUserHealth/deepReport.ts lib/server/adminUserHealth/fleet.ts lib/server/api/generationProjection.ts pages/api/openai/image-generate.ts pages/api/openai/image-edit.ts pages/api/elevenlabs/text-to-speech.ts pages/api/elevenlabs/music.ts pages/api/elevenlabs/sound-effects.ts pages/api/elevenlabs/speech-to-speech.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-snapshot.test.ts tests/lib/admin-user-health-fleet-scan.test.ts tests/lib/admin-user-health-policy.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts`
- Result: passed with `0` errors and `0` warnings.
- `npm -C frontend run test -- lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/api/__tests__/directGenerationSettlement.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts lib/server/falIntegration/__tests__/recoveryMediaPersistence.test.ts lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchAcquisition.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/generationControlPlane/__tests__/controlPlaneWake.test.ts tests/api/fal-status-persisted-results.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-status.ownership.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts tests/api/admin-generation-trace.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-snapshot.test.ts tests/lib/admin-user-health-fleet-scan.test.ts tests/lib/admin-user-health-policy.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts`
- Result: `33` test files passed, `266` tests passed.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
- Result: passed on `2026-06-03`; resolved deployment `https://shortpulse-ogvfclwu3-kirk-artmans-projects.vercel.app`, created at `2026-06-03T23:30:37.517Z`, inspected `161` route entries, and verified required internal routes.
- `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives`
- Result: unauthenticated production probes returned `401` for generation recovery, user health fleet, and media derivatives internal worker routes.
- Node fetch GET probes against `https://www.shortpulse.ai` returned `401 Unauthorized` for `/api/admin/generation-trace`, `/api/admin/user-health`, `/api/admin/user-health-fleet`, `/api/fal/nano-banana-pro-status`, `/api/openai/image-generate`, and `/api/elevenlabs/text-to-speech`.

Known validation caveat:

- `npm -C frontend run type-check:touched` remains blocked by unrelated dirty-worktree diagnostics in AI Studio Character/Pulse/ViewModel tests/runtime, model pricing materialization, Kie model contracts, and public dashboard route tests. The earlier direct-provider charge-narrowing and generation-projection admin-client diagnostics from this lane were resolved before this note.
- The production-safe checks above prove current production route presence and fail-closed protection only. They do not prove the local uncommitted resolver, settlement-gate, or admin-health hardening is deployed or production-convergent.

## Remaining Work

This system is still not launch-ready. The next agent should not restart from the old score-first audit. Start from the new resolver, settlement gates, and admin-health lineage evidence, then prove the remaining production lifecycle surfaces.

Required next proof:

- After commit/deploy approval, repeat route parity and run non-credit authenticated admin/status/read diagnostics against `https://www.shortpulse.ai` to prove the deployed resolver, settlement-gate, admin-health, status, and admin-trace lifecycle uses the same lineage truth.
- Credit-consuming production generation acceptance smoke remains approval-gated and should not be run without explicit approval.
- Decide whether a full shared terminal convergence coordinator is still required after the direct-provider pre-visible settlement gate and production-safe proof.
- Decide whether the resolver should become the only allowed provider-request lineage path for all future diagnostics and direct-provider settlement.

## Acceptance Bar

The lane can move out of `Blocked` only when:

- accepted-job recovery finds the correct generation from canonical lineage,
- success/failure settlement is completed or explicitly blocked before visible terminal success,
- output records and media/publication/projection convergence are consistent,
- diagnostics use the same lineage truth as runtime,
- targeted tests cover the invariant,
- production proof or a Copperknot-approved waiver is recorded.

## Stop Rules

- Do not change UI/UX by default.
- Do not run credit-consuming production generation without explicit approval.
- Do not perform destructive data operations.
- Do not change billing policy or public pricing promises in this lane.
- Do not move launch state to `Launch Ready` without production evidence or a documented Copperknot waiver.
