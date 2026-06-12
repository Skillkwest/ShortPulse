# SOP: Character Manager Operations

## Purpose

Define the operational contract for the AI Studio-owned Character surfaces, including current upload behavior and persisted character-sheet preset assignments.

## Scope

- Applies to the AI Studio Character panel and shared `frontend/features/character-manager/*` persistence/runtime files.
- Covers the active Character Manager implementation only.
- Does not cover legacy `features/character/*` identity-token workflows.

## Current Product Contract

1. Users can upload reference images by drag/drop or file picker in the Drop References card.
2. Character Sheet drop zones are persisted per character with dynamic preset tabs (`1`..`10`):
   - `Create New Character` opens a local unsaved Character Profile draft only.
   - The character is first created in Supabase and added to the library when the user presses `Save Character`.
   - Until the first save, persistence-dependent actions stay blocked (for example profile image uploads and preset/shot uploads).
   - Starting a fresh character from an unsaved draft requires explicit confirmation when the current draft contains unsaved changes.
   - New users start with four visible preset tabs (`1`..`4`).
   - A `+` control at the end of the tab rail appends the next preset id and activates it.
   - Double-clicking a tab enters rename mode; `Enter`/blur autosaves and `Escape` cancels.
   - Tabs after `1` expose a delete (`X`) control.
   - Deleting a tab requires confirmation and permanently removes that tab's saved preset references.
   - Tab deletion is preset-local only: remove that tab's assignments/metadata, but do not auto-delete shared media artifacts.
   - If the active tab is deleted, active selection falls back to nearest left tab; if no left tab exists, nearest right is selected.
   - Active tab id persists to character metadata (`character_sheet_presets_v1.active_preset_id`).
   - Each tab stores independent zone media references for `portrait`, `close_up`, and `front_shot`.
   - Visible tab ids persist to `character_sheet_presets_v1.tab_order`.
   - Tab display names persist to `character_sheet_presets_v1.tab_labels`.
   - Character description is preset-scoped and persists to `character_sheet_presets_v1.tab_descriptions`.
   - Editing description in Character Profile updates only the active preset tab description.
   - Preset tabs use `tablist/tab/tabpanel` semantics with roving tab focus (`tabindex=0` on active tab, `-1` otherwise).
   - Keyboard support is required: `ArrowLeft/ArrowRight` wrap navigation, `Home/End` jump to first/last tab, and `Enter/Space` activate focused tab.
   - Dragging a reference onto a drop zone assigns that reference to the zone.
   - Dropping onto an occupied zone replaces the previous assignment.
   - Dragging from one drop zone to another swaps assignments.
   - Assignments are saved to character metadata (`character_sheet_presets_v1`).
   - No activation gate or completion requirement is enforced in the current UI.
   - Character Profile voice controls are currently hidden from the UI.
   - Dormant voice state/modal code remains quarantined for a later rollout; see `docs/character-profile-voice-quarantine.md`.
3. Dropped external reference URLs are trust-scoped:
   - Trusted local/internal/supabase-hosted image URLs are accepted for Character Sheet drop flows.
   - Arbitrary external hosts are blocked from drop ingestion.
   - Internal AI Studio Reference Grid drags are accepted when payload origin is `ai-studio-reference-grid` and the drag is backed by the same-document internal drag session token, or when resolver recovery proves real internal media/storage authority.
   - Internal drops resolve to trusted `mediaId` first when available; URL host allowlist checks apply only to non-internal drops.
   - If an internal drop has a caller-owned storage path, Character Manager copies that storage object into Character Manager storage through `/api/media/admit-image-asset-from-storage` rather than downloading and re-uploading it in the browser.
   - If an internal drop has no `mediaId` or storage path, Character Manager may ingest the trusted internal preview URL directly into Character Manager storage without forcing an AI Studio Media Library save, but only for session-backed internal drags.
   - Internal payload parse/resolve/fallback failures fail closed (no partial Character Sheet mutation).
4. Character selection persistence:
   - Selecting a character in Character Manager persists that selection in browser local storage.
   - Local persistence must be scoped per authenticated `user_id` to prevent cross-account leakage on shared browsers.
   - The persisted selection is used as the preferred default on reload for the AI Studio embedded Character panel and related AI Studio character workflows.
   - If the persisted character no longer exists, Character Manager falls back to the latest available draft.
