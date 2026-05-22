# Character Profile Voice Quarantine

## Status

- Hidden from the Character Profile UI as of 2026-04-08.
- Stored Character Manager voice state remains intentionally dormant for future rollout work.

## Why it is hidden

- Voice is a future feature and should not appear in the current Character Library user experience.
- The current cleanup keeps the profile focused on shipped character data only: image, name, description, references, and preset tabs.

## Current implementation posture

- The visible voice selector and `+ Create Voice` CTA are removed from `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`.
- The dormant selector modal remains in `frontend/features/character-manager/components/CharacterVoiceSelectorModal.tsx` as a quarantine seam for later reactivation.
- `useCharacterManagerDraft` still carries `characterVoice` state so future rollout work can decide whether to reuse, migrate, or replace that persistence path without rebuilding from scratch.

## Reactivation checklist

1. Confirm the product contract for Character Profile voice selection and voice creation.
2. Validate whether the existing `characterVoice` draft field is still the correct persistence model.
3. Re-introduce the UI in `CharacterPanelWorkspace` only after the flow is end-to-end functional.
4. Re-enable or rebuild the selector modal if the shared Voice Library contract is still valid.
5. Update `README.md`, `docs/routes.md`, and `docs/sops/sop_character_manager_operations.md` when the feature is reintroduced.

## Related files

- `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
- `frontend/features/character-manager/components/CharacterVoiceSelectorModal.tsx`
- `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
