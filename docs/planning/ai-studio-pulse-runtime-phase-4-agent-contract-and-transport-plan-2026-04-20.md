# AI Studio Pulse Runtime Phase 4: Agent Contract and Transport Plan (2026-04-20)

Status: complete  
Owner: Engineering

## Goal
Thread Pulse runtime metadata through the full client-to-server agent request path.

## Primary Repo Surfaces
1. `frontend/prefabs/agent/types.ts`
2. `frontend/features/ai-agent/logic/contextBuilder.ts`
3. `frontend/features/ai-agent/useAiAgent.ts`
4. `frontend/features/ai-agent/client/studioAgentTransport.ts`
5. `frontend/features/agent-runtime/studioAgentRouteEnvelope.ts`

## Scope
Phase 4 covers:
1. the Pulse-aware `AgentContext` and request payload shape,
2. runtime metadata construction on the client,
3. transport propagation,
4. route-envelope parsing and validation.

## Required Outputs
1. an explicit Pulse runtime request contract, including:
   - `activePulseId`
   - resolved or resolvable runtime metadata needed by the server
2. clear authority boundaries between:
   - client-composed context,
   - server-resolved runtime instructions/policy.
3. validation/fallback behavior for malformed or stale Pulse metadata.
4. explicit multimodal/context rules for what Pulse can receive from:
   - staged attachments,
   - reference-grid context,
   - current workspace state,
   - prior agent transcript versus hidden runtime state.

## Implementation Notes
1. Updating types alone is not enough; the actual request assembly and transport path must change.
2. The client should send identity and lightweight runtime metadata, not a second copy of the full saved-definition record unless truly required.
3. Fail closed for invalid active Pulse references rather than inventing implicit fallback behavior.

## Entry Criteria
1. Phase 3 snapshot/runtime state contract is explicit.
2. The active Pulse runtime model is stable enough to serialize.

## Exit Criteria
1. Pulse metadata is carried through the agent request path end to end.
2. The route envelope understands the Pulse runtime contract.
3. Invalid metadata behavior is explicit and testable.

## Validation
1. Confirm a client-activated Pulse is visible to the server route without relying on visible prompt mutation.
2. Confirm request payloads remain backward-compatible where intended.
3. Confirm stale or malformed Pulse metadata degrades in a defined way.
4. Confirm runtime-only Pulse state is not accidentally leaking into model-visible history.

## Rollback Note
If request propagation is incomplete or unstable, block Pulse runtime activation from reaching the server and keep generic agent behavior in place.