5. AI Studio Create Character Mode consumes Character Manager data at generation time:
   - Selected character description is injected from the chosen Create look when AI Studio supplies a local look override; otherwise it uses active preset `tab_descriptions[active_preset_id]`.
   - If active preset description is empty, injection falls back to legacy `characters.description`.
   - Character Mode resolves ordered references from the chosen Create look first (`portrait`, `close_up`, `front_shot`), then falls back to legacy slot-based assignments when preset zones are empty.
   - Character draft is reloaded before each Create/Text generation submit so newest preset changes are used.
   - AI Studio Create look selection is local to that generation workflow and does not mutate `character_sheet_presets_v1.active_preset_id`.
   - AI Studio Video linked Character slots may also carry a local look selection for Kling/Seedance linked-subject generation. This selection resolves that look's description and references for the Video slot, but it does not mutate Character Manager active-look metadata.
   - When the Character panel changes the selected character without an explicit Create-picker look choice, AI Studio clears the prior local look override and rehydrates the current character's active/default look.
   - Missing description is non-blocking when usable look refs still exist, but missing character image refs remain submit-blocking for Character Mode Create because the generation lane is image-to-image only.
   - When storage authority is known, Character Mode must hand Character Sheet refs to AI Studio as canonical internal media refs so replay/reroll and submit do not depend on durable signed URLs.
6. Character Library responsiveness contract:
   - `0-50` characters: full-list smooth rendering target.
   - `51-100` characters: progressive rendering mode (`show 50` by default, `+25` expansion steps, optional `show all`).
   - Selected character remains visible when list is windowed.
7. Character Mode stale-selection safety:
   - Submit-time character bundle refresh must fail closed when selected character is no longer available.
   - Cached bundle reuse is allowed only for transient refresh failures.
8. Create-workspace layout contract:

- The embedded Character panel is the live character-management surface in AI Studio.
- The top workspace is a Character Profile editor with `Characters`, `Save`, and `Create` actions instead of a persistent left-side manage rail.
- Saved characters are browsed through the `Characters` modal, not a permanently mounted list.
- The profile photo and character name editor card render above the look tab row.
- The embedded `Looks` control uses the compact segmented layout with explicit manage actions for switching, renaming, and deleting persisted looks instead of relying on double-click rename and hover-only delete affordances.
- The legacy Identity section and the legacy QuickSwap shell copy are removed from the shipped embedded surface.

9. Internal drag observability contract:

- Emit `character_drop_attempt` for every internal drop parsed at target boundary.
- Emit `character_drop_resolved` when resolver yields a usable internal reference (`mediaId` or trusted preview URL fallback) and assignment succeeds.
- Emit `character_drop_rejected` on malformed payloads, unsupported targets, or policy rejection.
- Emit `character_drop_failed_autosave` when the internal resolver path throws before assignment can proceed.

10. Character panel media isolation contract:

- Character panel uploads persist to `character_media_assets`.
- Character Sheet internal Media Library/Reference Grid drops use copy semantics (server-side owned-storage copy when a storage path is known; trusted preview ingestion only as fallback) rather than direct attach-by-`media_files.id`.
- `character_media_id` is the required persisted reference for Character Manager assets. Legacy metadata keys and row-level `media_file_id` linkage are retired from the live runtime path.
- Legacy `character_quick_swap_items` compatibility handling remains in cleanup/orphan-protection code for historical datasets, but QuickSwap is not an active embedded Character panel UX contract.

## Architecture Map

