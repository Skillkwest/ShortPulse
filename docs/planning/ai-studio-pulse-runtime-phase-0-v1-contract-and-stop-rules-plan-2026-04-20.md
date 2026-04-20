# AI Studio Pulse Runtime Phase 0: V1 Contract and Stop Rules Plan (2026-04-20)

Status: Planned  
Owner: Engineering

## Goal
Lock the V1 Pulse contract before any behavior-changing implementation lands.

## Scope
Phase 0 must explicitly decide:
1. what a saved Pulse is in product and runtime terms,
2. the naming contract between saved definitions, runtime state, library UI, and mode UI,
3. the storage decision branch for saved Pulse definitions,
4. whether Pulse activation starts fresh or inherits current Create context,
5. the V1 memory posture,
6. the Create rail topology,
7. the Pulse mode shell semantics,
8. the runtime-path posture,
9. the multimodal/context posture,
10. the V1 authoring UX minimum,
11. the V1 stop rules and non-goals.

## Required Decisions
1. Domain naming:
   - `PulseDefinition`
   - `PulseLibrary`
   - `PulseMode`
   - `ActivePulseRuntime`
2. V1 scope posture:
   - profile-aware runtime only,
   - no swarm,
   - one active Pulse at a time.
3. Storage branch:
   - extend `user_preferences`, or
   - dedicated Pulse store.
4. Activation inheritance:
   - fresh Pulse session, or
   - inherit current Create context.
5. Memory scope:
   - session-only, or
   - broader Pulse-scoped memory.
6. Create rail topology:
   - all saved Pulses in the rail,
   - or curated rail subset plus full library.
7. Pulse mode shell semantics:
   - whether Pulse still forces chat mode on,
   - whether Pulse still hides/suppresses Styles,
   - whether those behaviors are part of the V1 product contract or removed.
8. Runtime-path posture:
   - direct OpenAI bypass becomes Pulse-aware,
   - direct OpenAI bypass is disabled during Pulse,
   - or a different single active path becomes authoritative.
9. Multimodal/context posture:
   - what staged attachments, reference-grid items, and workspace state an active Pulse can access,
   - and what hidden runtime state must stay out of model-visible history.
10. Authoring UX minimum:
   - whether V1 includes preview/test-before-save,
   - whether V1 includes revision/version-history affordances,
   - and what is explicitly deferred if not.

## Recommended Defaults
The recommended V1 defaults for implementation start are:

1. Domain naming:
   - `PulseDefinition`
   - `PulseLibrary`
   - `PulseMode`
   - `ActivePulseRuntime`
   Rationale:
   keep saved-object, management-surface, mode-state, and runtime-state concepts separate in both product language and code.

2. V1 scope posture:
   - profile-aware runtime only,
   - no swarm,
   - one active Pulse at a time.
   Rationale:
   this matches the current repo seams and the external agent guidance to start with one orchestrating/runtime profile rather than multi-agent specialization.

3. Storage branch:
   - extend the existing `user_preferences` persistence pattern first.
   Rationale:
   the repo already has a stronger sync pattern in Expert Edit presets, and that is the lowest-risk way to establish one saved-definition authority before introducing a dedicated Pulse store.

4. Activation inheritance:
   - inherit the current Create workspace context,
   - but do not inherit the full historical chat by default.
   Rationale:
   a Pulse activation should feel continuous inside the active Create session, but V1 should avoid dragging full legacy chat state into every activation.

5. Memory scope:
   - session-only.
   Rationale:
   this keeps V1 explicit and bounded, aligns with the existing AI Studio session model, and avoids inventing durable Pulse memory before the runtime contract is stable.

6. Create rail topology:
   - curated rail subset plus full Pulse library.
   Rationale:
   the current repo already has a selected-panel-ids model and `More Presets` surface, so a curated Create rail maps more cleanly onto the existing shell than forcing all saved Pulses into the inline rail.

7. Pulse mode shell semantics:
   - keep chat-mode force-on in V1,
   - keep Styles suppressed while Pulse is active in V1.
   Rationale:
   this preserves the current Create shell expectations, reduces conflicting prompt-shaping inputs while the Pulse runtime is being established, and keeps V1 behavior easier to reason about.

8. Runtime-path posture:
   - disable the direct OpenAI bypass path while Pulse is active in V1.
   Rationale:
   the bypass path is currently static-prompt and non-Pulse-aware. Disabling it during Pulse is simpler and safer than partially supporting two divergent runtime paths.

9. Multimodal/context posture:
   - allow an active Pulse to see the current Create prompt, staged attachments, selected references, current mode/model, and the minimal recent conversation state required for continuity,
   - keep hidden Pulse runtime instructions and runtime-only metadata out of model-visible history.
   Rationale:
   this preserves the useful working context already available to Create while following the external guidance to keep runtime state explicit and to avoid leaking hidden orchestration state into user-visible conversation history.

10. Authoring UX minimum:
   - include create/edit/save/manage in V1,
   - explicitly defer preview/test-before-save and revision/version-history.
   Rationale:
   this is the simplest correct V1 surface that still gives users a real Pulse authoring workflow without prematurely expanding into a larger builder product.

## Deliverables
1. a written V1 Pulse contract,
2. explicit naming and ownership terms,
3. explicit non-goals and stop rules,
4. an implementation-start decision on storage direction and activation semantics.
5. an implementation-start decision on rail topology, shell semantics, bypass posture, and multimodal context posture.
6. a recommended-defaults section that gives implementation one coherent starting posture rather than multiple open branches.

## Non-Goals
1. No code edits in this phase.
2. No runtime changes before naming and scope are explicit.
3. No user-facing claims that Pulse is custom-GPT-equivalent until later phases make that true.

## Entry Criteria
1. The repo audit findings are accepted as accurate.
2. The team agrees that the current append-only Pulse behavior is not the end state.

## Exit Criteria
1. V1 Pulse scope is explicit.
2. Naming is explicit.
3. Storage branch is explicit.
4. Activation inheritance is explicit.
5. Memory posture is explicit.
6. Rail topology is explicit.
7. Shell semantics are explicit.
8. Runtime-path posture is explicit.
9. Multimodal/context posture is explicit.
10. Authoring UX minimum is explicit.
11. Recommended defaults are explicit enough to start implementation without reopening every Phase 0 branch.
12. Stop rules are explicit enough to reject out-of-scope implementation drift.

## Validation
1. Confirm the V1 contract can be stated in one short product sentence.
2. Confirm the contract is narrow enough to implement without broad runtime rewrites.
3. Confirm the contract is strict enough to drive the later phase test matrix.
4. Confirm the recommended defaults form one internally consistent implementation posture instead of conflicting choices.

## Rollback Note
If Phase 0 cannot produce a clear contract, stop the program and keep current Pulse behavior documented as the baseline.
