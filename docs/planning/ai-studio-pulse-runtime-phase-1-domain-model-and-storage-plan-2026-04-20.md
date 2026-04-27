# AI Studio Pulse Runtime Phase 1: Domain Model, Storage, and Authoring Contract Plan (2026-04-20)

Status: complete  
Owner: Engineering

## Goal
Establish the authoritative saved-definition model for Pulse, choose the persistence path that both the library and Create rail will use, and lock the authoring contract for creating and managing Pulses.

## Primary Repo Surfaces
1. `frontend/pages/ai-studio.tsx`
2. `frontend/features/ai-studio/components/PulsePresetsLibraryPanel.tsx`
3. `frontend/features/ai-studio/components/create/createPulsePresets.ts`
4. `frontend/features/ai-studio/hooks/useCreatePulsePresetPanelPreference.ts`
5. `frontend/features/ai-studio/hooks/useExpertEditPresetPanelPreference.ts`

## Scope
Phase 1 covers:
1. the `PulseDefinition` schema,
2. the persistence authority for saved Pulse definitions,
3. migration strategy away from local-only Pulse catalogs,
4. read/write ownership boundaries between the library and Create surfaces,
5. the authoring contract for build/configure/save/manage behavior.

## Required Outputs
1. a written `PulseDefinition` contract, including:
   - `id`
   - `name`
   - `description`
   - `instructions`
   - `starterPrompts`
   - `modelDefaults`
   - `toolPolicy`
   - `visibility`
   - `version`
2. a chosen storage authority:
   - `user_preferences` extension with sync semantics, or
   - dedicated Pulse persistence.
3. a migration note for current local-only Pulse definitions and overrides.
4. an explicit statement of which remaining local storage, if any, is only layout/UI preference state.
5. a written authoring contract covering:
   - create,
   - edit,
   - save,
   - duplicate if supported,
   - delete/archive behavior,
   - where starter prompts, instructions, tool policy, and model defaults are edited.

## Implementation Notes
1. Reuse the Expert Edit preset persistence pattern where it reduces risk.
2. Do not let `PulsePresetsLibraryPanel.tsx` continue owning a separate fake catalog once this phase is complete.
3. Keep saved-definition persistence independent from active runtime/session state.
4. The authoring contract should support the future ChatGPT-custom-GPT-style build/configure workflow even if V1 launches with a narrower UI.

## Entry Criteria
1. Phase 0 decisions are explicit.
2. The current local-only Pulse systems are accepted as transitional, not authoritative.

## Exit Criteria
1. One `PulseDefinition` schema exists.
2. One saved-definition authority exists.
3. Library and Create consumption paths can converge on that authority.
4. Remaining local storage use is clearly limited to UI preference concerns, if any.
5. The Pulse authoring workflow contract is explicit enough to drive UI work in later phases.

## Validation
1. Confirm the same saved Pulse can be rendered in both the library and the Create rail without transformation drift.
2. Confirm the schema is sufficient for V1 runtime activation without adding ad hoc fields later.
3. Confirm the chosen storage path is compatible with the repo's existing preference-sync and user isolation rules.
4. Confirm a user-facing create/edit/save/manage flow can be implemented without inventing a second Pulse data shape later.

## Rollback Note
If the shared persistence authority is not stable enough, keep the current systems isolated and documented instead of partially merging them.
