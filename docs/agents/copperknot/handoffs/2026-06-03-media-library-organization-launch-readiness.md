# Media Library And Organization Launch Readiness Handoff

Status: source-hardened after Holomony/Copperknot completion pass; authenticated production proof remains the watch boundary.

## Current Freshness Addendum - 2026-06-20

- Current queue state: P2 `Media library and organization` is ready to move from `Below Floor - Handed Off` to `Below Floor - Source Hardened` with `Locally Tested` evidence.
- Use `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md` as the live priority/source-of-truth layer, then use this packet as the Holomony continuation scope.
- The refreshed pass audited branch, worktree, owning files, current Media Library routes/components, and production-safe route proof before claiming source-hardening progress.
- The evidence below includes historical local evidence from the 2026-06-03 Copperknot pass plus the refreshed local/prod-safe proof recorded in the completion addendum.
- The old multipart/raw `/api/media/upload` compatibility route is now retired. Do not use `frontend/tests/api/media-upload.route.test.ts` or `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED` as current proof targets; the canonical local Media Library / Reference Grid upload route pair is `/api/media/prepare-upload` -> browser direct storage upload -> `/api/media/finalize-upload`.
- Remaining proof boundary: authenticated production customer behavior for save, browse, organize, reuse, and reopen across Media Library and AI Studio surfaces. Preserve current UI/UX/design/behavior; do not redesign Media Library or make folders project-local.

## Completion Addendum - 2026-06-19

- Source-audited canonical ingest/save continuity across direct upload prepare/finalize, copy-from-url, and AI Studio save-to-library persistence.
- Source-audited global folder authority in `mediaFoldersService`, folder CRUD routes, membership mutation routes, and project/non-project list behavior; folders remain global user-owned library containers, not project-local containers.
- Source-audited autosave-off and project-association semantics in the AI Studio autosave orchestrator, autosave policy, persistence actions, and media-library persistence helpers.
- Source-audited preview signing/list/resolve surfaces for shared user-scoped storage-path validation, storage-object existence gating, wrong-asset avoidance, and the no-Supabase-transform policy.
- Validated the refreshed local proof slice: media ingest/folder/list/sign/resolve/autosave/persistence tests passed at `15` files / `224` tests; display/modal/signing tests passed at `20` files / `273` tests with `8` skipped; workflow reload/reference-grid tests passed at `6` files / `120` tests; adaptive media runtime passed lint/type-check and `7` files / `218` tests with `8` skipped; media rendering guardrails and docs checks passed.
- Production-safe proof remains fail-closed and route-surface only: strict production route parity passed against `https://www.shortpulse.ai`, and unauthenticated media list/sign/resolve/upload/copy/folder-membership routes returned `401`. This does not prove authenticated customer success.

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
- Historical note: Copperknot previously fixed a stale assertion in `frontend/tests/api/media-upload.route.test.ts`, but that compatibility-route test was retired with `/api/media/upload` on 2026-06-20. Do not treat it as current evidence.

## Current Evidence

- `npm -C frontend run test -- tests/api/media-folders-crud.test.ts tests/api/media-folders-membership-batch.test.ts tests/api/media-list.test.ts tests/api/media-copy-from-url.test.ts tests/api/media-finalize-upload-route.test.ts features/media-library/hooks/__tests__/useMediaUploadController.test.ts features/media-library/hooks/__tests__/useMediaFileModalCrud.test.ts features/media-library/runtime/__tests__/useMediaLibraryPanelRuntime.test.ts`
- Result: `8` test files passed, `91` tests passed.
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- Result: `1` test file passed, `30` tests passed.

Known validation caveat:

- One larger combined media slice produced `mediaLibraryPersistence.test.ts` timeout/body-reuse failures and a Vitest worker startup timeout. The same persistence test file passed when rerun independently, so Copperknot classified the combined failure as validation instability, not as proof of a source regression. Do not patch around that combined failure unless it becomes reproducible in a bounded owner path.

## Required Next Proof

Holomony should continue with a bounded launch-readiness audit, not a redesign:

1. Prove server-authoritative ingest and save continuity across direct upload prepare/finalize and copy-from-url.
2. Prove folder CRUD, nested folder hierarchy, and membership assignment/move/remove preserve one global user-owned folder authority across project and non-project routes.
3. Prove autosave-off behavior still blocks automatic Media Library persistence without breaking in-session playback, project association, or private restore durability.
4. Prove saved media and prompts attach to active projects when appropriate, without duplicating global Media Library rows or making folders project-local.
5. Prove preview signing and browse/detail surfaces avoid Supabase image transformations and do not display wrong assets.
6. Separate launch blockers from watch items and post-launch polish.

## Acceptance Bar

This system can move out of `Below Floor - Handed Off` only when:

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
