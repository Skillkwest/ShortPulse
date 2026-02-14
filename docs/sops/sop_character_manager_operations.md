# SOP: Character Manager Operations

## Purpose
Define the operational contract for the `/character` Character Manager surface, including current upload behavior, persisted character-sheet drag/drop assignments, and support runbooks for alias-compatibility drift.

## Scope
- Applies to `frontend/features/character-manager/*` and `frontend/pages/character.tsx`.
- Covers the active Character Manager implementation only.
- Does not cover legacy `features/character/*` identity-token workflows.

## Current Product Contract
1. Users can upload reference images by drag/drop or file picker in the Drop References card.
2. The persisted reference intake limit is 8 images per character (`SIMPLE_REFERENCE_IMAGE_LIMIT`).
3. Uploaded references persist to Supabase per character.
4. Character Sheet drop zones are persisted per character:
   - Dragging a reference onto a drop zone assigns that reference to the zone.
   - Dropping onto an occupied zone replaces the previous assignment.
   - Dragging from one drop zone to another swaps assignments.
   - Assignments are saved to character metadata (`character_sheet_assignments` + compatibility alias).
   - No activation gate or completion requirement is enforced in the current UI.
5. AI Studio Create Character Mode consumes Character Manager data at generation time:
   - Selected character description is injected as hidden prompt context when available.
   - Character Sheet assignments resolve to ordered references (`portrait`, `close_up`, `front_shot`, `back_shot`) sent to Seedream edit when available.
   - Missing description/references are non-blocking; AI Studio falls back to best-effort injection.

## Architecture Map
- Shell/UI orchestration: `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- Draft state + persistence orchestration: `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
- Supabase persistence primitives: `frontend/features/character-manager/logic/characterManagerPersistence.ts`
- File validation rules: `frontend/features/character-manager/logic/referenceValidation.ts`
- Character Manager route shell: `frontend/pages/character.tsx`
- AI Studio Create integration: `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/logic/characterModePayload.ts`
- Compatibility drift SQL: `sql/check_character_sheet_alias_drift.sql`

## Operational Flow
1. Character bootstrap
- Load or create a character draft on entry.
- Hydrate profile image, name, description, and persisted reference slots.

2. Reference intake
- Accept only `image/*` MIME files.
- Enforce max file size using `CHARACTER_MANAGER_MAX_IMAGE_BYTES`.
- Run deterministic validation via `validateCharacterReferenceFile(...)`.
- Persist slot metadata through `saveCharacterManagerSlot(...)`.

3. Character Sheet drag/drop (persisted)
- Keep per-character assignment state in Character Manager draft state.
- Persist drop-zone assignments to Supabase character metadata.
- Keep DnD behavior stable (assign/replace/swap) without activation gating.

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
- Drag/drop upload works and fills first available reference slots deterministically.
- Non-image files are rejected with clear message.
- Oversize images are rejected with clear message.
- Deleting one reference clears only that slot and persists.
- Dragging a reference into a Character Sheet zone assigns it.
- Dropping another reference into that same zone replaces it.
- Dragging zone-to-zone swaps assignments.
- Character Sheet assignments persist after refresh and character switching.
- Creating/switching/deleting characters preserves expected per-character state.

## Change Management Rules
- Any change to `/character` behavior must update:
  - `docs/routes.md` (if route behavior changes),
  - this SOP,
  - relevant ADR(s) for durable architecture changes.
- Character Sheet assignments are now generation-driving for AI Studio Create Character Mode; keep integration contracts in this SOP and `docs/sops/sop_image_generation.md` in sync when changing assignment semantics.

## Legacy SOP Status
- `docs/sops/sop_character_generation.md` and `docs/sops/sop_character_identity.md` are legacy references for the old character pipeline and are not authoritative for current `/character` behavior.
