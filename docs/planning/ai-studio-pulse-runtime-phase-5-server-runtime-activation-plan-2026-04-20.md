# AI Studio Pulse Runtime Phase 5: Server Runtime Activation Plan (2026-04-20)

Status: Planned  
Owner: Engineering

## Goal
Make the AI Studio agent server runtime Pulse-aware while preserving the existing prompt-compiler architecture for V1.

## Primary Repo Surfaces
1. `frontend/pages/api/ai/studio-agent.ts`
2. `frontend/lib/agentPromptsConfig.ts`
3. `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts`
4. `frontend/tests/api/studio-agent.runtime.test.ts`

## Scope
Phase 5 covers:
1. server-side Pulse resolution,
2. hidden instruction injection and runtime policy shaping,
3. bounded V1 Pulse behavior inside the current runtime,
4. server-side fallback behavior when Pulse state is invalid or unavailable,
5. compatibility with the direct OpenAI bypass posture chosen in Phase 0.

## Required Outputs
1. a server-side resolved Pulse runtime contract,
2. explicit rules for how active Pulse changes:
   - instructions,
   - model defaults,
   - tool policy,
   - output behavior.
3. fallback behavior when the active Pulse cannot be resolved.
4. a statement that V1 remains prompt-generation-oriented and Create-scoped.
5. an explicit answer for whether the direct OpenAI bypass path:
   - becomes Pulse-aware,
   - is disabled during Pulse,
   - or is otherwise removed from the active Pulse path.
6. telemetry for Pulse activation, resolution, fallback, and failure behavior.

## Implementation Notes
1. Keep V1 inside the current prompt-compiler runtime rather than turning it into a general orchestration rewrite.
2. Pulse behavior should be injected server-side and remain hidden from the composer.
3. The server remains the authority for effective Pulse behavior once a request is submitted.

## Entry Criteria
1. Phase 4 request propagation is in place.
2. The Pulse runtime contract is stable enough to resolve server-side.

## Exit Criteria
1. The server route can resolve active Pulse behavior.
2. Active Pulse changes runtime behavior without composer mutation.
3. Fallback behavior for missing or invalid Pulse resolution is explicit.

## Validation
1. Confirm two different Pulses can materially change server behavior while the visible composer stays unchanged.
2. Confirm generic non-Pulse requests still behave as expected.
3. Confirm V1 does not accidentally expand into uncontrolled multi-agent behavior.
4. Confirm whichever submission path is available in Pulse mode actually applies Pulse behavior.

## Rollback Note
If runtime behavior drifts or destabilizes the agent route, fall back to the prior generic server runtime and keep Pulse behind a gate.
