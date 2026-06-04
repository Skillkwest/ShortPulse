# Primary Generation Route Account Boundary Audit

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security audit, no code edit

## Scope

Audited current primary working routes and helpers that customers actually use for generation, billing capture, provider status, media persistence, and project attachment. Legacy/deleted/fallback routes were intentionally not pursued in this lane.

Primary surfaces checked:

- `frontend/pages/api/openai/image-generate.ts`
- `frontend/pages/api/openai/image-edit.ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- `frontend/pages/api/elevenlabs/music.ts`
- `frontend/pages/api/elevenlabs/sound-effects.ts`
- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/lib/server/api/falStatusPersistedResults.ts`
- `frontend/lib/server/api/generationLineageResolver.ts`
- `frontend/lib/server/api/directGenerationSettlement.ts`
- `frontend/lib/server/api/generationBilling/settlementService.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`

## Threats Checked

1. A signed-in user supplies another user's `project_id`, crossing the project/media/generation boundary and attaching generated output to a foreign project.
2. A signed-in user supplies another user's provider `requestId`, crossing the provider-status boundary and reading or settling foreign generation output.
3. A generation success/failure path publishes visible output before billing capture/refund settlement, crossing the credits/account boundary.
4. Current dirty route-map/API changes remove auth coverage from a primary sensitive route.

## Findings

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| No confirmed primary-route cross-user project/media/provider/credit leak in audited current code | Informational | High | Authenticated user to project, media, provider request, and credit settlement authority | Reduces launch uncertainty on primary generation routes | High as audit evidence, no code edit |

## Evidence

- Static check over changed API files found `0` changed sensitive API handlers that are unprotected, outside intentional public/webhook/internal surfaces, and missing route-level or protected-prefix auth.
- OpenAI and ElevenLabs primary submit routes call `requireApiUser` before billing/provider execution.
- Fal status routes call `requireApiUser` and then `resolveProviderRequestOwnership({ userId, providerRequestId })` before status/result handling.
- `project_id` from primary submit routes flows into `associateGenerationAndMediaWithProjectForUserBestEffort`, which verifies the project row belongs to `user_id`, verifies generation/media ownership, and only then inserts `project_generation_items` / `project_media_items`.
- Direct generation success/failure paths and direct-complete OpenAI/ElevenLabs persistence now run billing settlement before publication/projection/project-visible output.
- `generationLineageResolver` scopes projection fallback lookups by `userId` on user-triggered reads; webhook/recovery identity resolves from provider request lineage, not client user authority.

## Validation

Passed:

```bash
npm -C frontend test -- --run tests/api/auth-guarded-ai-routes.test.ts tests/api/fal-status-persisted-results.test.ts lib/server/api/__tests__/generationLineageResolver.test.ts
```

Result: 3 files, 24 tests passed.

Passed:

```bash
npm -C frontend test -- --run lib/server/__tests__/projectGenerationAssociationsService.test.ts tests/lib/openaiImageGeneration.persistGeneratedImageAsset.test.ts tests/lib/elevenlabs.persistGeneratedAudioAsset.test.ts tests/lib/elevenlabs.persistGeneratedVideoAsset.test.ts
```

Result: 4 files, 49 tests passed.

Passed:

```bash
npm -C frontend test -- --run lib/server/api/__tests__/directGenerationSettlement.test.ts tests/api/openai-image-generate.test.ts tests/api/openai-image-edit.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts
```

Result: 7 files, 56 tests passed.

## Deferred

- Authenticated primary generation routes still return some provider/internal error detail in `details` fields. This was not selected as a fix-now item because this audit did not confirm exposure of secrets, signed URLs, customer-private data, or cross-user authority. Treat it as a future response-shape hardening candidate only if fresh evidence shows sensitive leakage.
- Legacy/deleted/fallback route removal was not audited as a security fix lane, per the current instruction to focus on primary working routes.

## Stop Condition

Reached. This bounded primary-route account-boundary audit found no confirmed high-ROI root-cause fix. Continuing into nearby route cleanup or legacy/fallback surfaces would be lower ROI than stopping.
