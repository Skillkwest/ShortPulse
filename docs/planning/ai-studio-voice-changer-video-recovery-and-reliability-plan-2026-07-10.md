# AI Studio Voice Changer Video Recovery And Reliability Plan

Status: local remediation complete; hosted migration, recovery, deploy, and production proof pending  
Created: 2026-07-10  
Program: Program 4 — Workflows And Product Surfaces  
Primary contract: `docs/adr/0057-voice-changer-canonical-staged-audio-intake.md`

## Implementation Checkpoint — 2026-07-10

Completed locally on `production` without commit, push, deploy, paid generation, or account mutation:

- source selection is separate from duration/poster metadata updates;
- video origin and poster authority survive WAV extraction, with waveform controls restricted to
  genuine audio input;
- staged-audio namespace authority is validated before billing and missing original-video storage
  fails closed;
- the normal route returns one explicit remux outcome and persists recoverable audio metadata;
- normal generation, retry route, and recovery CLI share `lib/server/voiceChangerRemux.ts`;
- failed video assembly creates a dedicated no-charge `Retry video` action;
- duplicate persistence uses deterministic request identity; published/media-backed work is repaired
  and reused, fresh unpublished work remains in progress, and only stale unpublished rows with no
  owned media are reclaimed before retry;
- failed or pending remux state is projected without storage authority and reconstructs one
  deterministic retry card after refresh, while an existing deterministic sibling suppresses stale
  projected retry state;
- dry-run-first recovery tooling exists at `scripts/recover_voice_changer_video.ts`;
- fifteen focused suites pass (194 tests), including a real ffmpeg video+audio stream test, durable
  restore, the visible retry action, the no-charge retry route, and upload-before-insert orphan
  cleanup;
- type-check, touched app-file lint, docs checks, recovery-command execution-order/source checks,
  hosted-contract source checks, and `git diff --check` pass.

Deferred proof boundaries:

- The linked production schema dump did not prove
  `ai_generations_user_request_id_unique_idx`; migration 019 verification and migration 221 apply are
  database/release authority boundaries that must precede deployment of retry idempotency and durable
  retry restore.
- The canonical hosted schema probe now includes `generation_projection.remux_recovery` and correctly
  fails against this workspace's configured hosted target because migration 221 is not applied there
  (the same target also lacks the unrelated migration-220 browser-crash table).
- Required linked read-only SQL lint reaches the hosted database but exits on the existing unrelated
  `capture_generation_reservation_by_provider_request` unused-variable warning; it does not provide a
  clean migration-release lint gate for this lane.
- A bounded read-only lookup for the confirmed owner generation against this workspace's configured
  admin environment returned no matching row, so it could not classify or dry-run recovery without
  switching to the authoritative production account surface. Customer recovery also needs the
  customer's account email and approximate run window. Apply, playback verification, deployment, and
  controlled paid production proof remain explicitly outside this local implementation authority.
- Durable retry restore now uses migration 221's projection-only `remux_recovery` field. Canonical
  recovery/storage authority remains in `ai_generations.metadata`; the projection contains only the
  non-secret state required to reconstruct the deterministic failed-video retry card.

## Second-Pass Re-Audit Issue Register — 2026-07-10

This register is the source of truth for the reopened local remediation lane. Work it in order,
validate each issue at its owning boundary, and do not treat earlier passing tests as proof for an
uncovered failure mode.

1. **Resolved locally — durable original-video staging and submit readiness.** URL-only video references can
   become ready with staged audio but no durable original-video storage path. Stage the original
   video through the canonical Voice Changer source-video authority before enabling Generate.
2. **Resolved locally — async source replacement safety.** A delayed video duration result can overwrite a newer
   source after the request-id check. Every awaited result must revalidate request/source identity at
   the state-commit boundary.
3. **Resolved locally — durable remux projection convergence.** Retry metadata now creates or repairs
   the disposable projection from user-scoped generation/publication authority. Existing derivatives
   are reused from their canonical publication even when projection is absent, with a freshly signed
   delivery URL and explicit video identity.
4. **Resolved locally — post-settlement outcome integrity.** Metadata/projection convergence failures
   after paid audio or sibling-video persistence are logged without hiding durable output success,
   and retry reuse/persistence cannot be misclassified as a failed remux solely by a terminal patch.
