# AI Studio Pulse Runtime Tracker (2026-04-20)

Last updated: 2026-04-23
Status: Complete
Owner: Engineering

## Tracker Rules
1. Do not mark a phase complete unless code, tests, docs, and cleanup obligations for that phase are complete.
2. Do not treat saved Pulse definitions, active Pulse runtime state, and server runtime behavior as one merged concern. Each must have an explicit authority surface.
3. Do not let the Create rail and Pulse library diverge once Phase 1 begins.
4. Do not allow prompt-append fallback semantics to survive past the Phase 6 cutover.
5. Do not ship session restore behavior for Pulse unless schema and hydrator compatibility are explicit.
6. Do not treat runtime activation as sufficient if the Pulse creation and management workflow is still under-specified or missing.
7. Do not let Pulse rely on one runtime path while a second non-Pulse-aware submission path remains available in Create without an explicit decision.
8. Do not treat restore as done unless it aligns with the broader AI Studio session-persistence policy and feature flags.
9. This tracker is the operational source of truth for the Pulse runtime program.
10. When the master-plan done state is met and Phase 7 exit criteria are satisfied, the program is complete and no further implementation work should be scheduled under this tracker.
11. If someone later asks to continue the same program without introducing a new separately scoped problem statement, remind them that this tracker is complete and stop.

## Planning-Task Done State
The planning task is done when:
1. the master plan, tracker, decision log, and all eight phase plans are published,
2. `docs/README.md` and `docs/planning/README.md` reference the full plan set,
3. `docs/change_log.md` records the publication of the plan set,
4. the plan set defines the V1 stop rules, phase ordering, and final program done state.

## Program Done-State Enforcement
The implementation program is considered complete only when:
1. all phase exit criteria are satisfied,
2. the master-plan done state is satisfied in full,
3. the final rollout/documentation posture is explicit,
4. the remaining status for this tracker is `Complete`, not `In Progress` or `Open for follow-up`.

Once those conditions are true:
1. stop work on this program,
2. do not reopen it by momentum or adjacency,
3. require a new, explicitly separate scope before doing more implementation work in this area.

## Program Phases

| Phase | Status | Goal | Entry Criteria | Exit Criteria | Rollback Note |
| --- | --- | --- | --- | --- | --- |
| 0 | Complete | Lock the V1 Pulse contract, naming, stop rules, product decisions, and recommended implementation defaults before implementation begins. | Repo audit findings accepted as baseline. | V1 Pulse scope, naming, storage decision branch, activation inheritance, memory posture, rail topology, shell semantics, bypass policy, multimodal-context posture, and recommended defaults are explicit. | If agreement is not reached, keep current Pulse behavior documented as baseline and do not start implementation. |
| 1 | Complete | Establish the authoritative Pulse domain model, saved-definition storage path, and authoring contract for creating/managing Pulses. | Phase 0 decisions are explicit. | One `PulseDefinition` model, one persistence authority, and one explicit authoring contract exist for both Create and library surfaces. | Keep the current local-only systems isolated and documented rather than partially merging them. |
| 2 | Complete | Add active Pulse runtime state at the page and panel-composition layers. | Phase 1 schema and storage direction are explicit. | `activePulseId` and related runtime state exist outside local rail-only preferences and flow through page/panel composition. | Revert to UI-only Pulse mode and keep runtime activation disabled if page-level state wiring proves unstable. |
| 3 | Complete | Persist Pulse runtime state in the session snapshot contract. | Phase 2 runtime state exists at page level. | Session schema and hydrator support active Pulse restoration without duplicating Pulse definitions in snapshots. | Leave restore behavior disabled and retain non-Pulse snapshot behavior if schema compatibility is not stable. |
| 4 | Complete | Thread Pulse metadata through the agent request path end to end. | Phase 3 persistence contract is explicit. | Agent context, request payload, transport, and route envelope all carry Pulse runtime metadata. | Keep server behavior unchanged and block Pulse activation from runtime use if request propagation is incomplete. |
| 5 | Complete | Make the server runtime profile-aware while preserving the current prompt-compiler architecture and resolving how Pulse interacts with the direct OpenAI bypass path. | Phase 4 request propagation is in place. | `/api/ai/studio-agent` and any active Pulse submission path resolve Pulse behavior server-side or Pulse explicitly disables incompatible paths. | Revert to the prior generic runtime path and keep Pulse hidden behind a flag if behavior drift appears. |
| 6 | Complete | Unify Pulse surfaces, ship the Pulse authoring/manage UX, and cut over Create activation from prompt append to runtime activation. | Phase 5 server behavior is stable enough to drive the UI. | Create rail and Pulse library use the same saved definitions, users can create/manage Pulses through the intended authoring surface, Pulse activation no longer mutates the visible composer, and rail topology/shell semantics match the locked Phase 0 contract. | Restore append-only behavior temporarily only behind a controlled fallback if activation UX or authoring UX blocks core Create usage. |
| 7 | Complete | Close the program with tests, docs, support posture, telemetry/eval posture, and explicit user-facing guidance for both authoring and runtime behavior. | Phases 0-6 are complete. | Tests, docs, telemetry/eval notes, and support posture all match the Pulse authoring and runtime contract. | Revert user-facing claims to the last confirmed behavior and record any remaining external blockers explicitly if closeout evidence is incomplete. |

