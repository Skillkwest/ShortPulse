# AI Studio Detail Modal Reference Audit System

Status: Active audit organization system for detail-modal and reference-media checks.

Owner: Codex lane for the June 20, 2026 detail-modal reference audit.

## Purpose

This document defines how to audit every AI Studio detail-modal instance without losing the reusable pattern behind each modal. It is an operating system for the audit, not an evidence packet. Evidence from individual manual checks should live in records or planning evidence only when the check produces durable proof that needs to be retained.

The audit question is: when a user opens a detail modal for reference media, does that modal show the right preview, metadata, actions, saved state, and durable media authority for the surface, media type, origin, and entry path involved?

## Scope

In scope:

- Reference Grid detail modal behavior.
- Quick Slot Inventory detail modal behavior.
- Canvas detail modal behavior.
- Media Library detail modal behavior.
- Character panel media-service detail modal behavior.
- Elements panel media-service detail modal behavior.
- Text, image, video, and sound/audio references.
- Computer-added media and generated in-app media.
- The detail modal system, its variants, and the shared traits they should normalize.

Out of scope unless a check proves direct detail-modal impact:

- New UI redesign.
- Provider generation correctness before media reaches the reference system.
- Billing, credits, admin pricing, or unrelated model-runtime surfaces.
- Mobile-specific polish.
- Supabase image transformations as a possible solution. They remain prohibited.

## Terms

| Term          | Meaning                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Instance      | The base thing to check: surface + media type + origin. Example: Reference Grid + image + computer-added.                 |
| Entry path    | How that media reached the surface. Example: Add Files button, drag/drop, generated output save, Media Library to Canvas. |
| Modal profile | A reusable expected-behavior bundle. Multiple instances can share one profile.                                            |
| Trait         | A condition layered on top of an instance. Example: already saved, expired preview URL, missing title, video with poster. |
| Finding       | A behavior mismatch, unclear product decision, or unsupported state discovered by a check.                                |

## Modal Profiles

Use profiles first, then add surface-specific traits only where they are genuinely different.