5. **Resolved locally — recovery command execution and terminal metadata.** The CLI now loads the
   frontend environment before dynamically importing env-capturing server modules, remains dry-run
   by default, and clears stale failure code/stage fields after successful recovery.
6. **Resolved locally — retry operational safety.** The authenticated no-charge ffmpeg route now has
   a user-keyed admission limit, records terminal-success video lifecycle proof, emits identifiers
   plus failure stage/code in structured logs, and restores the persisted derivative MIME type.
7. **Resolved locally — pending-state recovery.** Hydration now converts a projection that has stayed
   pending for ten minutes into one retryable failed remux card; fresh synchronous work remains
   non-retryable, and no background queue or duplicate recovery authority was added.
8. **Resolved locally — UI identity fidelity.** Video intake now shows the original filename beside
   a `Video source` label, retry success preserves prompt/title/aspect without synthetic copy, and
   generation replay metadata retains the original aspect across projection repair and reload.
9. **Resolved locally — canonical video authority validation.** Before billing, the original input
   must be in the owned Voice Changer source-video namespace and its stored bytes must verify as
   supported video; client MIME declarations no longer override detected media authority.
10. **Resolved locally; hosted proof pending — schema and release proof.** The full schema snapshot,
    security/API/migration docs, and hosted checker are aligned; the DB-backed gate now verifies
    migration 019's unique index. Migration 221 apply and hosted readback remain pre-deploy boundaries.
11. **Resolved locally — focused regression coverage.** Direct coverage now proves the source race,
    URL staging, missing projection repair, post-settlement integrity, existing/stale derivative
    convergence, WebM reuse, retry admission/lifecycle/logging, pending recovery, CLI environment
    loading, retry aspect/copy, schema contracts, and visible source identity.

Protected behavior for every issue: video input still produces paid converted audio plus a sibling
video; remux failure preserves the audio; remux-only retry performs no provider generation or credit
mutation; poster video identity remains visible; global Reference Grid authority, private user-scoped
storage, desktop UX, and existing pricing remain unchanged.

Local stop condition: all register rows are implemented and pass focused plus aggregate local proof,
or the next correct step requires a material product/billing/security/persistence decision or a
commit, push, deploy, hosted migration apply, paid production run, or customer-account mutation.

## Closeout Re-Audit Issue Register — 2026-07-10

This register records the final bounded local closeout batch. All five rows are resolved locally:

1. **Resolved locally — recovery inspection safety.** Dry-run derivative inspection is read-only:
   it does not repair publications, promote generation status, update projections, reclaim rows, or
   remove storage. Apply mode verifies both recovery inputs before enabling mutation or reclaim.
2. **Resolved locally — self-contained failed-remux authority.** A failed-remux convergence write
   carries the generated-audio storage path and deterministic remux request id even if the earlier
   post-audio metadata write failed.
3. **Resolved locally — exclusive retry-card authority.** Projected recovery metadata is transferred
   to the synthetic failed-video card and removed from the successful audio card, leaving exactly one
   no-charge `Retry video` action after refresh.
4. **Resolved locally — asynchronous Reference Grid selection safety.** A newer source selection,
   removal, recording intent, or component unmount invalidates delayed internal-reference resolution
   so stale work cannot overwrite or repopulate the active source.
5. **Resolved locally — route documentation parity.** The route map describes both prepared-upload
   finalization and canonical copying of caller-owned durable/trusted video references.

Closeout proof: seven focused suites pass (152 tests); touched-file type-check and lint, full docs
checks, and `git diff --check` pass. Shared ElevenLabs post-capture persistence semantics and broad
upload-orphan cleanup remain separate owner boundaries. Hosted migration, deployment, customer
recovery, production playback/billing proof, commit, and push remain outside this local batch.

## Objective And Ownership

- Objective: restore the documented video-derived Voice Changer contract, recover the confirmed
  owner test output and affected customer output when source objects remain available, and make the
  drop-zone preview accurately retain video identity throughout extraction and generation.
- Owner/lane: AI Studio `Sound -> Voice -> Voice Changer`, with the authenticated ElevenLabs route,
  media persistence, and account-scoped recovery command as supporting boundaries.
- Execution authority: the confirmed production failure and this active Program 4 plan.
- Stop condition: the product fix has fresh production proof, recovery has reached a decision-grade
  result for each identified account, and no remaining step is merely adjacent cleanup or polish.

## Problem Statement

