# AI Studio Standard Vs Pulse Runtime Isolation Execution Plan (2026-04-23)

Status: In Progress  
Owner: Engineering

## Goal
Align AI Studio Create with the intended product behavior:
1. Standard mode and Pulse mode are fully decoupled,
2. Pulse behaves like a custom GPT profile,
3. clicking a Pulse starts it immediately,
4. one authoritative controller owns mode and Pulse runtime behavior,
5. implementation stops when the defined done state is met.

## Why This Is A New Scope
The prior Pulse runtime program is already closed. This scope is not a continuation of that program. It exists because the intended product contract is stricter than the shipped repo behavior in three important ways:
1. Standard versus Pulse isolation is still incomplete,
2. Pulse activation/reset semantics still drift from the intended custom-GPT behavior,
3. Pulse authoring and runtime ownership still expose internal runtime complexity more than the target product model allows.

## Repo-Backed Current-State Problems
1. mode authority is still split across page state, page-content shell behavior, chat/runtime hooks, and rail state,
2. Standard and Pulse still preserve or restore adjacent state in ways that violate the intended isolation boundary,
3. Pulse activation still relies on runtime metadata and transport behavior that do not yet guarantee a clean isolated Pulse session,
4. custom Pulse authoring still exposes internal mechanics such as runtime/activation modes instead of centering the profile contract,
5. the current repo still has multiple active seams that must agree on Pulse behavior:
   - `frontend/pages/ai-studio.tsx`
   - `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
   - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`
   - `frontend/pages/api/ai/studio-agent.ts`

## Locked Product Contract
1. Turning on Pulse mode reveals the Pulse rail.
2. Clicking any Pulse starts it immediately.
3. Standard and Pulse are separate operating modes.
4. Standard and Pulse do not implicitly share transcript history, staged attachments, hidden runtime context, workflow session state, or optional memory.
5. Switching Pulses starts a fresh Pulse session by default.
6. Leaving Pulse mode deactivates Pulse runtime completely.
7. Custom Pulse authoring is centered on:
   - `Name`
   - `System Instructions`
8. Built-in Pulses may use richer workflow behavior internally, but that must remain secondary to the custom-GPT product mental model.

## Transition Table
| Transition | Required Behavior | State Effects |
| --- | --- | --- |
| `enterPulse` | Switch Create into Pulse mode and reveal the Pulse rail. Do not implicitly activate a Pulse. | Preserve Standard state in Standard-owned storage only. Initialize Pulse-mode shell state with no active Pulse runtime. |
| `activatePulse(preset)` | Activate the selected Pulse and start it immediately. | Set `activePulseId`, create a fresh Pulse session, clear prior Pulse transcript/attachments/workflow state, send the kickoff turn, and keep Standard state untouched. |
| `switchPulse(nextPreset)` | End the current Pulse session and start the new Pulse immediately. | Replace `activePulseId`, discard prior Pulse runtime state, create a fresh Pulse session for the new preset, and keep Standard state untouched. |
| `clear` in Standard | Clear only Standard-mode transcript/runtime state. | Remove Standard transcript/attachments/runtime state. Leave Pulse state untouched and inactive. |
| `clear` in Pulse | Clear the current Pulse session and deactivate the active Pulse. | Remove Pulse transcript/attachments/workflow state, clear `activePulseId`, and leave Pulse mode active with the rail visible but no active Pulse runtime. |
| `restartPulse` | Restart the currently active Pulse immediately. | Keep Pulse mode active, preserve the selected Pulse id, clear current Pulse session state, and start a fresh session for that same Pulse. |
| `deactivatePulse` | Explicitly stop the active Pulse without leaving Pulse mode. | Clear `activePulseId`, clear Pulse transcript/attachments/workflow state, and leave Pulse mode active with no active Pulse runtime. |
| `exitPulse` | Leave Pulse mode and return to Standard mode. | Deactivate any active Pulse, clear Pulse runtime state, hide the Pulse rail, and restore only Standard-owned state. No Pulse transcript or hidden runtime context carries back into Standard. |

## Non-Goals
1. No broad AI Studio redesign outside the Standard/Pulse contract.
2. No general-purpose multi-agent platform.
3. No durable cross-Pulse memory in this scope unless a later explicit scope opens it.
4. No continuation by adjacency into unrelated AI Studio cleanup once the done state is met.

