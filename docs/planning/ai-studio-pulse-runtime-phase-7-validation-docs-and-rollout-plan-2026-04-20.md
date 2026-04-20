# AI Studio Pulse Runtime Phase 7: Validation, Docs, and Rollout Plan (2026-04-20)

Status: Planned  
Owner: Engineering

## Goal
Close the Pulse runtime program with validation, durable docs, and rollout controls that match the new Pulse authoring and runtime contract.

## Primary Repo Surfaces
1. `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`
2. `frontend/features/ai-studio/components/__tests__/PulsePresetsLibraryPanel.test.tsx`
3. `frontend/features/ai-studio/components/create/__tests__/CreateExpertPresetPanel.test.tsx`
4. `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
5. `frontend/tests/api/studio-agent.runtime.test.ts`
6. `README.md`
7. `docs/routes.md`
8. `docs/sops/sop_ai_studio_index.md`
9. `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
10. `docs/sops/sop_ai_studio_agent_chat_ops.md`

## Scope
Phase 7 covers:
1. regression coverage for all new Pulse runtime seams,
2. regression coverage for Pulse authoring/manage flows,
3. doc updates that remove stale local-only and append-only behavior claims,
4. rollout gates and fallback posture,
5. explicit supported-user guidance for V1 Pulse behavior,
6. telemetry/eval posture for Pulse runtime quality and fallback behavior.

## Required Outputs
1. tests covering:
   - saved-definition persistence,
   - create/edit/save/manage authoring flow,
   - page/panel runtime wiring,
   - snapshot restore,
   - request propagation,
   - server runtime behavior,
   - shell/layout regressions,
   - Create/library surface unification.
2. doc updates covering:
   - routes/indexes,
   - AI Studio SOPs,
   - Create Pulse behavior,
   - agent chat behavior if Pulse mode semantics changed.
3. a rollout note that states whether Pulse is:
   - fully enabled,
   - flag-gated,
   - or partially staged.
4. telemetry/eval notes covering:
   - Pulse activation and deactivation,
   - Pulse resolution success/fallback rates,
   - authoring-flow success/failure surfaces,
   - any explicit manual verification/eval packet required for closeout.

## Implementation Notes
1. Do not leave any docs claiming that Pulse is still just local append behavior once cutover lands.
2. Keep rollout gated if evidence is incomplete.
3. If V1 custom-GPT-equivalent language is used externally, it must match actual runtime behavior.

## Entry Criteria
1. Phases 0-6 are complete.
2. The runtime contract and UX contract are stable enough to document.

## Exit Criteria
1. Regression coverage exists for the new Pulse runtime seams.
2. Regression coverage exists for the Pulse authoring/manage workflow.
3. Docs reflect the real runtime behavior.
4. Rollout posture is explicit.
5. The final program done state is satisfied.
6. The program is explicitly marked complete and no further implementation work remains inside the locked V1 scope.
7. Telemetry/eval posture is explicit enough to observe Pulse behavior after rollout.

## Validation
1. Confirm all docs that previously described local-only/append-only Pulse behavior are updated or explicitly archived.
2. Confirm the test matrix covers both activation and restore flows.
3. Confirm rollout gates can disable the new runtime path if regressions appear.
4. Confirm the completion state is explicit enough that later requests to "continue" can be rejected as out of scope unless they define a new program.

## Completion Stop Rule
When this phase exits successfully:
1. treat the overall Pulse runtime program as complete,
2. stop implementation work for this program,
3. if asked to continue the same program later without a new scope, remind the user that the program is done and stop.

## Rollback Note
If evidence is incomplete, keep Pulse runtime gated and revert user-facing documentation to the last confirmed behavior.
