# SOP: Character Manager Operations

## Purpose
Define the operational contract for the `/character` Character Manager surface, including current upload behavior, persisted character-sheet preset assignments, and support runbooks for alias-compatibility drift.

## Scope
- Applies to `frontend/features/character-manager/*` and `frontend/pages/character.tsx`.
- Covers the active Character Manager implementation only.
- Does not cover legacy `features/character/*` identity-token workflows.

## Current Product Contract
1. Users can upload reference images by drag/drop or file picker in the Drop References card.
2. QuickSwap Deck persists an unlimited number of references per character:
   - Active deck keeps newest 500 references.
   - Overflow references are auto-archived (restorable).
3. Uploaded references persist to Supabase per character in `character_quick_swap_items`.
4. Character Sheet drop zones are persisted per character with dynamic preset tabs (`1`..`10`):
   - New users start with one visible preset tab (`1`).
   - A `+` control at the end of the tab rail appends the next preset id and activates it.
   - Double-clicking a tab enters rename mode; `Enter`/blur autosaves and `Escape` cancels.
   - Tabs after `1` expose a delete (`X`) control.
   - Deleting a tab requires confirmation and permanently removes that tab's saved preset references.
   - Tab deletion is preset-local only: remove that tab's assignments/metadata, but do not auto-delete shared media artifacts.
   - If the active tab is deleted, active selection falls back to nearest left tab; if no left tab exists, nearest right is selected.
   - Active tab id persists to character metadata (`character_sheet_presets_v1.active_preset_id`).
   - Each tab stores independent zone media references for `portrait`, `close_up`, `front_shot`, and `back_shot`.
   - Visible tab ids persist to `character_sheet_presets_v1.tab_order`.
   - Tab display names persist to `character_sheet_presets_v1.tab_labels`.
   - Preset tabs use `tablist/tab/tabpanel` semantics with roving tab focus (`tabindex=0` on active tab, `-1` otherwise).
   - Keyboard support is required: `ArrowLeft/ArrowRight` wrap navigation, `Home/End` jump to first/last tab, and `Enter/Space` activate focused tab.
   - Dragging a reference onto a drop zone assigns that reference to the zone.
   - Dropping onto an occupied zone replaces the previous assignment.
   - Dragging from one drop zone to another swaps assignments.
   - Assignments are saved to character metadata (`character_sheet_presets_v1`).
   - Preset zone uploads are independent of QuickSwap Deck capacity/archival.
   - Removing a QuickSwap Deck reference does not clear preset zone assignments.
   - No activation gate or completion requirement is enforced in the current UI.
5. Dropped external reference URLs are trust-scoped:
   - Trusted local/internal/supabase-hosted image URLs are accepted for Character Sheet and QuickSwap drop flows.
   - Arbitrary external hosts are blocked from drop ingestion.
6. Character selection persistence:
   - Selecting a character in Character Manager persists that selection in browser local storage.
   - The persisted selection is used as the preferred default on reload for both `/character` and the AI Studio embedded Character panel.
   - If the persisted character no longer exists, Character Manager falls back to the latest available draft.
7. AI Studio Create Character Mode consumes Character Manager data at generation time:
   - Selected character description is injected as hidden prompt context when available.
   - Character Mode resolves ordered references from the active preset first (`portrait`, `close_up`, `front_shot`, `back_shot`), then falls back to legacy slot-based assignments when preset zones are empty.
   - Character draft is reloaded before each Create/Text generation submit so newest preset changes are used.
   - Missing description/references are non-blocking; AI Studio falls back to best-effort injection.
8. Character Library responsiveness contract:
   - `0-50` characters: full-list smooth rendering target.
   - `51-100` characters: progressive rendering mode (`show 50` by default, `+25` expansion steps, optional `show all`).
   - Selected character remains visible when list is windowed.
9. Character Mode stale-selection safety:
   - Submit-time character bundle refresh must fail closed when selected character is no longer available.
   - Cached bundle reuse is allowed only for transient refresh failures.
10. Create-workspace layout order contract:
   - Desktop (`>1100px`): Identity renders on the left, QuickSwap Deck renders on the right, and Character Sheet renders below Identity.
   - Tablet/mobile (`<=1100px`): sections stack in order `Identity -> QuickSwap Deck -> Character Sheet`.
   - DOM order must match visual order to preserve accessibility and deterministic layout-test assertions.

