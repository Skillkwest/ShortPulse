# Media Storage Save Blocking

Purpose: define the source-of-truth product and implementation contract for how ShortPulse blocks new media saves when a user's canonical media storage entitlement is exhausted.

## Status

Active source of truth for storage-full save blocking preparation and implementation.

## Update triggers

- Any change to user-facing storage-full copy, CTA targets, or blocking behavior.
- Any new canonical media write lane.
- Any change to AI Studio save-state modeling or generated-output publication semantics.
- Any change to quota authority (`get_media_storage_quota_summary()`, `enforce_media_storage_quota()`, or related billing entitlement resolution).

## Scope

In scope:

- Manual Media Library uploads.
- Manual AI Studio saves into the Media Library.
- AI Studio autosave attempts.
- Direct-response generation autosave lanes that persist canonical `media_files` rows server-side.
- Recovery/replay persistence lanes that can create new canonical media rows.

Out of scope:

- Read/delete access for over-limit accounts.
- Raw infrastructure storage cost management for derived posters/thumbs/previews.
- Recurring storage add-on pricing/catalog decisions.

## Product contract

### 1) Blocking rule

- When canonical media storage is full, the user cannot create any new canonical `media_files` row.
- Reads, previews, downloads, and deletes remain available.
- Existing generated output remains usable in-session even if durable save is blocked.

### 2) UX rule

- ShortPulse should block proactively when the client already knows the account is over limit.
- ShortPulse must also fail closed reactively when the server/database quota guard rejects a write.
- Both proactive and reactive paths must converge on the same user-facing copy.

### 3) Canonical user-facing copy

- Headline/message:
  - `Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.`
- CTA target:
  - `/profile?section=storage`
- CTA label:
  - `Manage storage`

### 4) Surface behavior

#### Media Library upload surfaces

- If quota is known and over limit, disable upload triggers and drag/drop intake.
- Show a persistent warning banner in the upload surface with the canonical message and `Manage storage` CTA.
- If quota is unknown, allow the attempt and rely on the backend quota guard.
- If backend rejection occurs, replace generic upload failure text with the canonical message.

#### AI Studio manual save surfaces

- If quota is known and over limit, disable `Save` / `Retry Save` controls for library persistence and show the canonical message near the save control.
- Also surface the same message in the page alert stack for accessibility and persistence across panel/modal transitions.
- If backend rejection occurs, keep the output playable but mark save as blocked by storage rather than generic failure.

#### AI Studio autosave surfaces

- Autosave must never silently degrade into an indistinguishable `idle` state when storage is full.
- If autosave is blocked by storage, keep the output usable but project an explicit blocked-save state and surface the canonical message.
- Autosave storage-full messages should be warning/error UI, not only background telemetry.

#### Direct-response generation persistence

- Server-side autosave failures caused by storage-full must be projected back to the client as an explicit storage-blocked state.
- The client must not interpret storage-full autosave failures as ordinary unsaved-ready output.

## Shared implementation contract

### Shared client/server error normalization

- Keep `Media storage limit exceeded` as the canonical machine-readable classifier.
- Add one shared user-facing helper for the full storage-block message.
- Preserve both the classifier and the actionable details through every lane, including server-copy fallbacks.
- Do not maintain separate `uploading more files` vs `saving more files` strings by lane.

### Shared UI state model

- AI Studio save state should gain an explicit storage-blocked state instead of overloading `idle` or generic `failed`.
- Minimum recommended shape:
  - `saveState: "blocked_storage"` for storage-full save outcomes.
  - `saveError` retains the canonical message for detail surfaces and telemetry.
- Direct-response projection and autosave orchestration must be able to emit and preserve that state.

### Shared quota authority

- Proactive client blocking should be driven from `useMediaStorageQuotaSummary()`.
- Reactive authority remains database/server authoritative through `enforce_media_storage_quota()` and the write-lane insert failures.
- Unknown quota state must fail open on the client but fail closed on the server.

### Shared telemetry

- Keep backend failure telemetry for quota-triggered autosave rejections.
- Add a client-visible event for blocked interactions, with enough metadata to distinguish:
  - proactive client block
  - reactive server rejection
  - manual save
  - autosave
  - upload
  - direct-response generation

## Lane inventory