| Profile                         | Applies To                                                                                                                    | Expected Behavior                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output-backed-detail`          | Reference Grid, Quick Slot Inventory, and Canvas items that still have a `StudioOutput` or equivalent output-backed reference | Shows the best available media preview; presents prompt/title/metadata from the output authority; supports Save when not already saved; shows Saved when already persisted where the surface contract calls for it; supports Download when a concrete media URL exists; actions reflect real capabilities, not optimistic labels.                                                                     |
| `library-owned-detail`          | Media Library, Character panel media service, Elements panel media service                                                    | Treats the media library row as the persisted authority; shows Saved rather than offering Save; supports Download/Delete for media rows when permitted by the library surface; supports Saved/Delete text detail for saved prompt rows, with Use only where the parent surface exposes a prompt-use callback; preview should use library render authority while preserving durable storage/media ids. |
| `canvas-fallback-detail`        | Canvas items without a current output-backed reference                                                                        | Builds a detail item from canvas media and presentation data; supports Download only when wired to a concrete URL; avoids promising Save/Delete unless the canvas item has an owning persistence path for that action.                                                                                                                                                                                |
| `unsupported-or-blocked-detail` | Any instance that cannot currently produce a valid detail modal                                                               | Must be explicitly classified as unsupported, blocked, not applicable, or product-decision needed. It should not silently masquerade as a working modal.                                                                                                                                                                                                                                              |

## Base Instance Registry

The base matrix is 6 surfaces x 4 media types x 2 origins = 48 required instance families.

ID format: `{surface}-{media}-{origin}`.

Surface codes:

- `RG`: Reference Grid
- `QS`: Quick Slot Inventory
- `CV`: Canvas
- `ML`: Media Library
- `CH`: Character panel media service
- `EL`: Elements panel media service

Media codes:

- `T`: Text
- `I`: Image
- `V`: Video
- `A`: Sound/audio

Origin codes:

- `C`: Computer-added
- `G`: Generated in-app

| Surface                 | Text               | Image              | Video              | Sound/Audio        |
| ----------------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| Reference Grid          | `RG-T-C`, `RG-T-G` | `RG-I-C`, `RG-I-G` | `RG-V-C`, `RG-V-G` | `RG-A-C`, `RG-A-G` |
| Quick Slot Inventory    | `QS-T-C`, `QS-T-G` | `QS-I-C`, `QS-I-G` | `QS-V-C`, `QS-V-G` | `QS-A-C`, `QS-A-G` |
| Canvas                  | `CV-T-C`, `CV-T-G` | `CV-I-C`, `CV-I-G` | `CV-V-C`, `CV-V-G` | `CV-A-C`, `CV-A-G` |
| Media Library           | `ML-T-C`, `ML-T-G` | `ML-I-C`, `ML-I-G` | `ML-V-C`, `ML-V-G` | `ML-A-C`, `ML-A-G` |
| Character media service | `CH-T-C`, `CH-T-G` | `CH-I-C`, `CH-I-G` | `CH-V-C`, `CH-V-G` | `CH-A-C`, `CH-A-G` |
| Elements media service  | `EL-T-C`, `EL-T-G` | `EL-I-C`, `EL-I-G` | `EL-V-C`, `EL-V-G` | `EL-A-C`, `EL-A-G` |

## Entry Path Overlay

Each base instance should be checked through the relevant entry paths. Do not duplicate all 48 rows for every path unless the path changes behavior.

| Entry Path                  | Meaning                                                                | Use When                                          |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `upload-button`             | User clicks Add Files or equivalent picker.                            | Computer-added media.                             |
| `desktop-drop`              | User drags a local file into a supported drop target.                  | Computer-added media and right-rail ingestion.    |
| `clipboard-paste`           | User pastes local or clipboard media.                                  | Any surface that supports paste.                  |
| `generated-direct`          | Media is generated in-app and appears directly in a reference surface. | Generated media.                                  |
| `generated-save-to-library` | Generated media is saved into All Media/Media Library.                 | Generated-to-library state and Saved behavior.    |
| `internal-rg-to-ml`         | Reference Grid item is saved or transferred to Media Library.          | Save state, durable authority, library ownership. |
| `internal-ml-to-rg`         | Media Library item is inserted into Reference Grid.                    | Library-to-reference hydration and actions.       |
| `internal-rg-to-qs`         | Reference Grid item is assigned to Quick Slot.                         | Quick Slot display and action inheritance.        |
| `internal-qs-to-cv`         | Quick Slot item is placed on Canvas.                                   | Canvas output-backed or fallback behavior.        |
| `internal-ml-to-cv`         | Media Library item is placed on Canvas.                                | Canvas library-backed behavior.                   |
| `project-restore`           | Item returns after project/session reload.                             | Persistence and signed URL refresh checks.        |
| `archive-restore`           | Item returns after archive/restore or equivalent recovery.             | Durable authority and deleted/unavailable states. |

## Trait Checklist

Apply traits as overlays. A trait should become a separate audit row only when it could reasonably change detail-modal behavior.

| Trait Group         | Traits To Check                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save state          | Unsaved, saved, already in library, save in progress, save failure, delete after saved.                                                                                            |
| Generated lifecycle | Pending, failed, completed, regenerated, generated then manually saved, generated with missing prompt.                                                                             |
| Media authority     | Durable media id present, preview storage path present, full storage path present, signed preview URL expired, object URL only, full-quality differs from preview, broken preview. |
| Text metadata       | Empty text, long text, uploaded text file, generated text output, missing title, long filename, extension shown correctly.                                                         |
| Image metadata      | Square, landscape, portrait, very wide/tall, transparent image, generated preview, uploaded original.                                                                              |
| Video metadata      | Poster present, poster missing, playable preview, full video download, snapshot action, duration available, duration missing.                                                      |
| Audio metadata      | Duration available, duration missing, waveform/controls render, voiceover, voice changer audio, generated music with lyrics, instrumental music.                                   |
| Modal mechanics     | Open/close, keyboard close, no duplicate playback, action disabled states, loading state, unavailable state, error copy.                                                           |
| Contract drift      | Docs match behavior, tests match behavior, builder capabilities match rendered actions, shared traits live in shared layer, variant-only traits are documented.                    |

## Audit Row Schema

Use this schema for every recorded check.

| Column            | Required?        | Description                                                                                                           |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| ID                | Yes              | Base instance ID, optionally plus entry path. Example: `CV-I-C/internal-ml-to-cv`.                                    |
| Surface           | Yes              | One of the six scoped surfaces.                                                                                       |
| Modal profile     | Yes              | `output-backed-detail`, `library-owned-detail`, `canvas-fallback-detail`, or `unsupported-or-blocked-detail`.         |
| Media type        | Yes              | Text, image, video, or sound/audio.                                                                                   |
| Origin            | Yes              | Computer-added or generated in-app.                                                                                   |
| Entry path        | Yes              | The path actually tested.                                                                                             |
| Backing authority | Yes              | Output, library row, canvas item, storage path, signed URL, object URL, or unknown.                                   |
| Traits            | Yes              | Only traits relevant to the check.                                                                                    |
| Expected          | Yes              | Expected behavior from the modal profile and traits.                                                                  |
| Actual            | Yes              | What happened.                                                                                                        |
| Status            | Yes              | `Pass`, `Bug`, `Unsupported - OK`, `Unsupported - Problem`, `Needs Product Decision`, `Blocked`, or `Not Applicable`. |
| Severity          | Yes for findings | `P0`, `P1`, `P2`, or `P3`.                                                                                            |
| Confidence        | Yes              | High, Medium, or Low.                                                                                                 |
| Evidence          | Yes for findings | Test name, screenshot, route, source file, or manual repro notes.                                                     |
| Fix seam          | Yes for bugs     | The canonical code or doc owner to change.                                                                            |
| Fix type          | Yes for bugs     | Normalize shared profile, add variant trait, wire missing action, docs/test correction, or product decision.          |
| Notes             | Optional         | Anything that explains nuance without hiding the classification.                                                      |

## Status And Severity

Statuses:

- `Pass`: Behavior matches the profile and traits.
- `Bug`: Behavior contradicts the expected profile and has a clear implementation seam.
- `Unsupported - OK`: The instance is intentionally unsupported and communicates that cleanly.
- `Unsupported - Problem`: The instance is unsupported but appears available, misleading, or broken.
- `Needs Product Decision`: The correct behavior is not currently defined.
- `Blocked`: The check cannot be completed because the data, route, auth, or environment is unavailable.
- `Not Applicable`: The surface does not support the instance and should not be checked as a modal behavior.

Severity:

- `P0`: Data exposure, destructive action, or launch-blocking media loss.
- `P1`: Wrong or broken primary detail-modal action, missing persisted authority, or major preview failure.
- `P2`: Inconsistent state, incomplete metadata, non-critical action mismatch, or variant drift.
- `P3`: Cosmetic polish, label mismatch, low-risk missing metadata.

## Audit Order

1. Profile smoke pass: check one representative text, image, video, and audio item for each modal profile.
2. Base matrix pass: check all 48 base instance families using the most common entry path for each.
3. Entry-path pass: add rows only where `upload-button`, drag/drop, paste, generated, transfer, or restore changes behavior.
4. Trait pass: layer save state, media authority, metadata, playback, and error traits onto the highest-risk instances.
5. Contract pass: verify docs, tests, builders, and rendered action bars agree.

## How To Run A Check

1. Create or locate the media for the chosen instance.
2. Move it through the exact entry path being tested.
3. Open the detail modal from the target surface.
4. Compare preview, metadata, actions, saved state, and unavailable/error handling against the modal profile.
5. Record the row using the audit schema.
6. Classify the result before fixing.
7. Patch only when the finding has a repo-backed bug statement and a canonical fix seam.
8. Add or update focused regression coverage when a behavior becomes part of the contract.

## Initial Findings Already Fixed

These fixes came from the first detail-modal audit pass and should be treated as the seed examples for future findings.

| Finding                                                                                                       | Fix Seam                                                                                                                                                                             | Current Proof                                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Media Library-owned detail modals did not show the persisted `Saved` state promised by the media-library SOP. | `frontend/features/ai-studio/components/detail-modal/sharedMediaDetailActions.ts` and `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx` | Focused detail-modal test suite passed.            |
| Shared video detail modals could drop the poster URL before reaching the preview media component.             | `frontend/features/ai-studio/components/detail-modal/SharedMediaDetailPreviewModal.tsx`                                                                                              | Focused video poster regression test passed.       |
| Canvas fallback detail items advertised download capability without wiring a download action.                 | `frontend/features/ai-studio/components/AiStudioPageContent.tsx`                                                                                                                     | Focused canvas fallback detail action test passed. |

Validation used for this seed pass:

- `npm -C frontend run test -- DetailModal MediaLibraryPanelPreviewModal SharedMediaDetailPreviewModal canvasDetailModal studioOutputDetailModal useAiStudioPageMediaReferenceRuntime AiStudioPageContent.header`
- `cd frontend && npx eslint features/ai-studio/components/AiStudioPageContent.tsx features/ai-studio/components/detail-modal/sharedMediaDetailActions.ts features/ai-studio/components/detail-modal/SharedMediaDetailPreviewModal.tsx features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx features/ai-studio/components/__tests__/MediaLibraryPanelPreviewModal.test.tsx features/ai-studio/components/__tests__/AiStudioPageContent.header.test.tsx`
- `npm -C frontend run type-check`
- `git diff --check`

## June 21, 2026 Audit Pass

Scope: code-level audit of the active detail-modal profiles plus focused regression validation. Production manual validation was not completed in this pass because authenticated production surface access was not part of the current run.

Fixed findings:

| ID                                                                             | Status | Severity | Finding                                                                                                                                                                                                                                                                                                                                        | Fix Seam                                                                                                                                                                                                                                                                                                     | Proof                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ML-V-C/upload-button`, `ML-V-G/generated-save-to-library`, `CH-V-*`, `EL-V-*` | Fixed  | `P2`     | Shared library-owned detail modals could report `Preview unavailable` while a focused media asset was still legitimately loading, which could race the async signed-original resolution path. The media-library preview error refresh also updated the top-level item URL without updating the nested `media` object read by the shared modal. | `frontend/features/ai-studio/components/detail-modal/SharedMediaDetailPreviewModal.tsx`; `frontend/features/ai-studio/hooks/useMediaLibraryPanelSelectionController.ts`                                                                                                                                      | `npm -C frontend run test -- DetailModal DetailModal.fullQuality MediaLibraryPanelPreviewModal SharedMediaDetailPreviewModal canvasDetailModal studioOutputDetailModal useMediaLibraryPanelSelectionController AiStudioPageContent.header`; targeted ESLint; `git diff --check`. |
| `ML-T-*`, `CH-T-*`, `EL-T-*`                                                   | Fixed  | `P2`     | Saved prompt/text rows in Media Library, Character media service, and Elements media service were selectable/draggable prompt cards, but they did not have a library-owned text detail modal variant.                                                                                                                                          | `frontend/features/ai-studio/logic/mediaLibraryPromptDetailModal.ts`; `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptDetailModal.tsx`; `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`; `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx` | `npm -C frontend run test -- MediaLibraryPromptDetailModal MediaLibraryAllItemsGrid MediaLibraryPanel pricingGridInvariants`; targeted ESLint; `npm -C frontend run type-check`.                                                                                                 |