## Target Architecture
1. `CreateModeRuntimeController`
   - source of truth for active mode, active Pulse id, mode transitions, reset semantics, and Pulse session ownership.
2. `StandardRuntimeAdapter`
   - isolated Standard-mode transcript/runtime behavior.
3. `PulseRuntimeAdapter`
   - isolated Pulse-mode transcript/runtime behavior for the active Pulse profile.
4. `SubmissionRouter`
   - code-owned dispatch to the correct runtime path.
5. optional internal `SpecialistWorkers`
   - bounded internal helpers for built-in Pulses only when decomposition is clearly justified.
6. `Verifier/Judge`
   - schema and correctness check before committing important final artifacts for complex workflow Pulses.

## Source-Of-Truth Inventory To Land
This scope is not complete until each item below has one explicit owner:
1. active mode owner,
2. active Pulse runtime owner,
3. transcript/session owner for Standard,
4. transcript/session owner for Pulse,
5. saved Pulse-definition owner,
6. submission-path authority owner,
7. session restore authority owner.

## Compatibility And Migration Requirements
1. Existing saved Pulses using legacy activation semantics must migrate or be interpreted safely under the new click-to-start contract.
2. Older snapshots must either hydrate safely into the new mode/runtime controller or fail closed with an explicit fallback posture.
3. Transitional duplicate semantics must be deleted once the new controller is authoritative.
4. Legacy persisted Pulse metadata (`prompt_editor`, `activate_only`, `apply_prompt`) is compatibility input only; every active runtime boundary must normalize those values to `workflow_gpt`, `activate_and_start`, and `chat_reply`.

## Failure Policy Requirements
1. Pulse kickoff failure must produce a deterministic UI/runtime fallback instead of silently leaving a half-active Pulse.
2. Invalid workflow state must fail closed with explicit reset/retry behavior.
3. Runtime-versus-persisted-state disagreement must resolve through one authoritative reconciliation path.

## Performance Budget Requirements
1. Pulse click-to-start first-turn latency must remain bounded and observable.
2. Built-in workflow Pulses must justify any additional latency/cost beyond Standard mode.
3. Performance regressions are not acceptable tradeoffs for mode-isolation correctness unless explicitly approved.

## Execution Phases

### Phase 0: Contract Lock
Deliverables:
1. ADR for Standard versus Pulse runtime isolation and activation semantics.
2. Execution plan with migration, done state, and stop rule.
3. Transition table for:
   - `enterPulse`
   - `exitPulse`
   - `activatePulse`
   - `switchPulse`
   - `clear`
   - `restart`
   - `deactivatePulse`

### Phase 1: State Authority Extraction
Goals:
1. introduce one authoritative mode/runtime controller,
2. move mode transitions and Pulse runtime ownership under that controller,
3. decouple active Pulse runtime from rail-selection-only state.

### Phase 2: Hard Session Isolation
Goals:
1. separate Standard and Pulse transcript state,
2. separate staged attachments/runtime state,
3. separate workflow session state,
4. remove implicit Standard-to-Pulse and Pulse-to-Standard leakage.

### Phase 3: Pulse Activation Contract
Goals:
1. enforce click-to-start Pulse activation,
2. make deactivate/reset behavior explicit,
3. remove or retire user-facing legacy activation semantics.

### Phase 4: Pulse Authoring Simplification
Goals:
1. make `Name` and `System Instructions` primary,
2. demote or hide internal runtime/workflow knobs for ordinary custom Pulse creation,
3. keep built-in workflow metadata available only where necessary.

### Phase 5: Unified Runtime Routing
Goals:
1. ensure all active submission paths obey the same Pulse contract,
2. make blank-session Pulse kickoff reliable,
3. keep Pulse system instructions server-visible while Standard remains Pulse-free.

### Phase 6: Built-In Workflow Pulse Reliability
Goals:
1. make built-in guided Pulses reliable under the new controller,
2. support explicit step progression and completion,
3. keep any internal specialist-worker usage bounded and invisible by default.

### Phase 7: Evals, Telemetry, And Closeout
Goals:
1. prove isolation, activation, workflow completion, and failure handling by tests and telemetry,
2. record rollout/rollback posture,
3. close the scope once the done state is achieved.

## Validation Matrix
The scope requires automated coverage for:
1. mode isolation across Standard to Pulse and Pulse to Standard transitions,
2. click-to-start activation on a blank session,
3. switch Pulse starts fresh,
4. clear/restart/deactivate semantics,
5. session restore for both modes,
6. built-in workflow Pulse completion,
7. route-path parity while Pulse is active.