- AI Studio embedded character panel shell: `frontend/features/ai-studio/components/CharacterPanel.tsx`
- AI Studio split-host seam: `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`
- AI Studio character workspace surface: `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
- AI Studio embedded looks control seam: `frontend/features/character-manager/components/EmbeddedCharacterLooksControl.tsx`
- Draft state + persistence orchestration: `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
- Supabase persistence primitives: `frontend/features/character-manager/logic/characterManagerPersistence.ts`
- Persistence core / cleanup compatibility boundary: `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`
- File validation rules: `frontend/features/character-manager/logic/referenceValidation.ts`
- AI Studio Create integration: `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/logic/characterModePayload.ts`
- AI Studio internal drag payload + parser: `frontend/features/ai-studio/utils/dragDrop.ts`
- AI Studio drop resolver seam: `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- Historical alias drift / retirement-readiness SQL: `sql/check_character_sheet_alias_drift.sql`

## Operational Flow

1. Character bootstrap

- Load the preferred/latest persisted character draft on entry when one exists; otherwise stage a local unsaved Character Profile draft.
- Prefer the persisted selected character id when available.
- Hydrate profile image, name, description, look metadata, and persisted Character Sheet references.

2. Reference intake

- Accept only `image/*` MIME files.
- Enforce max file size using `CHARACTER_MANAGER_MAX_IMAGE_BYTES`.
- Persist Character Sheet/profile media through the Character Manager draft persistence path.
- Local files must use product-image browser-direct upload admission (`prepare-product-image-asset-upload` followed by `finalize-product-image-asset-upload`) instead of multipart function-body uploads.

3. Character Sheet presets and drag/drop (persisted)

- Keep per-character preset state in Character Manager draft state.
- Persist active tab id, visible tab ids, tab labels, and active-tab drop-zone assignments to Supabase character metadata.
- Keep DnD behavior stable (assign/replace/swap) without activation gating.
- For internal Reference Grid drags, resolve to `mediaId`/owned storage authority first; copy storage-backed refs server-side into Character Manager storage; when no storage path exists, fall back to direct trusted preview-URL ingestion into Character Manager storage, then mutate target slot/deck atomically.
- Keep preset media lifecycle isolated from legacy compatibility rows such as historical quick-swap records.

4. Character lifecycle

- Create character: stage a new local unsaved draft in the editor without persisting.
- AI Studio `Create Character` entry points should all route through that same new-draft staging flow, including the Character panel `+ Create` action, the Create-panel Character Picker modal action, and other picker/modal create affordances that intentionally launch Character authoring.
- Save character: create the persisted character + sheet, refresh the rail, and select the newly saved character.
- Select character: load selected snapshot + refresh rail.
- Delete character: delete target and load next available snapshot (or fall back to a local unsaved draft when the library is empty).

## Security And Data Isolation Checks

- RLS must be enabled on Character Manager tables and scoped to `auth.uid()`.
- Storage paths for character media must remain user-scoped.
- Client must only use Supabase anon key; service-role keys are never allowed in client code.
- Character Manager APIs and persistence must continue to route through authenticated Supabase client paths.

## Drift And Compatibility Runbook

Use this when Character Sheet data looks inconsistent across environments or after migrations.

1. Confirm migrations are applied through:

- `sql/migrations/008_add_character_manager_foundation.sql`
- `sql/migrations/010_harden_character_reference_media_integrity.sql`
- `sql/migrations/011_add_character_description_to_characters.sql`
- `sql/migrations/012_add_character_sheet_aliases_and_compat.sql`
- `sql/migrations/045_add_character_quickswap_deck.sql`
- `sql/migrations/068_add_character_media_assets_isolation.sql`

2. Run drift diagnostics:

- Execute `sql/check_character_sheet_alias_drift.sql`.
- Execute `sql/check_character_media_isolation_backfill.sql` when auditing historical Character Manager rows for legacy-link normalization.

3. Evaluate output:

- Expected steady-state: every `mismatch_count` is `0`.

4. If mismatches exist:

- Re-run `sql/migrations/012_add_character_sheet_aliases_and_compat.sql`.
- Verify alias-sync triggers exist and are healthy.
- Escalate unresolved mismatches and log incident notes in `docs/change_log.md`.

## QA Checklist (Before Ship)

- Upload from file picker works and persists after refresh.
- Multi-file drag/drop upload works and appends all valid references.
- Non-image files are rejected with clear message.
- Oversize images are rejected with clear message.
- Dragging a reference into a Character Sheet zone assigns it.
- Dropping another reference into that same zone replaces it.
- Dragging zone-to-zone swaps assignments.
- Dropped external reference URLs are accepted only from trusted local/internal/supabase-hosted sources.
- Dragging from AI Studio Reference Grid to Character Sheet slot replaces the targeted slot.
- Dragging storage-backed AI Studio Reference Grid media to a Character Sheet slot saves through server-side storage copy without browser download/re-upload.
- Internal drag payload failures show user-visible error and do not mutate Character Sheet state.
- New users start with four visible preset tabs (`1`..`4`), can add up to ten tabs, and active-tab switching has no cross-tab assignment bleed.
- Double-click tab rename autosaves on `Enter`/blur and cancels on `Escape`.
- Editing Character Profile description on one preset tab does not mutate descriptions on other preset tabs.
- Deleting a tab (`X`) shows confirmation; selecting `Yes` removes the tab and its saved preset references.
- Deleting an active preset tab deterministically selects nearest-left remaining tab (or nearest-right when no left tab exists).
- Deleting a preset tab does not auto-delete shared media used by other tabs/surfaces.
- Character Sheet preset assignments persist after refresh and character switching.
- Starting a new character from an unsaved draft requires confirmation when that draft contains unsaved changes.
- Untrusted external dropped URLs are blocked in Character Sheet drop surfaces.
- Selected character persists after refresh/re-entry and becomes the preferred default for future sessions.
- Character-panel character changes clear stale Create look overrides and resolve the current character's active/default look before generation.
- Creating/switching/deleting characters preserves expected per-character state.
- Manage Characters list stays smooth through `<=50` entries and supports progressive reveal behavior for larger libraries.
- If selected character is deleted/archived, Character Mode submit path does not reuse stale cached bundle injection.

## Change Management Rules

- Any change to AI Studio Character surface behavior must update:
  - `docs/routes.md` (if route behavior changes),
  - this SOP,
  - relevant ADR(s) for durable architecture changes.
- Character Sheet active preset assignments are generation-driving for AI Studio Create Character Mode; keep integration contracts in this SOP and `docs/sops/sop_image_generation.md` in sync when changing preset semantics.

## Legacy SOP Status

- `docs/archive/sops/sop_character_generation.md` and `docs/archive/sops/sop_character_identity.md` are legacy references for the old character pipeline and are not authoritative for the current AI Studio-owned Character workflow.