Audit status after this pass:

- `output-backed-detail`: code and tests cover text, image, video, audio, save/download/delete, full-quality detail policy, generated music lyrics, voice changer transcript, and prompt edit/save behavior.
- `library-owned-detail`: code and tests cover text, image, video, audio, Saved/Download/Delete, prompt Use where supported, reload workflow, posters, generated prompt metadata, music lyrics, unavailable states, and exclusive audio playback.
- `canvas-fallback-detail`: code and tests cover image/video/audio fallback details with preview-only download behavior; text canvas items intentionally return `null`.
- Text detail outside output-backed Reference Grid/Quick Slot is now covered for saved prompt rows in the Media Library, Character media service, and Elements media service. Canvas text fallback remains intentionally unsupported until canvas text items gain a library/output-backed detail authority.
- No Supabase image transformation or Next image optimizer URL is accepted as focused image detail media in the shared modal.

Validation notes:

- Passed: `npm -C frontend run test -- DetailModal DetailModal.fullQuality MediaLibraryPanelPreviewModal SharedMediaDetailPreviewModal canvasDetailModal studioOutputDetailModal useMediaLibraryPanelSelectionController AiStudioPageContent.header`
- Passed: `npm -C frontend run test -- MediaLibraryPromptDetailModal MediaLibraryAllItemsGrid MediaLibraryPanel pricingGridInvariants`
- Passed: targeted ESLint for touched detail-modal, media-library, panel, and pricing fixture files.
- Passed: `npm -C frontend run type-check`