Voice Changer promises two outputs when its source is a video: converted audio and a sibling video
with that audio remuxed onto the original visuals. A production run on 2026-07-10 proved that the
current client can erase the original-video provenance before submit and receive HTTP `200` with
audio only. The server then sees an ordinary audio request and never attempts remuxing.

The provenance loss is caused by an overloaded state callback, not by ElevenLabs. After video audio
is extracted, `VoiceChangerAudioSourcePreview` resolves duration and sends the ready source through
the selection callback again. `useVoiceChangerSourceController` rebuilds that same source as a new
audio selection and unconditionally resets `extractedFrom` to `null`. The generation request then
omits every `originalVideo*` field. The waveform shown for the extracted-video source is therefore
both a UX defect and the trigger that exposes the runtime defect.

The route also retains a second independent defect: if remuxing is requested but ffmpeg or video
persistence fails, it logs the error and still returns unqualified audio-only success. Both failure
classes must be fixed.

The affected customer's prior video may or may not still be recoverable. Recovery is useful, but it
must not delay the product fix or require another paid ElevenLabs conversion when the converted audio
already exists.

## Done State

This lane is complete only when all of the following are true:

1. The affected account has either:
   - a recovered remuxed video attached to the correct account/project, or
   - a decision-grade record that the required source video or converted audio no longer exists and
     recovery is closed without further churn.
2. A video-derived Voice Changer request explicitly declares that a remux is expected and cannot
   silently lose original-video provenance before submit.
3. The API returns a structured remux outcome for every video-derived request.
4. The UI shows both outputs on success and a clear partial-success state when audio succeeds but
   video assembly fails.
5. A video-derived source shows its poster thumbnail during upload, extraction, and ready state; it
   never renders the audio waveform or audio play control merely because its processing asset is WAV.
6. Source selection and source metadata updates use separate authorities, so resolving duration or a
   poster cannot restart intake or erase `extractedFrom`.
7. A failed remux never forces a second ElevenLabs conversion or duplicate credit debit merely to
   retry video assembly.
8. Local tests cover the client contract, route behavior, real remux helper, persistence metadata,
   and no-double-charge boundary.
9. Production proof confirms a controlled video-derived run creates two account-owned outputs, or
   reports a visible partial success with a safe recovery path.

## Scope

### In scope

- One bounded, read-only trace of the affected account and incident window.
- Recovery of the existing output when both original video and converted audio remain available.
- Separation of source selection from duration/poster metadata updates.
- Video poster capture, Reference Grid poster reuse, loading overlay, and neutral video fallback.
- Voice Changer video provenance from intake through final multipart submission.
- Server remux outcome, logging, generation metadata, and sibling-video persistence.
- Client Reference Grid output and partial-success presentation.
- A remux-only retry/recovery path that reuses already generated audio and does not call ElevenLabs.
- Focused documentation, tests, and production proof.

### Out of scope

- Changing Voice Changer models, voice settings, pricing, or debit calculations.
- Lip Sync or general video-generation changes.
- Broad Media Library, storage-cleanup, or voice-source-retention work.
- Mobile-specific layout work.
- Credit adjustments or refunds unless separately authorized from account evidence.
- Deleting source, generated, or customer media during recovery.

## Sources Of Truth

- Product behavior: `docs/adr/0057-voice-changer-canonical-staged-audio-intake.md`
- Workflow SOP: `docs/sops/sop_ai_studio_index.md`
- Intake/provenance:
  - `frontend/features/ai-studio/logic/voiceChangerSourceTypes.ts`
  - `frontend/features/ai-studio/logic/voiceChangerSourceIntake.ts`
  - `frontend/features/ai-studio/hooks/useVoiceChangerSourceController.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`
- Source preview:
  - `frontend/features/ai-studio/components/VoiceChangerSourceDropzone.tsx`
  - `frontend/features/ai-studio/logic/videoPreviewMetadata.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
  - `frontend/features/ai-studio/components/ReferenceGridCard.tsx`
  - `frontend/styles/ai-studio-voices-properties.module.css`
- Final route: `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- Remux/persistence helpers: `frontend/lib/server/elevenlabs.ts`
- Durable output projection: `frontend/lib/server/api/generationProjection.ts`
- Planned canonical additions:
  - shared server service: `frontend/lib/server/voiceChangerRemux.ts`
  - authenticated retry route: `frontend/pages/api/media/voice-changer-remux.ts`
  - bounded recovery CLI: `scripts/recover_voice_changer_video.ts`