| Lane | Current entrypoint(s) | Preparation requirement |
| --- | --- | --- |
| Media Library upload | `frontend/lib/server/mediaUploadService.ts`, `frontend/features/media-library/hooks/useMediaUploadController.ts`, `frontend/features/media-library/components/MediaUploadStage.tsx` | Normalize quota copy, add proactive disable/banner behavior, and add UI regression coverage. |
| AI Studio manual save | `frontend/features/ai-studio/hooks/useAiStudioOutputSaveRuntime.ts`, `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`, `frontend/features/ai-studio/components/DetailModal.tsx`, `frontend/features/ai-studio/components/AiStudioPageContent.tsx` | Preserve actionable server-copy details, add local blocked-save UX, and avoid generic failure-only treatment. |
| AI Studio server-copy fallback | `frontend/pages/api/media/copy-from-url.ts`, `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts` | Preserve `details` instead of collapsing to `error` only. |
| AI Studio autosave orchestrator | `frontend/features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputSaveRuntime.ts` | Make storage-full autosave outcomes visible and distinguishable from ordinary idle outputs. |
| Direct-response OpenAI image autosave | `frontend/lib/server/openaiImageGeneration.ts` | Project storage-full autosave failure back into explicit client save state. |
| Direct-response ElevenLabs audio/video autosave | `frontend/lib/server/elevenlabs.ts` | Project storage-full autosave failure back into explicit client save state. |
| Direct terminal settlement / recovery | `frontend/lib/server/api/directGenerationSettlement.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts`, `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts` | Keep canonical output usable, but propagate blocked-save state and canonical message when quota rejects durable persistence. |

## Implementation order

1. Create shared storage-full constants/helpers for classifier, message, CTA target, and CTA label.
2. Fix message propagation across AI Studio persistence, especially the server-copy fallback path.
3. Extend AI Studio save-state modeling to represent storage-blocked outcomes explicitly.
4. Project direct-response/autosave storage-full failures into that explicit state instead of `idle`.
5. Add proactive client blocking using `quotaSummary.isOverLimit` on Media Library upload and AI Studio manual save surfaces.
6. Add localized banners/toasts plus page-level fallback alerts where required by the surface contract.
7. Add regression coverage for each lane before broad refactors.

## Acceptance checklist

### Shared behavior

- [ ] All canonical media write lanes emit one canonical storage-full message.
- [ ] All canonical media write lanes preserve read/delete access after blocking new saves.
- [ ] The app never confuses `storage full` with generic network or signed-URL failures.

### Media Library upload

- [ ] Over-limit accounts with known quota see upload controls disabled before attempting upload.
- [ ] The upload stage shows a persistent storage-full banner with `Manage storage`.
- [ ] Backend quota rejection also shows the same banner/copy when proactive state was unavailable.

### AI Studio manual save

- [ ] Over-limit accounts with known quota cannot trigger manual library save.
- [ ] The save surface shows the canonical message near the blocked action.
- [ ] The page alert stack also reflects the blocked-save state.
- [ ] Server-copy fallback preserves the same user-facing message.

### AI Studio autosave and direct-response generations

- [ ] Storage-full autosave does not remain indistinguishable from `idle`.
- [ ] Generated output remains usable in-session even when durable save is blocked.
- [ ] The output can visually communicate `not saved because storage is full`.
- [ ] Background telemetry still records the autosave failure reason.

### Validation and tests

- [ ] Media Library upload UI test covers proactive over-limit blocking.
- [ ] Media Library upload UI test covers reactive quota rejection banner.
- [ ] AI Studio manual save test covers storage-full message propagation.
- [ ] AI Studio server-copy fallback test covers `details` preservation.
- [ ] Direct-response OpenAI image test covers explicit storage-blocked projection.
- [ ] Direct-response ElevenLabs audio/video tests cover explicit storage-blocked projection.
- [ ] Recovery/direct-settlement tests cover blocked durable persistence without losing playable output.

## References

- `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
- `docs/product/billing-pricing-catalog.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `frontend/lib/mediaStorageQuota.ts`
- `frontend/features/billing/useMediaStorageQuotaSummary.ts`
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/pages/api/media/copy-from-url.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputSaveRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator.ts`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/lib/server/elevenlabs.ts`
- `frontend/lib/server/api/directGenerationSettlement.ts`
