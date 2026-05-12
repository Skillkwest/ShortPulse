# AI Studio Audio Companion Art Plan (2026-05-11)

Status: proposed  
Scope: AI Studio generated audio refs and their audio-card surfaces  
Audience: follow-on implementation agent, product reviewer, docs/runtime reviewers

## Purpose

Define the implementation plan for audio companion art: a hidden branded image derived from the same user prompt that created a generated audio output, normalized for image generation, and rendered behind the audio ref card so audio refs are easier to distinguish visually.

This plan is the execution source of truth for the lane. It is intentionally strict about scope, decision gates, and stop rules so implementation does not drift into a second visible generation system by accident.

## Executive Summary

Recommended posture:

1. Treat this as `audio-owned companion art`, not as a normal image generation.
2. Scope the first rollout to newly generated AI Studio audio outputs only.
3. Generate the art asynchronously after audio success.
4. Trigger the art from a durable server-side seam owned by the audio routes, not from a client follow-up request or best-effort response-tail async.
5. Store the result in an explicit audio companion-art contract, not the existing video-poster contract.
6. Keep the art hidden from normal generation history, project preview selection, Media Library counts, and visible ref/output lists unless a later product decision widens scope.
7. Preserve the current gradient as the default fallback for pending, failed, uploaded, and out-of-scope audio surfaces.

## Repo-Backed Current-State Audit

### Trusted facts

1. `StudioOutput` has no dedicated companion-art contract today in `frontend/features/ai-studio/types.ts`.
2. Audio generation currently creates audio outputs without visual companion fields in `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`.
3. Audio cards already share a reusable shell through `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`, `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`, and `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`.
4. Shared audio-card styling is a static fallback gradient today in `frontend/styles/ai-studio-canvas.css`.
5. Generated audio persistence in `frontend/lib/server/elevenlabs.ts` stores the audio generation/media row only and does not create a companion image or generic visual derivative.
6. `previewPosterUrl` and related poster fields are effectively treated as video-owned, including in `frontend/features/ai-studio/reference-ingestion/prepareLibraryMediaIngestionPayload.ts`.
7. Session restore only preserves explicitly serialized output fields in `frontend/features/ai-studio/logic/sessionSnapshot.ts` and `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`.
8. The repo already has the correct prompt seam for hidden transformation:
   - prompt composition in `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`
   - branded hidden style adaptation in `frontend/features/ai-studio/logic/stylePromptAdapter.ts`
9. Audio routes already persist enough metadata to support deterministic visual normalization:
   - voiceover metadata in `frontend/pages/api/elevenlabs/text-to-speech.ts`
   - music metadata in `frontend/pages/api/elevenlabs/music.ts`
   - sound-effect metadata in `frontend/pages/api/elevenlabs/sound-effects.ts`
10. The public image route in `frontend/pages/api/openai/image-generate.ts` is a normal visible billed lane and should not be reused unchanged for hidden companion art.
11. Uploaded/library audio currently has no poster parity and leaves `previewPosterUrl` null in `frontend/features/ai-studio/logic/stateParsers.ts`.

### Audit conclusion

The repo already has the right seams for:

- hidden prompt transformation,
- shared audio-card rendering,
- and generated-audio metadata capture.

The repo does not yet have:

- an explicit audio companion-art contract,
- a hidden companion-image pipeline,
- or a persistence/read-model story for such an asset.

Those are the real implementation foundations. UI work is downstream of them.

## Authority Map

These are the primary code seams the implementation lane will likely need to touch or explicitly rule out.

### Output creation and client runtime

- `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts`

### Server persistence and media contracts

- `frontend/lib/server/elevenlabs.ts`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/pages/api/openai/image-generate.ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/music.ts`
- `frontend/pages/api/elevenlabs/sound-effects.ts`

### Session/project durability and output hydration

- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/hooks/useAiStudioSessionReferenceDurability.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`

### Rendering surfaces

- `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`
- `frontend/styles/ai-studio-canvas.css`

## Product Contract

### In scope for phase-one rollout

- newly generated AI Studio audio outputs only
- Reference Grid audio cards
- AI Studio Media Library inline audio cards where those generated outputs appear
- hidden async companion-art generation after audio success
- audio-card outputs only, not video/remux-preview surfaces

### Explicitly out of scope for phase-one rollout

