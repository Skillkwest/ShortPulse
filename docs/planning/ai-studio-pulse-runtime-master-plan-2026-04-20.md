# AI Studio Pulse Runtime Master Plan (2026-04-20)

Last updated: 2026-04-23
Status: Complete
Owner: Engineering

## Summary
This program upgrades AI Studio Pulse from a local prompt-append helper into a first-class saved agent-profile runtime for Expert Create.

The repo audit shows three disconnected Pulse surfaces today:
1. the inline Create Pulse rail,
2. the local-only Pulse library panel,
3. the generic AI Studio agent/runtime path.

The program goal is to unify those surfaces around one saved `PulseDefinition`, one explicit Pulse authoring workflow, one active Pulse runtime per Create session, and one server-visible runtime contract that changes hidden agent behavior without polluting the visible composer.

## Program Outcomes
1. Pulse becomes a saved Create agent profile, not a preset text snippet.
2. Users can create, edit, save, and manage Pulses through an explicit authoring workflow rather than ad hoc local preset edits.
3. One active Pulse can be activated, restored, deactivated, and switched per Create session.
4. The Create rail and Pulse library use the same definition store.
5. The session snapshot persists Pulse runtime state separately from saved Pulse definitions.
6. The AI Studio agent route becomes Pulse-aware while staying inside the current prompt-compiler architecture for V1.
7. Docs, tests, and rollout gates are updated alongside implementation.

## Current-State Audit Summary
1. `frontend/features/ai-studio/components/create/useCreatePulsePresetRuntime.ts` still applies Pulse by mutating `agentInput`.
2. `frontend/features/ai-studio/components/PulsePresetsLibraryPanel.tsx` owns a separate local-only Pulse catalog that does not drive Create runtime behavior.
3. `frontend/pages/ai-studio.tsx` still instantiates local Create Pulse preference state and passes it into `useAiStudioPanelProps`.
4. `frontend/features/ai-studio/logic/sessionSnapshot.ts` and `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts` do not persist `activePulseId` or Pulse activation metadata.
5. `frontend/prefabs/agent/types.ts`, `frontend/features/ai-agent/logic/contextBuilder.ts`, `frontend/features/ai-agent/useAiAgent.ts`, `frontend/features/ai-agent/client/studioAgentTransport.ts`, and `frontend/features/agent-runtime/studioAgentRouteEnvelope.ts` do not carry Pulse runtime metadata.
6. `frontend/pages/api/ai/studio-agent.ts` and `frontend/lib/agentPromptsConfig.ts` are still prompt-compiler-oriented and need a profile-aware runtime layer for V1.
7. The Create chat lane can route through the direct OpenAI bypass path, whose current system prompt is static and not Pulse-aware.
8. Pulse mode currently forces Create chat mode on and hides the Styles affordance/right-rail Styles toggle, but the plan has to decide whether those semantics remain part of the V1 Pulse contract.
9. The current inline rail has a distinct "selected panel preset ids" shape plus a `More Presets` surface, so the plan must decide whether the Create rail shows all saved Pulses or a curated subset such as pinned/favorited/recent Pulses.
10. AI Studio session persistence/restore is governed by broader feature flags and docs posture, so Pulse restore cannot be planned as unconditional behavior independent of the global session-persistence policy.

## Locked Direction
1. V1 Pulse is a profile-aware runtime layered on top of the existing AI Studio agent path. It is not a full multi-agent rebuild.
2. A Pulse click must activate hidden runtime behavior. It must not paste instructions into the visible composer.
3. One active Pulse at a time is the only supported V1 runtime posture.
4. Saved Pulse definitions and active Pulse runtime state are separate concerns and must stay separate in persistence.
5. The Pulse creation flow is part of the core program scope. V1 is not done if runtime activation works but users still lack a coherent build/configure/save/manage workflow.
6. Pulse work must reuse existing repo patterns where they are already stronger than the current Create Pulse implementation, especially Expert Edit preset persistence and controlled panel-prop composition.

## Key Product Decisions To Lock Before Implementation
1. Storage shape:
   - extend the existing `user_preferences` pattern first, or
   - introduce a dedicated Pulse store immediately.
2. Activation inheritance:
   - fresh Pulse session on activation, or
   - inherit current Create prompt/chat/context.
3. V1 memory scope:
   - session-only by default, or
   - reusable Pulse-scoped memory.
4. Create rail topology:
   - show all saved Pulses, or
   - show a curated subset and use the library as the full-management surface.
5. Pulse mode shell semantics:
   - keep chat-mode force-on and Styles suppression, or
   - relax those rules for the Pulse runtime.
6. Runtime submission posture:
   - route Pulse through the existing direct OpenAI bypass path,
   - disable bypass while Pulse is active,
   - or make the bypass path Pulse-aware.
7. Multimodal/runtime context policy:
   - what current attachments, references, and workspace context an active Pulse can see,
   - and whether any of that differs between generic agent mode and Pulse mode.
8. Authoring UX minimum:
   - whether V1 must include preview/test-before-save and revision/version-history affordances,
   - or whether those are explicitly deferred.

## Recommended V1 Defaults
The recommended default posture for implementation start is:
1. extend `user_preferences` first for saved Pulse-definition persistence,
2. inherit current Create workspace context on activation, but not full historical chat by default,
3. keep memory session-scoped in V1,
4. use a curated Create rail subset plus the full Pulse library,
5. keep Pulse chat-mode force-on and Styles suppression in V1,
6. disable the direct OpenAI bypass path while Pulse is active in V1,
7. allow current Create attachments/references/workspace context while keeping hidden Pulse runtime state out of model-visible history,
8. include create/edit/save/manage in V1 authoring, while explicitly deferring preview/test-before-save and revision/version-history.