## Architecture Map
- Shell/UI orchestration: `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- Create layout wrapper: `frontend/features/character-manager/components/CharacterCreateWorkspaceLayout.tsx`
- Character sheet preset tabs UI/a11y seam: `frontend/features/character-manager/components/CharacterSheetPresetTabs.tsx`
- Draft state + persistence orchestration: `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
- Supabase persistence primitives: `frontend/features/character-manager/logic/characterManagerPersistence.ts`
- QuickSwap persistence primitives: `frontend/features/character-manager/logic/characterQuickSwapPersistence.ts`
- QuickSwap state orchestration: `frontend/features/character-manager/hooks/useCharacterQuickSwapDeck.ts`
- QuickSwap UI section: `frontend/features/character-manager/components/CharacterQuickSwapDeckSection.tsx`
- File validation rules: `frontend/features/character-manager/logic/referenceValidation.ts`
- Character Manager route shell: `frontend/pages/character.tsx`
- AI Studio Create integration: `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/logic/characterModePayload.ts`
- Compatibility drift SQL: `sql/check_character_sheet_alias_drift.sql`

## Operational Flow
1. Character bootstrap
- Load or create a character draft on entry.
- Prefer the persisted selected character id when available.
- Hydrate profile image, name, description, and persisted QuickSwap active/archive state.

2. Reference intake
- Accept only `image/*` MIME files.
- Enforce max file size using `CHARACTER_MANAGER_MAX_IMAGE_BYTES`.
- Persist quickswap metadata through `appendQuickSwapFiles(...)`.
- Enforce active-limit archive semantics (500 active, oldest overflow archived).

3. Character Sheet presets and drag/drop (persisted)
- Keep per-character preset state in Character Manager draft state.
- Persist active tab id, visible tab ids, tab labels, and active-tab drop-zone assignments to Supabase character metadata.
- Keep DnD behavior stable (assign/replace/swap) without activation gating.
- Keep preset media lifecycle independent from QuickSwap Deck entries.

4. Character lifecycle
- Create character: create draft + refresh rail.
- Select character: load selected snapshot + refresh rail.
- Delete character: delete target and load next available snapshot (or create one).

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

2. Run drift diagnostics:
- Execute `sql/check_character_sheet_alias_drift.sql`.

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
- Deleting one QuickSwap reference removes only that item and persists.
- Dragging a reference into a Character Sheet zone assigns it.
- Dropping another reference into that same zone replaces it.
- Dragging zone-to-zone swaps assignments.
- Dropped external reference URLs are accepted only from trusted local/internal/supabase-hosted sources.
- QuickSwap deck is scrollable and remains interactive at high active counts.
- Uploading beyond 500 active references archives oldest active references.
- Archived references can be restored back into active deck.
- New users start with one visible preset tab (`1`), can add up to ten tabs, and active-tab switching has no cross-tab assignment bleed.
- Double-click tab rename autosaves on `Enter`/blur and cancels on `Escape`.
- Deleting a tab (`X`) shows confirmation; selecting `Yes` removes the tab and its saved preset references.
- Deleting an active preset tab deterministically selects nearest-left remaining tab (or nearest-right when no left tab exists).
- Deleting a preset tab does not auto-delete shared media used by other tabs/surfaces.
- Character Sheet preset assignments persist after refresh and character switching.
- Untrusted external dropped URLs are blocked in Character Sheet and QuickSwap drop surfaces.
- Selected character persists after refresh/re-entry and becomes the preferred default for future sessions.
- Preset uploads do not consume QuickSwap Deck capacity.
- Creating/switching/deleting characters preserves expected per-character state.
- Manage Characters list stays smooth through `<=50` entries and supports progressive reveal behavior for larger libraries.
- If selected character is deleted/archived, Character Mode submit path does not reuse stale cached bundle injection.

## Change Management Rules
- Any change to `/character` behavior must update:
  - `docs/routes.md` (if route behavior changes),
  - this SOP,
  - relevant ADR(s) for durable architecture changes.
- Character Sheet active preset assignments are generation-driving for AI Studio Create Character Mode; keep integration contracts in this SOP and `docs/sops/sop_image_generation.md` in sync when changing preset semantics.

## Legacy SOP Status
- `docs/archive/sops/sop_character_generation.md` and `docs/archive/sops/sop_character_identity.md` are legacy references for the old character pipeline and are not authoritative for current `/character` behavior.