- Customer-owned production evidence:
  - `ai_generations`
  - `generation_outputs`
  - `media_files`
  - `voice_source_lifecycle`
  - `app_error_logs`
  - private `media_library` object paths

## Confirmed Production Evidence

Freshness: 2026-07-10, production URL and production admin generation trace.

- The user-supplied screenshot shows a video-derived source as an interactive audio waveform and only
  one audio result in the Reference Grid.
- Production received `POST /api/elevenlabs/speech-to-speech` at 12:50:07 MST and returned `200`.
- Generation `417a3c67-2c36-4a29-b703-ab2f716137dd` completed as ElevenLabs audio at
  `2026-07-10T19:50:17Z`, debited two credits, and produced no sibling video generation.
- Its saved workflow reload contains the extracted WAV source and `extractedFrom: null`. This proves
  the original-video provenance was already gone before final submit.
- No matching `elevenlabs-speech-to-speech-remux` error appeared in the production error queue. That
  is consistent with the route never receiving `originalVideoStoragePath` or
  `originalVideoSourceUrl`, rather than ffmpeg attempting and failing this run.
- The generated WAV and audio output are identified. The corresponding original-video path should be
  recoverable from the same account's `voice_source_lifecycle` staged-video row or bounded storage
  prefix, but that source-object lookup remains unproven until implementation gains the account-scoped
  recovery query.

Local baseline on the current dirty production worktree: four owning suites passed, 123 tests total.
These tests do not cover the proven duration-update provenance loss.

## Approaches Considered

### Approach A — Poster-only render patch

- Change the dropzone to render a video poster when `extractedFrom` exists.
- Benefit: smallest visible diff and stops the waveform from mounting in the common video path.
- Risk: runtime correctness would depend on a display branch. Any future duration resolver or metadata
  update using `onSourceChange` could erase provenance again.
- Verdict: rejected as a workaround; it fixes the screenshot but not the state-authority defect.

### Approach B — Preserve `extractedFrom` inside the overloaded selection callback

- Detect same-id ready-source updates in `useVoiceChangerSourceController` and merge duration while
  preserving provenance, then add poster rendering.
- Benefit: relatively small and directly prevents the confirmed loss.
- Risk: selection, replacement, async intake, and metadata mutation remain one ambiguous API. The
  special case can regress when poster, duration, restore, or reference metadata changes later.
- Verdict: acceptable emergency containment, but not the canonical final design.

### Approach C — Separate processing authority, display origin, and metadata updates

- Keep `kind` as the provider-processing asset (`audio` after extraction).
- Add explicit display-origin/poster authority for the original video.
- Split new-source selection from duration/poster metadata updates so metadata cannot restart intake.
- Carry an explicit `expectsRemux` contract to the server, fail before charge if required provenance is
  missing, and return an explicit remux outcome after charge.
- Benefit: fixes the root cause, the screenshot, silent partial success, recovery evidence, and future
  state drift without creating a parallel media pipeline.
- Risk: touches the source model, controller, panel/dropzone props, Reference Grid resolver, final
  request/route contract, and tests. The current pricing-policy edits in
  `useAiStudioAudioGeneration.ts` must be preserved during implementation.
- Verdict: recommended. Use Approach B's same-id preservation only as defense-in-depth, not as the
  primary authority model.

### Approach D — Background remux queue

- Persist a pending job and remux asynchronously after the audio route returns.
- Benefit: isolates ffmpeg latency from the provider request and can support broad automated retry.
- Risk: introduces a new queue/worker authority, delivery state machine, and operational surface for
  a bounded defect whose canonical path already performs synchronous remuxing.
- Verdict: rejected for this incident. A server-owned pending/succeeded/failed state and idempotent
  retry route provide the required durability without creating a parallel processing system. Revisit
  only if measured production remux latency or volume makes synchronous assembly untenable.

## Recommended Design

1. `VoiceChangerSource.kind` remains the active processing media kind.
2. Add explicit top-level display authority to the source model:
   - `displayKind: "audio" | "video"` records the intake origin and does not change after extraction;
   - `posterUrl: string | null` holds the non-playable display poster;
   - `previewUrl` remains the playable source URL and must not double as poster authority.
3. Keep remux authority in `extractedFrom`; display fields must never replace storage path, trusted
   URL, or ownership authority used for remux.
4. Introduce a metadata-only controller action for duration/poster resolution. The dropzone must not
   call the source-selection action to update duration.