## June 28, 2026 Manual Confirmation Pass

Source of truth: user manual validation in the Codex detail-modal audit thread on June 28, 2026. This section records the checked product behavior so future modal changes can preserve the confirmed contracts. It is manual UI confirmation, not a substitute for focused regression tests.

Confirmed pass scope:

| Area                                    | Confirmed instances                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference Grid direct entries           | Text added from computer; generated text; image added from computer; generated image; video added from computer; generated video; audio added from computer; generated audio.                                                                                                                                                                                                                                                                                                                        |
| Reference Grid from Media Library       | Image saved from Reference Grid into Media Library, then dragged back into Reference Grid; generated image saved into Media Library, then dragged back into Reference Grid; video uploaded directly into Media Library, then dragged into Reference Grid; generated video saved into Media Library, then dragged into Reference Grid; audio uploaded directly into Media Library, then dragged into Reference Grid; generated audio saved into Media Library, then dragged into Reference Grid.      |
| Media Library direct-open detail modals | Text opened directly in Media Library; image saved from Reference Grid into Media Library, then opened in Media Library; generated image saved into Media Library, then opened in Media Library; video uploaded directly into Media Library, then opened in Media Library; generated video saved into Media Library, then opened in Media Library; audio uploaded directly into Media Library, then opened in Media Library; generated audio saved into Media Library, then opened in Media Library. |
| Quick Slot Inventory                    | Text added from computer; generated text; image added from computer; generated image; video added from computer; generated video; audio added from computer; generated audio; media dragged from Media Library into Quick Slot Inventory.                                                                                                                                                                                                                                                            |
| Canvas                                  | Text added from computer; generated text; image added from computer; generated image; video added from computer; generated video; audio added from computer; generated audio; media dragged from Media Library onto Canvas.                                                                                                                                                                                                                                                                          |
| Character panel media service           | All media types confirmed good for computer-added and generated media.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Elements panel media service            | All media types confirmed good for computer-added and generated media.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Audio detail metadata                   | All audio detail modals confirmed good with no displayed model information.                                                                                                                                                                                                                                                                                                                                                                                                                          |