## Current Locked Findings
1. Create Pulse selection is currently composed from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`.
2. Create Pulse runtime hooks still mutate composer input instead of runtime state.
3. The Pulse library panel is local-only and does not control runtime behavior.
4. The current plan must cover Pulse authoring/build/manage UX as first-class scope, not just runtime activation.
5. Pulse mode already has shell/layout side effects that must be retested and explicitly either preserved or changed as part of the V1 contract.
6. The direct OpenAI bypass path is part of the real Create runtime and cannot be ignored by the Pulse plan.
7. Session snapshot/hydrator work is a schema evolution task, but restore behavior is also subject to the broader AI Studio session-persistence policy and flags.
8. The transport seam includes `useAiAgent`, the client transport, and the route envelope. Updating types alone is not sufficient.
9. V1 should remain a profile-aware prompt runtime, not a full multi-agent system.
10. External agent guidance points toward explicit state, bounded tools, approvals at tool boundaries, and trace/eval visibility; the plan must either implement or explicitly defer each.

## Current Implementation Snapshot (2026-04-23)
1. Saved Pulse definitions, Create rail allocation, and built-in override editing now resolve through one shared persistence model.
2. Pulse activation is runtime-backed and no longer mutates the visible Create composer.
3. `workflow_gpt` Pulses support guided multi-turn chat flows, auto-start behavior, persisted workflow-session state, and completed-artifact reuse.
4. Direct bypass and orchestrated `/api/ai/studio-agent` paths are both Pulse-aware.
5. The remaining tracker work sits in Phase 7 closeout, not in the core runtime architecture.

## Final Tracker Closeout (2026-04-23)
1. Explicit Pulse telemetry/eval posture is documented in `docs/monitoring.md` and the Phase 7 closeout plan.
2. The pre-existing `docs/routes.md` semantic-drift failure is recorded as a separate repo-wide docs-governance issue outside Pulse scope.
3. The master-plan done-state audit is now fully satisfied, so this tracker is `Complete`.

## Phase Links
1. `docs/planning/ai-studio-pulse-runtime-master-plan-2026-04-20.md`
2. `docs/planning/ai-studio-pulse-runtime-decision-log-2026-04-20.md`
3. `docs/planning/ai-studio-pulse-runtime-phase-0-v1-contract-and-stop-rules-plan-2026-04-20.md`
4. `docs/planning/ai-studio-pulse-runtime-phase-1-domain-model-and-storage-plan-2026-04-20.md`
5. `docs/planning/ai-studio-pulse-runtime-phase-2-client-runtime-state-plan-2026-04-20.md`
6. `docs/planning/ai-studio-pulse-runtime-phase-3-session-persistence-plan-2026-04-20.md`
7. `docs/planning/ai-studio-pulse-runtime-phase-4-agent-contract-and-transport-plan-2026-04-20.md`
8. `docs/planning/ai-studio-pulse-runtime-phase-5-server-runtime-activation-plan-2026-04-20.md`
9. `docs/planning/ai-studio-pulse-runtime-phase-6-surface-unification-and-activation-ux-plan-2026-04-20.md`
10. `docs/planning/ai-studio-pulse-runtime-phase-7-validation-docs-and-rollout-plan-2026-04-20.md`