5. Capture a local video poster with `loadVideoPreviewMetadata()` before the owned blob URL can be
   revoked. Reuse `StudioOutput.previewPosterUrl` for Reference Grid videos when available.
6. Protect async poster/aspect/duration results with the existing request id and source id so video A
   cannot overwrite video B.
7. Render the poster for video-origin sources in every status. Upload/extraction progress becomes an
   overlay; poster failure renders a neutral video placeholder. Only genuine audio-origin sources
   mount `VoiceChangerAudioSourcePreview`.
8. Send `expectsRemux=true` plus user-scoped original-video authority for every video-origin run.
   Treat the client flag as an assertion, not the server's sole authority: a source under the
   canonical `voice-changer/staged-audio/` path is itself video-derived and requires remux. Reject any
   disagreement or missing durable source-video authority before billing or ElevenLabs. If intake has
   only a transient/signed URL, stage the original video into the user's canonical `source-video`
   storage before enabling Generate so retry never depends on an expired URL.
9. Persist recoverable audio-generation metadata before remux begins: `expects_remux`,
   `remux_status=pending`, original-video storage path/name/MIME/aspect, and a deterministic remux
   identity. Patch it to `succeeded` or `failed` after the attempt. Lifecycle rows remain useful
   diagnostics but are not the only retry authority.
10. Return a required structured `remuxOutcome` containing status
    (`not_requested | succeeded | failed`), stable code, failure stage, retryable flag,
    customer-safe message, and audio generation id. Preserve audio on post-charge remux failure, but
    never present the response as unqualified complete success.
11. Extract one shared remux/persistence service and call it from both the normal route and an
    authenticated, no-charge `POST /api/media/voice-changer-remux` route. The retry route accepts only
    `sourceAudioGenerationId`; the server derives and verifies both input paths from owned generation
    metadata. Do not create a second remux implementation or accept raw client storage paths.

## Concrete Implementation Map

| Boundary          | Owning change                                               | Required invariant                                                                                                                   |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Source model      | `voiceChangerSourceTypes.ts`, `voiceChangerSourceIntake.ts` | `kind` is processing media; `displayKind` is immutable intake origin; `posterUrl` is display-only.                                   |
| Source state      | `useVoiceChangerSourceController.ts`                        | Selection/replacement and metadata updates are separate actions; same-id defense preserves provenance.                               |
| Dropzone          | `VoiceChangerSourceDropzone.tsx` and voices CSS             | Video-origin sources render poster/placeholder plus progress overlay and never mount audio waveform controls.                        |
| Reference intake  | `useAiStudioPageMediaReferenceRuntime.ts`                   | Existing `previewPosterUrl` becomes `posterUrl`; durable video storage authority remains separate.                                   |
| Submission/output | `useAiStudioAudioGeneration.ts`                             | Video-origin submit asserts remux, consumes one required outcome, and converges success/failure into the global Reference Grid.      |
| Provider route    | `speech-to-speech.ts`                                       | Server infers expected remux, validates durable provenance before charge, persists pending authority, then returns explicit outcome. |
| Remux service     | new `frontend/lib/server/voiceChangerRemux.ts`              | One ownership-scoped, idempotent assembly/persistence implementation is shared by generation, retry, and recovery.                   |
| Retry route       | new `frontend/pages/api/media/voice-changer-remux.ts`       | Accepts only the audio generation id, derives inputs server-side, and imports no provider or billing execution.                      |
| Durable restore   | `generationProjection.ts` plus `StudioOutput` mapping       | Failed/pending remux metadata rehydrates the same deterministic retry state after refresh or project restore.                        |
| Recovery CLI      | new `scripts/recover_voice_changer_video.ts`                | Dry-run default; explicit `--apply`; same service and ownership checks as the product route.                                         |

The successful API response has one remux authority. Replace the optional top-level
`remuxedVideo` branch with:

```ts
remuxOutcome: {
  status: "not_requested" | "succeeded" | "failed";
  code: string | null;
  stage: "validation" | "assembly" | "persistence" | null;
  retryable: boolean;
  message: string | null;
  audioGenerationId: string;
  remuxRequestId: string | null;
  video: PersistedVoiceChangerVideoPayload | null;
}
```

