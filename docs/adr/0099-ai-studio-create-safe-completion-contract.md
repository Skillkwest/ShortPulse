# ADR 0099: AI Studio Create Safe Completion Contract

## Status

Accepted

## Context

AI Studio Create could return a dead-end refusal for creative requests that still had a useful safe form. In the observed failure, the agent first returned `I cannot describe this.`, then asked the user to remove unsafe details, and only completed the work after a second `SFW` instruction. That workaround is inconsistent with a production writing assistant: Standard, custom Pulse, and built-in guided workflows should make the smallest necessary safety substitutions and finish eligible work during the original turn.

The current runtime already separates two concerns that must remain separate:

- the safety control plane decides whether provider-bound content is allowed, rewritten, or refused and preserves immutable production hard floors;
- Standard and Pulse own different prompts, transcripts, response envelopes, workflow state, and artifact behavior.

Editable Standard instructions, custom Pulse instructions, and admin-owned built-in instructions cannot be the platform safety authority. Updating each prompt independently would leave drift across existing and future agents, while an always-on rewrite model would add cost and latency to every turn.

## Decision

1. Create one versioned, code-owned Safe Completion Contract for AI Studio Create and inject it at final product-policy precedence in both Standard and Pulse provider prompts.
2. The contract applies to Standard, custom Pulse, and built-in guided workflows. Editable agent instructions remain authoritative for role, workflow, response shape, and artifact behavior, but they cannot override platform hard floors or the Safe Completion Contract.
3. When the active safety policy permits meaningful safe completion, the agent must make the smallest necessary substitutions, preserve the user's safe creative and production constraints, and return the completed work in the same response. It must not ask for permission, request an SFW resubmission, give a policy lecture, or merely offer to create a safer version later.
4. Server-authoritative input safety remains the eligibility gate. Missing safety evidence fails closed. Immutable hard floors, explicit policy refusals, ambiguous-age sexual signals, provider HTTP safety blocks, output-safety refusals, malformed output, and route/configuration errors are not recovery candidates.
5. An eligible model-authored refusal may receive exactly one internal Safe Completion recovery attempt. A recovery refusal or error is terminal for that turn; there is no retry loop or visible synthetic user turn.
6. Primary and recovered responses must pass the shared output-safety finalizer before returning to the client.
7. A true refusal keeps the existing route contract: readable refusal text, empty actions, preserved mode-owned continuity, and no reusable prompt artifact. Refusal and error bubbles may be read but must not expose drag, Use, Apply, or Generate behavior.
8. Standard and Pulse remain separate routes and state authorities. Safe Completion does not merge transcript history, context, canonical prompt state, workflow sessions, persistence, or artifact targets.
9. The feature lever `STUDIO_AGENT_SAFE_COMPLETION_ENABLED` may disable the Safe Completion instruction and model-refusal recovery for incident containment. It never disables input safety, hard floors, provider-block handling, or output safety.
10. Safe Completion telemetry records contract version, enabled state, refusal source, recovery eligibility, attempt, outcome, skip reason, and latency. It must not record raw prompts, outputs, user identifiers, emails, or reference URLs.
11. Live Standard and Pulse control-plane records are not programmatically rewritten. Repo-owned seeds may be aligned, but runtime correctness must come from the shared platform contract.
12. The retired legacy V2 path is not a Safe Completion fallback and must not be restored.

This ADR refines the refusal decisions in ADR 0012 and ADR 0024: their actionless final-refusal envelope remains valid, while this ADR narrows which requests should reach that final state. It also preserves ADR 0028 hard floors, ADR 0061 mode isolation, ADR 0073 built-in control-plane authority, ADR 0074 custom-versus-guided terminology, and ADR 0082 Pulse parking.

## Consequences

- Positive:
  - One platform contract covers current and future Create agents without per-prompt drift.
  - Eligible creative work completes without a user-authored workaround turn.
  - Hard floors and provider/output safety remain fail-closed.
  - Standard and Pulse keep their intended personalities, workflow state, and artifact contracts.
- Negative:
  - An eligible model refusal can add one extra provider call and its associated latency/cost.
  - Prompt precedence, refusal classification, and recovery eligibility require cross-mode regression tests and production telemetry review.
  - Local tests cannot prove deployed-model adherence or live control-plane contents.
- Follow-ups:
  - Validate Standard, one custom Pulse, and each published built-in at `https://www.shortpulse.ai` after separately approved commit and deployment.
  - Compare first-turn completion, hard-floor correctness, recovery rate, refusal rate, and recovery latency before release promotion.

## Alternatives considered

- Edit the Standard prompt and every built-in/custom Pulse:
  - Rejected because mutable records drift and existing custom Pulses would remain uncovered.
- Expand deterministic lexical replacements:
  - Rejected as the creative rewrite authority because contextual mixed-content requests require semantic rewriting and lexical substitution can damage meaning.
- Run a separate rewrite model before every turn:
  - Rejected because it adds routine latency, cost, and an always-on failure seam even for safe requests.
- Add a visible `Make safe` action or automatic client resubmission:
  - Rejected because it preserves the workaround and creates duplicate client-side runtime authority.
