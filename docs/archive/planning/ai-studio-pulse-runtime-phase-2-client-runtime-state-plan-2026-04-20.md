# AI Studio Pulse Runtime Phase 2: Client Runtime State Plan (2026-04-20)

> Archived on 2026-04-26 during docs cleanup because the Pulse runtime program is complete and the active follow-on plan is `docs/planning/ai-studio-standard-vs-pulse-runtime-isolation-execution-plan-2026-04-23.md`.

Status: complete  
Owner: Engineering

## Goal
Move active Pulse behavior from local rail-only preference state into page-level and panel-composition runtime state.

## Primary Repo Surfaces
1. `frontend/pages/ai-studio.tsx`
2. `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
3. `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
4. `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
5. `frontend/features/ai-studio/components/create/ExpertCreatePanelView.tsx`
6. `frontend/features/ai-studio/logic/shellResize.ts`

## Scope
Phase 2 covers:
1. page-level ownership of `activePulseId` and related runtime state,
2. panel-prop composition for Pulse runtime state,
3. clear separation between:
   - saved Pulse definitions,
   - rail selection/layout state,
   - active runtime state.
4. page-level/state-model handling for the locked rail-topology and Pulse-mode shell-semantics decisions.

## Required Outputs
1. an explicit runtime-state model for active Pulse activation,
2. a wiring map from `frontend/pages/ai-studio.tsx` through `useAiStudioPanelProps` into Create surfaces,
3. clear activation/deactivation/switch state transitions,
4. a state model for whichever rail topology is chosen in Phase 0,
5. shell/layout regression notes for Pulse mode behaviors that depend on mode or activation state.

## Implementation Notes
1. `expertCreateMode` is already page-owned and should be treated as the pattern to extend.
2. `activePulseId` must not be hidden inside Create rail hooks.
3. Any remaining local storage from `useCreatePulsePresetPanelPreference.ts` should be narrowed to layout-only concerns if retained at all.
4. Pulse mode and active Pulse runtime are related but not the same state.

## Entry Criteria
1. Phase 1 saved-definition authority is explicit.
2. The page/panel composition seam is accepted as the core client integration path.

## Exit Criteria
1. Pulse runtime state exists at page level.
2. Create surfaces receive active Pulse state via controlled props.
3. Activation, deactivation, and switching semantics are explicit.
4. Shell/layout risk surfaces are documented for later regression testing.

## Validation
1. Confirm a Pulse can be active without relying on composer text mutation.
2. Confirm Pulse mode can render the rail while active Pulse state remains separately addressable.
3. Confirm the client state model is compatible with later snapshot restore.
4. Confirm the chosen Pulse shell semantics do not remain accidental side effects hidden in page-local state.

## Rollback Note
If page-level wiring is unstable, keep Pulse runtime activation disabled and retain current UI-only mode behavior while preserving Create usability.
