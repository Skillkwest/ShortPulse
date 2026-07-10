# ADR 0024: AI Studio Agent Prompt-Only Single-Stage Runtime

## Status

Accepted; refusal eligibility and the retired legacy fallback are superseded by ADR 0099. The actionless final-refusal envelope remains authoritative.

## Context

The AI Studio agent's core product requirement is narrow: return one enhanced image-generation prompt (or one refusal) from user input plus optional reference/image context.  
The previous default runtime path kept two-stage thinker/formatter orchestration for non-text turns, plus broader structured action fields (`variations`, `describeTargets`, `referenceCard`). This increased latency variance, failure surfaces, and contract drift risk without adding primary value for the prompt-generation workflow.

## Decision

1. Make single-stage runtime the canonical path for all flows (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`).
2. Keep legacy thinker/formatter available only as explicit rollback fallback behind `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=true`.
3. Keep the external API contract stable (`Agent-Contract-Version: 1`) and preserve response envelope shape.
4. Canonical runtime output policy:
   - Success: `message` + `actions.applyPrompt`
   - Refusal: `message` only (`actions` empty)
5. Standardize refusal text to `I cannot describe this.` and map safety/policy upstream failures into normal refusal turns (HTTP 200).
6. Canonicalize `focusedSource` semantics to `"image" | "prompt" | "agent-output"` across prompts/runtime/adapters.

## Consequences

- Positive:
  - Lower default runtime complexity and fewer branching edge cases.
  - Better latency predictability with one model call path.
  - Tighter no-regression UI contract because prompt application still relies on `actions.applyPrompt`.
  - Consistent refusal UX without transport-error banners for policy refusals.
- Negative:
  - Legacy multi-stage quality heuristics are no longer primary-path behavior.
  - Some optional action enrichments are not emitted by canonical runtime.
- Follow-ups:
  - Remove inactive legacy V2 wiring after stable rollout window.
  - Evaluate distributed rate-limit backend behind existing abstraction.

## Alternatives considered

- Keep two-stage V2 default:
  - Rejected due to added complexity and larger failure surface for a prompt-only product goal.
- Remove all actions and return message-only:
  - Rejected to avoid breaking existing UI/application flow that updates prompt state from `actions.applyPrompt`.