Contracts to preserve:

- Audio detail modals must not display raw model information. They may show the media type and an approved workflow label such as `voiceover`, `voice changer`, `music`, or `SFX` where that label is product-facing.
- Media Library-owned detail modals must not show a redundant disabled `Saved` pill.
- Generated media saved into Media Library must retain generated detail authority when opened in Media Library or dragged back into Reference Grid. It must not degrade to a storage id, Supabase id, or generic uploaded-file header.
- Generated image and video headers should preserve product metadata such as media type, aspect ratio, resolution, and product-facing workflow/model labels where defined.
- Library-to-reference drag paths should preserve the same detail-modal metadata contract as direct generated outputs when the library item has generated authority metadata.

Regression coverage added around this pass:

- `frontend/features/ai-studio/components/__tests__/DetailModal.test.tsx`: generated/library Reference Grid detail metadata and audio header behavior.
- `frontend/features/ai-studio/components/__tests__/MediaLibraryPanelPreviewModal.test.tsx`: generated Media Library metadata preservation, resolution fallback, loading-state generated detail preservation, no redundant Saved pill, and library-owned generated audio with no model metadata.

## Detail Modal Change Checklist

Use this checklist before merging any future change that touches detail-modal presentation, Media Library generated metadata, Reference Grid hydration, Quick Slot detail behavior, or Canvas detail behavior.

- Confirm which modal profile is being changed: `output-backed-detail`, `library-owned-detail`, `canvas-fallback-detail`, or `unsupported-or-blocked-detail`.
- Preserve generated authority metadata across Media Library open and Media Library-to-Reference Grid drag paths: `workflowReload`, `generationReplay`, `characterContext`, `styleContext`, aspect, resolution, prompt, and product-facing workflow/model label where defined.
- Do not let storage paths, UUID-like filenames, Supabase ids, or `library-*` ids become the visible title/header for generated media when generated metadata exists.
- Do not display raw model metadata in audio detail modals. Only product-facing audio workflow labels such as `voiceover`, `voice changer`, `music`, or `SFX` may appear.
- Do not add a redundant disabled `Saved` pill to Media Library-owned detail modals.
- If the change affects generated image/video/audio metadata, run `npm -C frontend run test -- DetailModal MediaLibraryPanelPreviewModal`.
- If the change affects shared preview media, posters, unavailable states, or Canvas fallback details, also run the focused shared-preview/canvas detail tests named in the validation notes above.

## Blank Row Template

```text
ID:
Surface:
Modal profile:
Media type:
Origin:
Entry path:
Backing authority:
Traits:
Expected:
Actual:
Status:
Severity:
Confidence:
Evidence:
Fix seam:
Fix type:
Notes:
```