- uploaded audio parity
- existing library audio parity
- historical backfill for older generated audio outputs unless a separate replay lane is approved
- companion art as a visible standalone generated image
- reuse of the existing video-poster contract as the long-term audio solution
- speech-to-speech or voice-changer remuxed video outputs that render as video surfaces rather than audio cards
- non-AI Studio media surfaces unless they intentionally adopt the same audio-card contract later

### Required behavior

- Audio appears immediately with the existing gradient fallback.
- Companion art upgrades the card asynchronously when ready.
- Companion-art failure never fails the audio output.
- Companion art is hidden from normal generation history and visible output accounting.
- Delete, reroll, abandon, restore, retry, and replay rules must be explicit before implementation.

### Scope clarification

`voice-changer` remains relevant to prompt-normalization inventory if the lane later wants broad audio-source coverage, but phase-one UI rollout is limited to outputs that actually render through the shared audio-card shell. If a source mode routes through remuxed video with `previewPosterUrl`, it is out of this rollout unless the product explicitly widens scope.

## Decision Register

These decisions must be frozen in Phase 0. Defaults below are the recommended values if product does not override them.

| Decision | Options | Recommended default |
| --- | --- | --- |
| Rollout scope | Generated audio only / broader parity | Generated audio only |
| Historical posture | New generations only / bounded backfill | New generations only |
| Ownership model | Hidden companion decoration / visible first-class asset | Hidden companion decoration |
| Billing policy | Bundled / separate / internal non-billable | Must be explicitly decided before route work |
| Async trigger model | Durable server-side enqueue / client follow-up / same-request best-effort async | Durable server-side enqueue |
| Persistence model | Hidden linked generation / audio-owned media metadata | Audio-owned hidden contract |
| Storage/privacy | Shared authority with audio / separate authority | Same authority as owning audio |
| Restore behavior | Durable across restore / runtime-only | Explicit decision required before serializer work |

## Proposed Data Contract

Do not overload `previewPosterUrl`.

Recommended first-pass `StudioOutput` additions:

- `companionArtUrl?: string | null`
- `companionArtStoragePath?: string | null`
- `companionArtStatus?: "pending" | "ready" | "failed" | null`
- `companionArtGenerationId?: string | null`

Why this shape:

- it is small,
- it covers async lifecycle states cleanly,
- and it keeps the art clearly attached to the audio output rather than pretending the output itself became a video/poster-bearing media type.

## Proposed Runtime Model

1. User generates audio.
2. Audio output is created and returned immediately.
3. Output starts with fallback styling and `companionArtStatus: "pending"`.
4. A hidden internal companion-art lane compiles a visual prompt from the audio prompt plus route metadata.
5. The lane generates/persists the companion image under audio-owned authority.
6. The output is updated to `ready` or `failed`.
7. Audio-card surfaces rerender accordingly.

## Recommended Orchestration Seam

Phase one should treat the audio routes as the authority for starting companion-art work.

Recommended posture:

1. `text-to-speech`, `music`, and `sound-effects` complete their normal audio billing/persistence path first.
2. After the audio output is durably recorded and the audio billing path is settled, the server creates or enqueues exactly one companion-art job keyed to the audio output identity.
3. The companion-art job runs through an internal hidden image-generation seam and updates the owning audio output state asynchronously.

Why this is the right trigger seam:

- the audio routes already own the authoritative generated-audio metadata
- the client hook is not durable enough to be the source of truth
- a best-effort unawaited task at the end of the request is too fragile for a persisted feature
- audio billing capture should finish independently of companion-art success or failure

## Rejected Implementation Shapes

Do not do these:

- do not trigger companion art from a second client-side request in `useAiStudioAudioGeneration`
- do not reuse `/api/openai/image-generate` as-is and let it create a visible billed image output
- do not overload `previewPosterUrl` or general video-poster semantics
- do not rely on untracked response-tail async work after the API response returns
- do not attach companion art to remuxed video derivatives just because a voice-changer route also emits a video output

## Phase Plan

### Phase 0: Contract Freeze

Objective:

- lock the product, lifecycle, billing, and ownership model before code.

Entry criteria:

- current-state audit accepted
- phase-one scope understood

Work:

- choose rollout scope
- choose historical backfill posture
- choose billing posture
- choose async trigger model
- choose ownership/persistence model
- choose restore behavior
- choose delete/reroll/abandon/retry/replay behavior

Audit questions:

- Is generated-only scope explicit, or are uploads/library audio drifting into assumed parity?
- Is historical replay/backfill explicit?
- Is the async trigger durable and server-owned, or is the plan still relying on client or best-effort request-tail behavior?
- Can companion art accidentally appear in project previews, counts, or visible histories?
- Is the feature hidden decoration or a visible asset?

Exit criteria:

- every row in the Decision Register is frozen

Stop rule:

- do not start persistence or route work until the decision register is complete

### Phase 1: Prompt Compiler And Brand Profile

Objective:

- build the prompt-transformation contract for audio-to-image conversion.

Entry criteria:

- Phase 0 decisions frozen

Work:

- create one helper that transforms `audio prompt -> normalized image prompt`
- create source-mode rules for:
  - voiceover
  - music
  - sound-effects
  - voice-changer
- attach one consistent internal brand style profile/prompt

Audit questions:

- Are raw audio prompts being forwarded blindly into image generation?
- Are audio-only instructions stripped or rewritten when they do not map visually?
- Is the visible user prompt still separate from the hidden submission prompt?
- Is the brand style controlled by one authority seam?

Exit criteria:

- prompt compiler can deterministically produce a branded hidden image prompt for every in-scope audio source mode

Stop rule:

- do not start generation wiring if the prompt compiler still has undefined behavior for one of the in-scope source modes

### Phase 2: Output Contract And Persistence

Objective:

- add the explicit audio companion-art state model.

Entry criteria:

- Phase 1 compiler behavior accepted

Work:

- add `StudioOutput` companion-art fields
- extend serializers/hydrators if restore durability is in scope
- choose and implement the persistence representation
- define storage/privacy inheritance from the owning audio asset
- define whether project/workspace save flows and session-reference durability should upload/preserve companion-art assets or intentionally drop them when out of scope

Audit questions:

- Is the implementation trying to reuse the video-poster contract?
- Can the companion image inherit weaker privacy than the audio?
- Does restore silently drop the fields?
- Do saved/read-model parsers understand pending, ready, and failed states?
- Do project/workspace durability paths preserve the contract intentionally rather than by accidental poster-field reuse?

Exit criteria:

- the runtime and persistence layers can represent companion-art state without ambiguity

Stop rule:

- do not start async generation if the persistence/read model cannot distinguish pending, ready, and failed states cleanly

### Phase 3: Hidden Generation Pipeline

Objective:

- implement the async internal companion-art lane.

Entry criteria:

- output contract exists
- persistence model is frozen
- async trigger model is frozen

Work:

- add an internal helper/route boundary for hidden companion-art generation
- connect the enqueue/trigger seam to the authoritative audio routes
- persist/update companion-art state on the owning audio output
- make failure non-fatal for audio
- add telemetry/logging for companion-art outcomes
- make retries and replays idempotent by owning audio output identity

Audit questions:

- Is the lane accidentally using the public visible image-generation route unchanged?
- Does the trigger happen after audio persistence/billing settlement instead of entangling companion-art success with audio completion?
- Can retries or replay create duplicate hidden images?
- Can companion art leak into visible refs, outputs, or media queries?
- Is moderation/failure handling explicit for the normalized image prompt?

Exit criteria:

- one audio output can produce at most one owned companion-art result for the active contract

Stop rule:

- do not move to UI rollout if duplicate creation or visible-surface leakage is still possible

### Phase 4: Surface Rendering Rollout

Objective:

- render companion art behind the shared audio-card shell without changing audio behavior.

Entry criteria:

- async lane is stable
- output state transitions are observable from the UI

Work:

- update `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx` to support art-underlay rendering
- wire the Reference Grid path in `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- wire AI Studio Media Library inline audio-card parity where generated outputs surface there
- preserve fallback styling in `frontend/styles/ai-studio-canvas.css`

Audit questions:

- Does the art reduce control legibility or block interaction?
- Does the pending/failed fallback still look intentional?
- Has the one-sound-at-a-time audio policy regressed?
- Are uploaded/library audio surfaces now half-supported visually without an explicit policy?

Exit criteria:

- in-scope generated audio cards can show companion art while all fallback and playback behavior remains correct

Stop rule:

- do not widen surface scope until the first two in-scope surfaces are stable

### Phase 5: Validation, Docs, And Closeout

Objective:

- prove the lane is stable and document the final contract.

Entry criteria:

- UI rollout complete for the approved surfaces

Work:

- add prompt-compiler tests
- add persistence/restore tests if durability is in scope
- add async success/failure UI tests
- add browser-level validation for generated audio ref appearance and fallback behavior
- update docs for the final companion-art contract and any persistence/billing semantics

Audit questions:

- Is failure-path fallback covered?
- Is restore covered when restore is in scope?
- Are doc indexes and any schema/data-dictionary implications updated?
- Is the final behavior still hidden-decoration rather than visible-output drift?

Exit criteria:

- generated audio refs reliably gain branded background art without visible asset leakage and with safe fallback on failure

Stop rule:

- stop when the hidden companion-art contract is stable; do not continue by adjacency into upload parity or historical backfill without a new problem statement

## Validation Matrix

The implementation lane should lock these checks before closeout.

### Unit and hook coverage

- prompt compiler normalization by source mode
- `useAiStudioAudioGeneration` output creation with companion-art pending state
- serializer/hydrator coverage if restore durability is in scope

### Server/persistence coverage

- one audio output yields at most one companion-art record for the active contract
- failure marks `failed` without harming the audio output
- privacy/storage inheritance matches the owning audio asset
- audio billing settlement remains correct even when companion-art generation fails
- companion-art trigger runs for in-scope audio outputs but not remuxed video derivatives

### UI coverage

- Reference Grid audio card upgrades from fallback to ready art
- AI Studio Media Library inline audio card parity for generated outputs
- fallback remains intact for pending and failed states
- one-sound-at-a-time audio behavior remains unchanged

### Explicit non-regression checks

- no visible extra image refs are added to normal output surfaces
- project preview/counting behavior does not accidentally include companion art
- out-of-scope video/remux surfaces remain unchanged
- no client-only retry path becomes the hidden source of truth for companion-art generation

## Cross-Phase Risks

### Risk 1: Visible-surface leakage

Why it matters:

- users would see mystery images they did not ask for

Mitigation:

- keep the persistence contract explicitly hidden/audio-owned
- audit projections, counts, and preview selectors before rollout

### Risk 2: Bad visual prompt normalization

Why it matters:

- raw audio prompts are often poor image prompts

Mitigation:

- use source-mode normalization
- centralize the branded hidden style profile

### Risk 3: Audio latency regression

Why it matters:

- audio is the primary user action

Mitigation:

- keep companion art fully asynchronous after audio success

### Risk 4: Restore-state drift

Why it matters:

- serializer omissions would silently drop the feature

Mitigation:

- explicitly choose restore durability and implement serializer work only if in scope

### Risk 5: Generated-only rollout looks partial by accident

Why it matters:

- users can read inconsistency as brokenness if scope is not visible in behavior

Mitigation:

- document generated-only scope
- keep the fallback gradient intentional for out-of-scope audio surfaces

### Risk 6: Duplicate hidden image creation

Why it matters:

- retries, replays, and refresh races can create multiple hidden companions for one audio output

Mitigation:

- make the server lane idempotent by owning audio output id

### Risk 7: Privacy/storage mismatch

Why it matters:

- companion art should not become less protected than the owning audio

Mitigation:

- inherit storage/privacy authority from the owning audio asset
- audit signed URL and query behavior

## Implementation Entry Checklist

- rollout scope frozen
- historical posture frozen
- billing posture frozen
- ownership model frozen
- restore posture frozen
- prompt compiler contract frozen
- storage/privacy inheritance frozen
- output contract defined
- idempotency strategy defined
- validation matrix drafted before code

## Suggested Build Order

1. freeze the Decision Register
2. build the prompt compiler and brand profile
3. add the output contract and persistence shape
4. build the hidden async generation lane with idempotency
5. wire the shared audio-card surfaces
6. add tests and docs closeout

## Final Audit Summary

What changed from the previous draft:

- phase boundaries are tighter
- decision freezing is now explicit instead of implied
- entry/exit criteria are defined per phase
- historical backfill, idempotency, and privacy inheritance are treated as first-class concerns
- the stop rules now explicitly prevent scope creep into visible image-generation behavior

## Closeout

This lane is ready for implementation once the Phase 0 decisions are confirmed. The plan is intentionally biased toward the smallest safe version of the feature: generated-audio-only, hidden, async, branded, and attached to the owning audio output rather than elevated into a second visible asset system.
