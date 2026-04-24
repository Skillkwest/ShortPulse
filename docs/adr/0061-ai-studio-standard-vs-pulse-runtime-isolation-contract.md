# ADR 0061: AI Studio Standard Vs Pulse Runtime Isolation Contract

- Date: 2026-04-23
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/planning/ai-studio-standard-vs-pulse-runtime-isolation-execution-plan-2026-04-23.md`
  - `docs/planning/ai-studio-pulse-runtime-master-plan-2026-04-20.md`
  - `docs/planning/ai-studio-pulse-runtime-decision-log-2026-04-20.md`

## Context
The completed Pulse runtime program made Pulse a saved Create agent-profile runtime, but the current repo still carries a product-contract mismatch:
1. the intended product behavior is "Standard mode" versus "Pulse mode" as fully separate operating modes,
2. Pulse is intended to behave like a custom GPT profile that starts immediately when clicked,
3. the current repo still spreads mode and runtime authority across page state, chat state, preset-rail state, and route behavior,
4. current Pulse authoring still exposes internal runtime mechanics more than a simple profile mental model,
5. current mode switching and reset behavior can preserve adjacent chat/runtime state in ways that violate the intended isolation contract.

Repo-backed inspection confirmed that the main risk is not missing model autonomy. The main risk is split state authority and leakage between Standard and Pulse. Current 2026 agent guidance from OpenAI, Anthropic, and Google also points toward the same conclusion:
1. start with one agent plus tools,
2. prefer deterministic workflow wrappers when the sequence is known,
3. add multi-agent specialization only when decomposition or parallelism clearly improves outcomes,
4. keep state, memory, and evaluation explicit.

## Decision
1. AI Studio Create uses a code-owned runtime controller as the source of truth for Standard versus Pulse behavior.
2. `Standard` and `Pulse` are separate runtime modes, not cosmetic variants of one shared transcript/runtime lane.
3. Pulse is modeled as a custom-GPT-style profile:
   - one active Pulse at a time,
   - hidden system/runtime instructions,
   - immediate activation on click,
   - no visible instruction paste into the composer.
4. Clicking any Pulse starts that Pulse immediately. User-facing `activate_only` semantics are not part of the target contract.
5. Switching from one Pulse to another starts a fresh Pulse session by default unless a later, explicitly designed "continue current Pulse session" affordance is added.
6. Leaving Pulse mode deactivates Pulse runtime completely.
7. Standard and Pulse do not implicitly share transcript history, attachments, workflow session state, hidden runtime context, or optional memory.
8. Custom Pulses default to a single lead agent/profile session, not a multi-agent system.
9. Built-in Pulses may use deterministic workflow wrappers and bounded internal specialist workers when needed, but that remains an implementation detail rather than the primary product mental model.
10. Any available submission path used by Pulse must obey the same Pulse runtime contract or be disabled while Pulse is active.

## Consequences
Positive:
1. The product contract becomes clear: Standard is one mode, Pulse is another, and Pulse behaves like a custom GPT profile rather than a prompt helper.
2. Runtime ownership moves from scattered UI/bridge/path conditionals toward one explicit controller.
3. State leakage bugs become easier to reason about and test.
4. Pulse authoring can simplify around `name + system instructions` while retaining richer built-in behavior internally.
5. The architecture aligns with current agent-system guidance: single-agent by default, workflow wrappers where needed, and bounded specialization only where justified.

Tradeoffs:
1. Some current compatibility behavior will need migration or explicit retirement, especially around activation modes and snapshot/session behavior.
2. Existing UI flows that currently preserve adjacent state will become stricter.
3. Built-in workflow Pulses will need a clearer internal/runtime contract so they remain reliable without relying on shared chat state.

## Alternatives Considered
1. Add a top-level orchestrator agent above Standard and Pulse.
   1. Rejected: this adds model complexity without solving the repo's root problem, which is split code/state authority.
2. Keep Standard and Pulse on one shared chat/runtime session and gate behavior with hidden context injection.
   1. Rejected: this preserves the leakage and reset problems already visible in the repo.
3. Make Pulse a full multi-agent platform by default.
   1. Rejected: this is not justified by the product shape, current repo seams, or current 2026 evidence on agent-system efficiency and reliability.

## Validation
This decision is implemented correctly only when:
1. one code-owned controller is the source of truth for mode and Pulse runtime ownership,
2. Standard and Pulse are isolated by tests across activate, switch, clear, restart, deactivate, and session restore flows,
3. Pulse click-to-start works reliably on a blank session,
4. all active submission paths honor the same Pulse contract,
5. custom Pulse authoring reflects the simplified custom-GPT mental model,
6. built-in workflow Pulses remain reliable without exposing internal orchestration complexity to the user.
