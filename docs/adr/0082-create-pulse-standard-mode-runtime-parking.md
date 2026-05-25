# ADR 0082: Create Pulse Standard-Mode Runtime Parking

- Date: 2026-05-25
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
  - `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`
  - `docs/sops/sop_ai_studio_pulse_mode.md`

## Context

The shipped Pulse contract treated `Pulse -> Standard` as a destructive transition:

1. switching to `Standard` cleared the active hidden Pulse runtime,
2. returning to `Pulse` always started from an inactive state,
3. project/session persistence stripped Pulse runtime authority whenever `Standard` was the visible lane.

That behavior matched the current docs, but it created a poor workflow for users who needed to briefly inspect or use `Standard` and then return to the same active Pulse session. Repo inspection also showed the destructive behavior was no longer structurally necessary:

1. Standard and Pulse prompts were already stored separately,
2. reference-selection state was already scoped by Standard vs Pulse create-mode authority,
3. both agent runtimes were already mounted in the page.

The remaining problem was a stale product contract, not an unavoidable technical boundary.

## Decision

1. Switching `Pulse -> Standard` parks the active Pulse runtime instead of clearing it.
2. Returning from `Standard -> Pulse` restores that parked Pulse runtime when the active preset id and Pulse session id are still authoritative.
3. Hidden Pulse runtime state may persist through workspace snapshots while `Standard` is visible, but only when both are true:
   1. a valid Pulse preset id exists,
   2. a valid Pulse session id exists.
4. Orphaned Pulse metadata must still fail closed. If `Standard` has a stale Pulse preset id without session authority, the hidden Pulse runtime is discarded during snapshot build/hydration.
5. `Standard` still must not render, submit, or leak hidden Pulse transcript/input/workflow state into Standard UI or Standard API payloads.
6. Explicit destructive actions remain destructive:
   1. deactivating Pulse,
   2. clearing Pulse runtime,
   3. switching from one Pulse to another,
   4. restarting the active Pulse.

## Consequences

Positive:

1. Users can visit `Standard` temporarily without losing active Pulse work.
2. Pulse state survives autosave/restore while hidden, so the behavior is consistent in memory and across project persistence.
3. Standard/Pulse isolation remains intact because hidden Pulse runtime is parked, not merged.

Tradeoffs:

1. Snapshot and hydration logic must carry two lane-specific agent runtimes even when only one lane is visible.
2. Hidden Pulse runtime authority now depends on stricter preset-id + session-id validation.
3. Future runtime changes must preserve the distinction between:
   1. parked hidden Pulse state,
   2. explicitly deactivated Pulse state,
   3. unauthorized stale Pulse metadata.

## Validation

This decision is implemented correctly only when:

1. `Pulse -> Standard -> Pulse` restores the same active Pulse session,
2. Standard UI continues to avoid rendering hidden Pulse transcript or workflow state,
3. project/session snapshots preserve parked Pulse runtime only with authoritative preset/session ownership,
4. stale Standard-lane Pulse metadata without session authority still fails closed,
5. explicit Pulse deactivation and Pulse-to-Pulse switching still clear the replaced runtime.