## V1 Stop Rules
1. Do not expand V1 into a swarm or uncontrolled handoff system.
2. Do not let the local-only Pulse library remain a second source of truth once runtime work begins.
3. Do not duplicate saved Pulse definitions into session snapshots.
4. Do not change shell/layout behavior without regression coverage for Pulse mode transitions and restore flows.
5. Do not update user-facing docs to claim custom-GPT-equivalent behavior until the runtime contract is real end to end.
6. When the program done state is achieved, stop working on this program immediately unless a new, separately scoped problem statement is opened.
7. If a follow-up request tries to continue this program after the done state has been achieved, treat that request as accidental by default, remind the user that the program is already done, and do not continue implementation.
8. Do not land a Pulse runtime that only works on one submission path if Create can still route through a second non-Pulse-aware path.
9. Do not promise Pulse restore unless it respects the broader AI Studio session-persistence gates and documented rollout posture.
10. Do not ship V1 without basic observability for Pulse activation, resolution, fallback, and failure behavior.

## Phase Sequence
| Phase | Title | Status | Priority |
| --- | --- | --- | --- |
| 0 | V1 Contract and Stop Rules | Complete | P0 |
| 1 | Domain Model, Storage, and Authoring Contract | Complete | P0 |
| 2 | Client Runtime State Wiring | Complete | P0 |
| 3 | Session Persistence Contract | Complete | P0 |
| 4 | Agent Contract and Transport | Complete | P0 |
| 5 | Server Runtime Activation | Complete | P0 |
| 6 | Surface Unification, Authoring UX, and Activation UX | Complete | P0 |
| 7 | Validation, Docs, and Support Posture | Complete | P1 |

## Phase Links
1. `docs/planning/ai-studio-pulse-runtime-phase-0-v1-contract-and-stop-rules-plan-2026-04-20.md`
2. `docs/planning/ai-studio-pulse-runtime-phase-1-domain-model-and-storage-plan-2026-04-20.md`
3. `docs/planning/ai-studio-pulse-runtime-phase-2-client-runtime-state-plan-2026-04-20.md`
4. `docs/planning/ai-studio-pulse-runtime-phase-3-session-persistence-plan-2026-04-20.md`
5. `docs/planning/ai-studio-pulse-runtime-phase-4-agent-contract-and-transport-plan-2026-04-20.md`
6. `docs/planning/ai-studio-pulse-runtime-phase-5-server-runtime-activation-plan-2026-04-20.md`
7. `docs/planning/ai-studio-pulse-runtime-phase-6-surface-unification-and-activation-ux-plan-2026-04-20.md`
8. `docs/planning/ai-studio-pulse-runtime-phase-7-validation-docs-and-rollout-plan-2026-04-20.md`

## Done State
The program is done when:
1. a user can create, edit, save, and manage a Pulse through an explicit authoring workflow,
2. a saved Pulse definition resolves as the only source of truth across the library and Create rail,
3. activating a Pulse sets hidden runtime behavior instead of appending prompt text,
4. active Pulse runtime state persists across session save/restore,
5. the AI Studio agent request path and server runtime are Pulse-aware,
6. any active submission path available to Pulse users is Pulse-aware or explicitly disabled while Pulse is active,
7. switching/deactivating Pulse behaves predictably in Create without shell regressions,
8. Pulse restore behavior, if enabled, respects the broader AI Studio session-persistence policy and flags,
9. tests, telemetry, and docs cover both the authoring workflow and the runtime contract, and remove stale local-only/append-only claims,
10. the rollout posture is explicit and any remaining fallback gates are either intentionally retained and documented or removed,
11. the final implementation matches the locked V1 scope without unresolved pressure to continue by adjacency.

## Done-State Audit (2026-04-23)
Current program posture against the done state:
1. `Met` — users can create, edit, save, and manage Pulses through the Pulse library and Create surfaces.
2. `Met` — saved Pulse definitions are the shared source of truth across the library and Create rail.
3. `Met` — Pulse activation now changes hidden runtime behavior and no longer appends prompt text into the visible composer.
4. `Met` — active Pulse runtime state, including workflow-session state, persists across AI Studio session save/restore.
5. `Met` — the AI Studio agent request path and server runtime are Pulse-aware.
6. `Met` — the active Create submission paths exercised by Pulse users are Pulse-aware, including the direct OpenAI bypass branch.
7. `Met` — switching/deactivating Pulse is predictable in Create and covered by targeted regression tests.
8. `Met` — Pulse restore remains aligned with the broader AI Studio session-persistence policy and feature-flag posture.
9. `Met` — tests, telemetry/eval notes, and docs now cover the authoring workflow and runtime contract, and stale local-only/append-only claims have been removed.
10. `Met` — the support posture is explicit and the lingering `docs/routes.md` failure is documented as a separate repo-wide docs-governance issue outside Pulse scope.
11. `Met` — the final implementation now matches the locked V1 scope with no justified remaining implementation work inside this program.

## Final Closeout Decision
The Pulse runtime program is complete.

Closeout notes:
1. Pulse telemetry/eval posture is now documented explicitly in `docs/monitoring.md` and the Phase 7 plan.
2. The pre-existing `docs/routes.md` semantic-drift failure remains a repo-wide docs-governance issue, but it is not a Pulse-runtime blocker and does not prevent this program from reaching its done state.
3. Further work in this area now requires a new, explicitly separate scope instead of continuing this program by momentum.

## Completion Stop Rule
When all done-state criteria above are true:
1. the Pulse runtime program is complete,
2. implementation work for this program must stop,
3. any later prompt to "keep going" on this same program should be treated as a likely mistake unless it introduces a new, explicitly separate scope,
4. the correct response is to remind the user that this program is already complete and stop further work on it.