`not_requested` is mandatory for genuine audio input, `succeeded` must contain `video`, and `failed`
must have `video=null` plus a stable code/stage. Do not retain both `remuxedVideo` and
`remuxOutcome.video` as competing response fields. Pre-charge provenance rejection remains a normal
non-2xx route error and does not create audio or remux output.

`StudioOutput` gains one optional, non-secret retry contract:

```ts
remuxRecovery?: {
  sourceAudioGenerationId: string;
  remuxRequestId: string;
  status: "pending" | "failed";
  code: string | null;
  stage: "assembly" | "persistence" | null;
  retryable: boolean;
}
```

It must never contain source storage paths or signed URLs. The deterministic failed-video output id
is derived from `sourceAudioGenerationId`, allowing immediate response handling and durable restore
to converge on one card rather than duplicate it.

## Execution Plan

### Phase 0 — Identify The Affected Run

The owner test run is already identified by generation id and timestamp above. First perform the
same bounded source lookup for it; this proves the recovery query before any customer mutation.
Required customer input remains the customer's ShortPulse account email and approximate run
date/time.

1. Resolve the account to its authenticated user id through the existing admin authority.
2. Query only that account and a bounded incident window for:
   - Voice Changer audio generations,
   - sibling `voice_changer_remuxed_video` generations,
   - `elevenlabs-speech-to-speech-remux` errors,
   - source-video and staged-audio lifecycle rows,
   - generation outputs and `media_files` ownership.
3. Correlate by generation id, request/source reference, provider request id, project id, timestamps,
   and storage paths.
4. Classify the run:
   - `already_has_video`: video exists but was not visible to the customer;
   - `recoverable`: original video and converted audio both remain available;
   - `provenance_lost`: audio exists, but the original-video link was not recorded;
   - `asset_lost`: one or both required objects no longer exist;
   - `no_matching_run`: the supplied account/window has no decision-grade match.

Stop recovery immediately for `asset_lost` or `no_matching_run`. Do not broaden into unrelated
accounts or unbounded storage searches.

### Phase 1 — Recover The Existing Customer Video When Possible

1. If `already_has_video`, repair only its account/project association or visibility projection using
   the canonical output-convergence path; do not regenerate media.
2. If `recoverable`, add a bounded recovery command that:
   - defaults to dry-run;
   - requires explicit user id, audio generation id, and original video path;
   - verifies both objects are owned by the same account;
   - imports the existing remux and generated-video persistence helpers;
   - never calls ElevenLabs or reserves/debits credits;
   - preserves project/workspace association from the audio generation;
   - records `derivative_kind=voice_changer_remuxed_video` and the source audio generation id;
   - is idempotent and refuses to create a duplicate sibling video.
3. Run dry-run evidence first. Apply only after the exact account, objects, destination, and
   no-charge behavior are proven.
4. Verify the new video row, output projection, account/project association, storage object, and
   signed playback URL.
5. Keep the source audio and video unchanged.

The command and product retry route must call the same app-owned remux service. The command exists for
incident recovery and dry-run inspection; it must not become a second product processing path.
Its canonical invocation is:

```bash
cd frontend
npx tsx ../scripts/recover_voice_changer_video.ts \
  --user-id <user-id> \
  --audio-generation-id <generation-id> \
  --original-video-path <user-scoped-path>
```

Only an additional explicit `--apply` may mutate the account. The dry run prints ownership,
input-object existence, duplicate derivative status, destination project/workspace, and expected
request identity without downloading or remuxing media.

If recovery is impossible, close this phase with the precise missing evidence or object. The product
fix continues regardless.

### Phase 2 — Separate Selection From Metadata And Preserve Provenance

1. Add a metadata-only update action for duration, poster, and resolved aspect.
2. Change `VoiceChangerSourceDropzone` duration resolution to use that action instead of
   `onSourceChange`.
3. Keep `onSourceChange` exclusively for selecting, replacing, restoring, or clearing a source.
4. Add same-id merge protection in the controller so a metadata-shaped source update cannot erase
   `extractedFrom` even if an older caller reaches the selection boundary.
5. Add required `displayKind` and nullable `posterUrl` fields without changing the
   provider-processing `kind` semantics.
6. Verify replace/remove/unmount still revoke each owned blob URL exactly once.

### Phase 3 — Render The Correct Video Poster State

1. Start local poster capture from the original local video URL before upload/extraction can replace
   the source and revoke that URL.
2. Keep the owned source object URL alive until poster capture settles or the source is
   replaced/removed. Carry the captured poster through extracting and ready states without putting
   it into workflow reload or project persistence payloads.