## Telemetry And Eval Requirements
Track and review:
1. Pulse activation success rate,
2. blank-session kickoff success rate,
3. mode-switch leakage regressions,
4. workflow completion rate,
5. clear/restart/deactivate failure rate,
6. first-turn latency and cost deltas for Standard versus Pulse.

## Done State
This scope is done when all of the following are true:

1. Standard and Pulse are truly isolated by runtime behavior and tests.
2. Clicking any Pulse starts it immediately and reliably.
3. Switching Pulses starts a fresh Pulse session by default.
4. Leaving Pulse mode deactivates Pulse runtime completely.
5. One controller is the explicit source of truth for mode and Pulse runtime ownership.
6. Transitional duplicate ownership paths have been removed.
7. Custom Pulse authoring matches the custom-GPT mental model.
8. All active submission paths obey the same Pulse contract or are explicitly disabled while Pulse is active.
9. Built-in workflow Pulses can activate, progress, pause, complete, and recover deterministically.
10. Backward compatibility posture is resolved for saved Pulses and snapshots.
11. Tests, telemetry, and docs cover the final contract.

## Current Gap Review (2026-04-23)
Done-state status after the current implementation slices:

Completed or substantially complete:
1. Standard and Pulse runtime/session isolation is implemented and covered by targeted tests.
2. Clicking any Pulse starts it immediately, including blank-session activation-seed kickoff.
3. Switching Pulses clears the active Pulse workflow session and starts the newly selected Pulse.
4. Leaving Pulse mode deactivates Pulse runtime, and Pulse mode now has an explicit `Deactivate Pulse` affordance.
5. One controller owns Create mode, active Pulse id, and Pulse workflow session state.
6. Mode-switch-adjacent Create chat restoration is page/runtime-owned now; `AiStudioPageContent` no longer forces Pulse chat transitions itself.
7. Custom Pulse authoring now follows the custom-GPT mental model (`Name + System Instructions`, advanced settings secondary).
8. Active submission/runtime boundaries now normalize onto the same guided Pulse contract, including legacy metadata compatibility input.
9. Built-in workflow Pulses have deterministic activation/progression/completion handling with persistence coverage.
10. Backward compatibility posture is resolved at the runtime boundary for saved Pulses and snapshots.

Still open before closeout:
1. Run the final explicit done-state audit after the public-facing route note is aligned so the closeout decision is based on the exact shipped repo state, not intermediate implementation slices.

## Final Done-State Audit (2026-04-23)
Audit result: done-state achieved for this scope.

Evidence:
1. Standard and Pulse runtime/session isolation is implemented in the Create mode runtime controller, agent bridge runtime scoping, snapshot persistence/hydration, and the page-owned Pulse chat transition shim.
2. Clicking a Pulse now starts it immediately, including blank-session activation-seed turns.
3. Switching Pulses starts a fresh Pulse runtime session, and Pulse deactivation is explicit in the Create surface.
4. Custom Pulse authoring is centered on `Preset Name` plus `System Instructions`, with advanced settings secondary.
5. Legacy Pulse metadata remains compatibility input only and is normalized to the guided GPT-style contract at runtime boundaries.
6. Public-facing docs now describe the shipped Pulse contract: `README.md` already reflected the guided Pulse model, and `docs/routes.md` no longer describes `prompt_editor` / conditional-start behavior as the active product path.
7. Validation for the closing slices passed: `npm run docs:check`, `npm run type-check`, and targeted Pulse runtime/shell suites.

Closeout:
1. This plan is complete.
2. The done state has been met, so implementation on this scope must stop.
3. Any further Pulse work should be opened as a new scope, not treated as a continuation of this plan.

## Stop Rule
When every done-state item above is true:
1. this scope is complete,
2. implementation must stop,
3. any request to "keep going" on this same scope should be treated as adjacency drift unless it opens a clearly new problem statement,
4. the correct closeout message is:
   - "This plan is complete. The done state has been met, so I am stopping here. Any further work should be opened as a new scope, not a continuation of this one."

## Rollback Posture
If implementation destabilizes Create mode behavior:
1. restore the last known-good Standard-mode runtime behavior,
2. keep Pulse disabled behind a narrow gate rather than shipping partial isolation,
3. prefer reverting to one coherent previous contract over leaving mixed old/new semantics alive.
