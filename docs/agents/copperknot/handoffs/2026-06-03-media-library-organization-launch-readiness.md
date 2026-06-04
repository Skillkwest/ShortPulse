# Media Library And Organization Launch Readiness Handoff

Status: marked handoff for Holomony continuation; Copperknot stopped before broad media-lane churn.

## Large-Lane Stop Marker

The Media Library and organization lane spans server-authoritative ingest, URL copy, direct upload finalization, folder hierarchy, folder membership, project association, autosave-off behavior, preview signing, browse performance, and detail-modal correctness. That is too large for Copperknot to keep pushing through patch-by-patch without creating churn.

Copperknot completed one focused pass, fixed one stale validation assertion, and is handing the remaining launch-readiness proof to Holomony. Copperknot retains readiness acceptance authority after Holomony returns evidence.

If Holomony finds that any sub-lane needs more than a couple focused passes, Holomony should stop, mark the sub-lane, and return a narrower handoff instead of broadening this packet.

## Launch Authority

- Copperknot authority: `docs/agents/copperknot/july-7-launch-authority.md`
- System map: `docs/agents/copperknot/july-7-system-map.md`
- Current queue: `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- Current board: `docs/agents/copperknot/july-7-launch-board.md`
- Holomony local instructions: `docs/agents/holomony/AGENTS.md`
- Media Library SOP: `docs/sops/sop_ai_studio_media_library_operations.md`
- Project/global-folder contract: `docs/sops/sop_ai_studio_projects_foundation.md`

## Human Promise

A user must be able to save generated/uploaded/copied media into the Media Library, browse it, organize it in global folders, reuse it across AI Studio surfaces, and reopen project-associated work without losing trust in saved assets, folders, previews, or autosave-off expectations.

Preserve the current UI, UX, visual design, and intended behavior. This lane is source and proof work; visible redesign or major behavior changes are out of scope unless Copperknot explicitly reopens that scope with evidence.

## Copperknot Focused Pass Completed On 2026-06-03

- Confirmed the Media Library SOP still defines `All Media` as the virtual global user inventory and custom folders as one global folder authority across project and non-project AI Studio routes.
- Confirmed `frontend/lib/server/mediaFoldersService.ts` keeps `all_items` virtual, validates user-owned custom folders, validates media/prompt ownership before membership mutation, and rejects character-scoped media ids.
- Confirmed `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts` has current coverage for project association on saved media/prompts, generated-media generation-id enforcement, and server-copy fallback.
- Fixed stale test expectation in `frontend/tests/api/media-upload.route.test.ts`: oversized image upload metadata now asserts the current `image_admission` contract instead of the retired `upload_normalization` shape.

## Current Evidence

- `npm -C frontend run test -- tests/api/media-upload.route.test.ts`
- Result: `1` test file passed, `9` tests passed.
- `npx eslint tests/api/media-upload.route.test.ts`
- Result: passed.
- `npm -C frontend run test -- tests/api/media-folders-crud.test.ts tests/api/media-folders-membership-batch.test.ts tests/api/media-list.test.ts tests/api/media-copy-from-url.test.ts tests/api/media-finalize-upload-route.test.ts features/media-library/hooks/__tests__/useMediaUploadController.test.ts features/media-library/hooks/__tests__/useMediaFileModalCrud.test.ts features/media-library/runtime/__tests__/useMediaLibraryPanelRuntime.test.ts`
- Result: `8` test files passed, `91` tests passed.
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- Result: `1` test file passed, `30` tests passed.

Known validation caveat:

- One larger combined media slice produced `mediaLibraryPersistence.test.ts` timeout/body-reuse failures and a Vitest worker startup timeout. The same persistence test file passed when rerun independently, so Copperknot classified the combined failure as validation instability, not as proof of a source regression. Do not patch around that combined failure unless it becomes reproducible in a bounded owner path.

## Required Next Proof

Holomony should continue with a bounded launch-readiness audit, not a redesign:

1. Prove server-authoritative ingest and save continuity across direct upload prepare/finalize, compatibility upload, and copy-from-url.
2. Prove folder CRUD, nested folder hierarchy, and membership assignment/move/remove preserve one global user-owned folder authority across project and non-project routes.
3. Prove autosave-off behavior still blocks automatic Media Library persistence without breaking in-session playback, project association, or private restore durability.
4. Prove saved media and prompts attach to active projects when appropriate, without duplicating global Media Library rows or making folders project-local.
5. Prove preview signing and browse/detail surfaces avoid Supabase image transformations and do not display wrong assets.
6. Separate launch blockers from watch items and post-launch polish.

## Acceptance Bar

This system can move out of `Below Bar - Handed Off` only when:

- canonical save/ingest paths are source-audited and covered by current tests or production-safe proof,
- global folder membership behavior is current for project and non-project routes,
- autosave-off and project association semantics are verified,
- preview/signing proof preserves no-transform policy and media-display correctness,
- validation instability is either bounded or explicitly recorded as a non-blocking caveat,
- and Copperknot accepts the returned evidence under the July 7 evidence ladder.

## Stop Rules

- Do not change UI/UX by default.
- Do not make Media Library folders project-local.
- Do not weaken private storage, ownership, or signed-preview boundaries.
- Do not use Supabase image transformations.
- Do not run credit-consuming generation proof.
- Do not continue beyond a couple focused Holomony passes without marking a narrower sub-lane.
