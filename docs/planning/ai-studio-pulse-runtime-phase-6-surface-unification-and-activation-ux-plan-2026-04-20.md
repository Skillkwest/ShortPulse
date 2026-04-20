# AI Studio Pulse Runtime Phase 6: Surface Unification, Authoring UX, and Activation UX Plan (2026-04-20)

Status: Planned  
Owner: Engineering

## Goal
Unify Pulse surfaces around the shared definition/runtime contract, ship the Pulse authoring/manage UX, and cut over activation from prompt append to real runtime activation.

## Primary Repo Surfaces
1. `frontend/features/ai-studio/components/PulsePresetsLibraryPanel.tsx`
2. `frontend/features/ai-studio/components/create/CreateExpertPresetPanel.tsx`
3. `frontend/features/ai-studio/components/create/useCreatePulsePresetRuntime.ts`
4. `frontend/features/ai-studio/components/create/useCreatePulseGenerationPresetRuntime.ts`
5. `frontend/features/ai-studio/components/create/ExpertCreatePanelView.tsx`
6. `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`

## Scope
Phase 6 covers:
1. shared saved-definition consumption between the library and Create rail,
2. Pulse authoring/manage UX in the library or equivalent management surface,
3. activation/deactivation/switch behavior in Create,
4. removal of prompt-append activation semantics,
5. active-Pulse UX cues in the Create surface,
6. the final UI expression of the locked rail-topology and Pulse-mode shell-semantics decisions.

## Required Outputs
1. one shared definition source across Pulse surfaces,
2. a coherent Pulse authoring/manage UX for:
   - creating a Pulse,
   - editing Pulse fields,
   - saving changes,
   - deleting or archiving if supported,
   - browsing existing saved Pulses,
3. Pulse activation behavior that sets runtime state instead of mutating `agentInput`,
4. active-Pulse UX treatment, including:
   - active Pulse label,
   - short description,
   - optional starter prompts and badges,
5. switch/deactivate semantics that match the Phase 0 contract.
6. a clear Create-rail expression for whichever topology was chosen:
   - all saved Pulses,
   - or curated rail subset plus full library.
7. the final user-visible behavior for chat/styling affordances while Pulse is active.

## Implementation Notes
1. This is the cutover phase for the current append-only Pulse runtime hooks.
2. Any remaining override/edit behavior in the library must target the same saved Pulse definitions that the Create rail activates.
3. Keep the visible composer clean. The user message should remain the user message.
4. The authoring UX should feel like managing agent profiles, not editing a hidden prompt string blob.

## Entry Criteria
1. Phase 5 server runtime activation is stable enough to drive real Pulse behavior.
2. Shared saved definitions are available for both surfaces.

## Exit Criteria
1. The Pulse library and Create rail resolve from the same saved definitions.
2. Users can create and manage Pulses through the intended authoring surface.
3. Pulse clicks activate runtime state instead of appending prompt text.
4. The Create surface clearly communicates the active Pulse state.
5. Switching and deactivating Pulse follow the explicit V1 contract.

## Validation
1. Confirm Pulse activation changes behavior without changing the visible composer contents.
2. Confirm a saved Pulse edited in the library is the same Pulse activated in Create.
3. Confirm users can create/edit/save a Pulse without drifting into a second definition format or UI authority.
4. Confirm switching/deactivation does not break Create shell/layout behavior.
5. Confirm the final rail topology and shell behavior match the locked Phase 0 product decisions rather than the legacy append-only implementation by accident.

## Rollback Note
If activation UX blocks Create usability, temporarily restore fallback behavior behind a controlled flag while preserving the shared definition authority.
