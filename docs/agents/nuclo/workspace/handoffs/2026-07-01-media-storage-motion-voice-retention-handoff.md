# Nuclo Handoff: Media Storage Motion Reference And Voice Source Retention

Date: 2026-07-01
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch policy: pre-launch `production` only
Primary lane: Nuclo / Supabase hosted storage lifecycle
Adjacent review lane: Dave / security and destructive-data guard

## Goal

Build the missing retention and proof machinery needed before ShortPulse can safely clean up two manual-review storage classes in production:

- Motion Control reference objects: 57 objects, 342.840 MB in `media_library/transient_motion_reference`.
- Voice source objects: 45 objects, 54.717 MB across `media_library/voice_changer_source_audio` and `media_library/voice_clone_source_audio`.

The goal is not to delete these files immediately. The goal is to make the repo and production schema capable of proving which objects are still needed, which are retired, and which can later become bounded cleanup candidates.

## Source Of Truth

Current repo anchors:

- `docs/adr/0098-media-storage-lifecycle-stewardship.md`
- `sql/check_media_storage_cleanup_manifest.sql`
- `sql/check_storage_object_egress_risk_breakdown.sql`
- `sql/migrations/173_add_media_storage_lifecycle_diagnostics.sql`
- `frontend/pages/api/media/stage-motion-reference-video.ts`
- `frontend/pages/api/media/prepare-motion-reference-video-upload.ts`
- `frontend/pages/api/media/prepare-voice-changer-source-upload.ts`
- `frontend/pages/api/media/stage-voice-changer-source.ts`
- `frontend/pages/api/media/stage-voice-clone-source.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- `frontend/pages/api/elevenlabs/voices/clone.ts`
- `frontend/lib/server/mediaLibraryDeleteService.ts`
- `docs/adr/0086-motion-reference-video-lease-cleanup.md`
- `docs/adr/0080-custom-voice-ownership-authority.md`

Live audit source:

- Production Supabase project `ftgrqgjrchpimronuhop`.
- Read-only SQL over transaction pooler on 2026-07-01.
- Evidence was aggregate-only. Do not paste raw object paths or user ids into chat, docs, or tracked reports.

## What The Live Audit Found

Production schema check:

- `public.motion_reference_video_generation_leases`: absent.
- `public.motion_reference_video_retirements`: absent.
- `public.user_owned_custom_voices`: present.
- `storage.objects`: present.

Aggregate storage findings:

| Class                                      | Action today       | Objects |      MB | Reason                                                                                                                     |
| ------------------------------------------ | ------------------ | ------: | ------: | -------------------------------------------------------------------------------------------------------------------------- |
| `media_library/transient_motion_reference` | Manual review only |      57 | 342.840 | Production lacks motion lease/retirement proof tables, so cleanup cannot prove no active generation depends on the object. |
| `media_library/voice_changer_source_audio` | Manual review only |      18 |  46.402 | Voice source retention policy is not explicit enough to delete.                                                            |
| `media_library/voice_clone_source_audio`   | Manual review only |      27 |   8.315 | Voice clone sources may be upstream/provider ownership evidence or source material; retention policy must be explicit.     |

Nearby but not this handoff's primary scope:

- One `media_library/transient_image_reference` object, 0.271 MB, is already a delete candidate.
- Dashboard tutorial thumbnail bucket has 12 unreferenced objects, 51.429 MB. That is admin/product-owned, not user-owned, and should be handled by a separate tutorial-assets cleanup lane.

## Why This Is Blocked Today

Motion references are not safely deletable because production is missing the tables that would prove whether a stored Motion Control clip was:

- leased by an in-flight or completed generation,
- released after provider submit settled,
- superseded by replacement,
- retired after a successful replacement/clear,
- or still active in an unresolved workflow.

Voice source objects are not safely deletable because the product contract has not decided how long source audio should be retained for:

- Voice Changer generated outputs,
- remuxed video/audio workflows,
- Voice Clone source samples,
- custom voice ownership evidence,
- user review/retry flows,
- provider rollback/dispute/audit needs.

## Approved Scope For Next Agent

The next agent may plan and implement repo/schema/app changes that create proof and retention policy for these classes.

In scope:

- Audit the current write paths for Motion Control references and voice source uploads.
- Add or repair migrations needed for lifecycle ledgers.
- Add server-side writes that register lease/retirement/retention state at the canonical source.
- Update aggregate diagnostics so manual-review classes become eligible only when proof exists.
- Add tests for lifecycle writes and diagnostics.
- Update ADR/SOP/security docs.
- Keep cleanup dry-run/report-only until a separate delete approval.

Out of scope unless the user explicitly approves in the current thread:

- Deleting production storage objects.
- Applying production migrations.
- Enabling scheduler jobs.
- Changing visible UI/UX.
- Changing billing/customer quota behavior.
- Treating voice sources as customer quota media.
- Direct SQL deletion from `storage.objects`.
- Pasting raw object paths, user ids, signed URLs, bearer tokens, or Supabase keys into tracked docs or chat.

## Recommended Build Plan

### 1. Motion Reference Lifecycle Proof

Implement or restore the production-equivalent of the motion lifecycle tables referenced by ADR 0086 and the cleanup manifest:

- `motion_reference_video_generation_leases`
- `motion_reference_video_retirements`

Required table semantics:

- Leases must record user id, storage path, generation/request/source identity, created time, and release state.
- A stored motion-reference object must not become cleanup-eligible while any active lease exists.
- Replacing or clearing a motion clip should write a retirement record, not delete the file immediately.
- Retirement should only become cleanup-eligible after TTL and after no active lease remains.
- The route that finalizes or clears Motion Control clips should be the canonical writer. Avoid route-local cleanup shortcuts.

Validation:

- Unit/API tests proving submit leases a motion reference when used for generation.
- Tests proving successful settlement or explicit release clears the active lease.
- Tests proving replacement/clear creates a retirement record.
- SQL diagnostic tests or hosted dry-run proof showing motion references move from `manual_review_required` to `delete_candidate` only when retirement + no-active-lease + TTL are all true.

### 2. Voice Source Retention Policy

Decide and document separate policy for:

- Voice Changer source audio/video intake.
- Voice Clone source audio.
- Custom voice sample audio stored as `user_owned_custom_voices.sample_storage_path`.

Recommended starting posture:

- Custom voice samples referenced by `user_owned_custom_voices.sample_storage_path` stay protected.
- Voice Clone source audio not referenced by a custom voice ownership row should get a longer retention window than generic staged upload, because it can matter for provider ownership/debug proof.
- Voice Changer source audio/video should get a bounded retention window after generated output persistence and projection are complete, but should stay protected while any generation using it is unresolved.

Likely implementation shape:

- Add a `media_source_lifecycle_events` or narrower `voice_source_lifecycle` table only if existing generation/projection rows cannot prove lifecycle state cleanly.
- Prefer linking source objects to generation identity and terminal settlement state rather than path heuristics alone.
- Add explicit `retention_until` or `eligible_after` timestamps for source objects whose workflow is terminal.
- Keep ambiguous or legacy voice sources in manual review until backfilled with confidence.

Validation:

- Tests proving Voice Changer source paths are registered when staged/finalized.
- Tests proving Voice Changer source paths are protected while generation is active or unresolved.
- Tests proving terminal successful/failed/abandoned workflows produce explicit retention state.
- Tests proving custom voice sample paths remain protected by `user_owned_custom_voices`.
- SQL dry-run output showing old, terminal, unreferenced voice source objects can be reported as candidates without exposing raw paths.

### 3. Diagnostics And Dry-Run Reporting

Update:

- `sql/check_media_storage_cleanup_manifest.sql`
- `sql/migrations/173_add_media_storage_lifecycle_diagnostics.sql` or a later forward migration
- `/api/internal/media-storage-lifecycle/run`

Required diagnostic posture:

- Aggregate route responses only.
- No raw object paths or user ids.
- `delete_candidate` only when lifecycle proof exists.
- `manual_review_required` remains the fallback for missing schema, missing proof, ambiguous legacy, invalid shape, or unknown workflow class.

### 4. Deletion Lane Comes Later

After proof exists and a dry run reports candidates, stop. Actual deletion requires a new approval and a separate operator plan:

- before/after aggregate manifest,
- bounded Storage API deletion batches,
- no direct SQL deletion from `storage.objects`,
- rollback/incident plan,
- production proof after deletion.

## Suggested Stop Condition

Stop when:

- Motion references have durable lease/retirement proof and diagnostics classify them correctly.
- Voice source retention policy is explicit and implemented at the canonical write paths.
- Dry-run diagnostics can report eligible candidates without exposing raw paths or user ids.
- Tests and docs pass.

Do not proceed into production migration apply, scheduler enablement, or object deletion without fresh user approval.

## Proof Requirements For Completion

Minimum local proof:

- Targeted API/unit tests for each touched route/service.
- `npm -C frontend run type-check:touched -- --path <touched frontend files>`.
- `npm -C frontend run docs:check`.
- `git diff --check`.

Minimum hosted proof before any future cleanup approval:

- Production schema parity confirms required lifecycle tables/functions exist.
- Aggregate dry-run output shows candidates by class/action/count/MB only.
- Security audit confirms lifecycle RPCs are service-role-only.
- No raw paths, signed URLs, user ids, or secrets are present in tracked artifacts.

## Current Known Risks

- Production currently lacks motion lifecycle tables, so any motion-reference delete would be unsafe.
- Voice source semantics may cross user trust, provider ownership, and support/debug needs; Dave should review before any retention policy is used for deletion.
- Existing legacy objects may never be confidently classifiable without conservative manual review or a one-time user/operator review process.
- The production credentials pasted in the originating thread should be treated as exposed and rotated before scheduling any production worker or enabling new production secrets.