3. Reuse `output.previewPosterUrl` for Reference Grid video sources; use a locally captured poster only
   when durable poster authority is unavailable and the video bytes are locally readable.
4. Render poster `<img>` for video-origin sources and waveform/audio controls only for audio-origin
   sources.
5. Convert the loading preview into an overlay above the poster instead of replacing it.
6. Render a neutral video placeholder when poster capture fails.
7. Keep the original filename plus a `Video source` label visible after extraction.

### Phase 4 — Make Remux Expected And Fail Closed Before Charge

1. Add `expectsRemux=true` to video-origin client submissions.
2. Infer expected remux on the server whenever the staged audio path is under
   `voice-changer/staged-audio/`; require the client assertion to agree. This server-owned intake path
   prevents a future client-state regression from silently downgrading video to audio.
3. Require a durable, trusted, user-scoped original-video storage path plus its name and MIME type
   before provider generation begins. Stage URL-only video inputs first rather than relying on an
   expiring signed URL for recovery.
4. Reject incomplete or contradictory provenance before charging or calling ElevenLabs.
5. Keep genuine audio-only Voice Changer requests unchanged.

### Phase 5 — Replace Silent Success With An Explicit Remux Outcome

1. Persist the audio generation with `remux_status=pending`, expected-remux state, original-video
   authority, and deterministic remux identity before invoking remux.
2. Return a structured remux result for every request:
   - `not_requested` for audio sources;
   - `succeeded` with the sibling video payload;
   - `failed` with a stable code, failure stage, retryable flag, customer-safe message, and audio
     generation id.
3. Keep the converted audio available when remuxing fails; do not turn an already charged successful
   audio conversion into a generic total failure.
4. Patch the authoritative audio-generation metadata to `succeeded` or `failed`, and mirror the
   outcome into voice-source lifecycle metadata for diagnostics.
5. Log remux failures with account, request, audio generation, project, source class, and failure
   stage, without exposing signed URLs or raw object paths in customer-visible messages.
6. Do not mark the video lifecycle `terminal_success` when the requested remux was not persisted.
7. Keep `ai_generations.metadata` as recovery authority and project only non-secret retry state into
   `generation_projection.remux_recovery` through migration 221. Continue to rely on the existing
   unique `(user_id, request_id)` index; before implementation closeout, verify migration 019 is
   applied in the target environment. If it is absent, stop at the database-apply authority boundary
   rather than weakening idempotency in application code.

### Phase 6 — Give The Customer A Visible, No-Double-Charge Recovery Path

1. Preserve the existing one-slot submission rule and one audio placeholder. Do not make a second
   free Reference Grid slot a prerequisite for starting a video-derived Voice Changer run.
2. Materialize the sibling video card from the required remux outcome: insert the persisted video on
   success or a failed video state on partial success. Capacity reconciliation must follow the
   existing convergence behavior instead of silently dropping the sibling.
3. Keep the audio card successful when remux fails and show plain-language partial-success guidance.
4. Expose a dedicated `Retry video` action on the failed video state. Do not reuse Re-roll, because
   Re-roll enters the paid provider-generation path.
5. The retry path must:
   - authenticate the caller;
   - accept only `sourceAudioGenerationId` and derive both inputs from server-owned metadata;
   - verify ownership of both inputs;
   - call shared remux/persistence code rather than the ElevenLabs route;
   - perform no credit reservation or debit;
   - use deterministic request identity `voice-changer-remux:<audioGenerationId>`;
   - pre-read an existing derivative and return it on retry or concurrent unique-index conflict;
   - clean up an uploaded orphan if storage succeeds but the generation insert loses a race.
6. Carry retry metadata and its handler through `StudioOutput`, `ReferenceGrid`, and
   `ReferenceGridCard`; do not expose raw storage authority to the browser.
7. Extend generation projection/restore mapping so an audio generation with `remux_status=failed` or
   `pending` reconstructs the same deterministic video retry card after refresh. A succeeded sibling
   suppresses that synthetic state and remains the only video output.

### Phase 7 — Tests And Documentation

Required automated proof:

- Video intake preserves `extractedFrom` provenance.
- Duration resolution cannot re-enter intake or clear `extractedFrom`.
- Local video shows a poster during upload, extraction, and ready state.
- Extracted-video sources never mount waveform bars or the audio-preview play button.
- Genuine audio sources retain the interactive waveform and duration resolution.
- Reference Grid video sources prefer their existing `previewPosterUrl`.
- Poster failure renders the neutral video placeholder.
- Replacing video A with video B prevents A's late poster/aspect/duration result from updating B.
- Owned blob URLs are revoked exactly once and captured posters are not persisted into workflow reload.
- Client submits `expectsRemux` and all required original-video fields.
- Server infers remux from the canonical staged-audio path and rejects a contradictory client flag.
- URL-only original videos are durably staged before Generate becomes available.
- Missing expected provenance fails before billing/provider work.
- Successful remux returns and inserts the sibling video.
- Remux helper or persistence failure returns explicit partial success.
- The response exposes only `remuxOutcome.video`; the retired `remuxedVideo` field is absent.
- Audio generation metadata transitions from `pending` to `succeeded` or `failed` and retains the
  server-owned recovery authority.
- Remux-only retry does not call ElevenLabs or billing functions.
- Retry is ownership-scoped and duplicate-safe.
- Concurrent retries converge on one sibling generation and clean up any upload-before-insert orphan.
- A video-derived run still starts with only one free Reference Grid slot and materializes its sibling
  through the existing convergence/capacity policy.
- Refresh/project restore reconstructs one failed retry card from audio-generation metadata, and a
  persisted sibling suppresses it without duplicating outputs.
- Lifecycle state distinguishes remux success from remux failure.
- A direct test executes the vendored ffmpeg remux helper with a small fixture and validates a
  playable output containing video and audio streams.

Update:

- `README.md`
- `docs/routes.md` if a remux-only route is added
- `docs/sops/sop_ai_studio_index.md`
- `docs/troubleshooting.md`
- ADR 0057 to record the explicit outcome and no-charge retry contract while preserving its existing
  two-output decision

### Phase 8 — Production Proof And Closeout

1. Deploy only after targeted tests, lint for touched files, type/build validation, and docs checks
   pass.
2. Confirm the production Voice Changer UI shows the video poster, original filename, and `Video
source` identity without a waveform after extraction.
3. With explicit approval for a controlled paid run, use an owner-controlled account and a small
   supported video to verify:
   - one Voice Changer debit;
   - one converted audio output;
   - one remuxed video output;
   - correct account/project association;
   - playable signed media;
   - successful remux metadata and no fresh remux error.
4. Exercise the remux-only retry through a controlled forced remux failure or test fixture without a
   second ElevenLabs call or debit.
5. Verify the affected customer's recovered video when recovery was possible.
6. Recover or decision-grade close the confirmed owner test run as well as the customer run.
7. Close only when production evidence is fresh and account-linked. Local tests alone do not prove
   the production workflow fixed.

## Validation Commands

Use focused test paths first, including:

```bash
cd frontend
npm run test -- \
  tests/api/elevenlabs-speech-to-speech-route.test.ts \
  tests/api/media-extract-audio-route.test.ts \
  features/ai-studio/logic/__tests__/voiceChangerSourceIntake.test.ts \
  features/ai-studio/utils/__tests__/voiceChangerSourceAsset.test.ts \
  features/ai-studio/components/__tests__/VoicesPropertiesPanel.test.tsx \
  features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts
```

Then run the checks required by the touched route/UI/doc surface, including `npm run lint`,
`npm run build`, and `npm run docs:check` at a meaningful checkpoint.

## Stop And Safety Rules

- Recovery inspection is read-only until a specific account-owned source video and converted audio
  are proven.
- No production remux apply, customer-account mutation, paid generation, credit adjustment, deploy,
  or push occurs without the appropriate explicit authority.
- Never use another customer's media as a substitute or expand the search beyond the affected
  account.
- Do not re-run ElevenLabs merely to assemble the video.
- Do not delete or overwrite the customer's original source or converted audio.
- If source ownership, project destination, or duplicate status is uncertain, stop before apply.

## Proof Ladder

1. Confirmed production trace of provenance loss and audio-only success.
2. Static source trace: duration callback, source controller, poster lifecycle, billing boundary,
   remux, persistence, and client output paths.
3. Targeted unit/route/component tests.
4. Real local ffmpeg remux fixture test.
5. Read-only account recovery trace.
6. Dry-run recovery evidence.
7. Account-scoped recovery apply and playback verification, when recoverable and authorized.
8. Production deployment and controlled account-linked workflow proof.
