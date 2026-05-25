# ADR 0083: Create-Mode Global Right-Rail Authority

- Date: 2026-05-25
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/adr/0082-create-pulse-standard-mode-runtime-parking.md`
  - `docs/sops/sop_ai_studio_pulse_mode.md`
  - `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`

## Context

The repo now parks Pulse runtime state when users switch from `Pulse` to
`Standard`, but parts of the written contract still implied that returning to
`Standard` should also clear or isolate surrounding right-rail workspace state.

Repo-backed behavior already disagreed with that assumption:

1. Prompt state and agent runtime are lane-owned by `Standard` vs `Pulse`.
2. The right rail and output focus remain shared within the current workspace.
3. Existing tests already assert shared output/reference context across
   `Standard` and `Pulse`.

This needed to be made explicit so future cleanup does not accidentally fork the
right rail by Create mode.

## Decision

1. `Reference Grid`, `Quick Slot Inventory`, and `Canvas` are workspace-global
   right-rail surfaces.
2. `Standard` and `Pulse` mode switches do not create separate right-rail
   authorities inside the same workspace.
3. Output focus and quick-slot/reference projection remain shared across
   `Standard` and `Pulse` within the current base runtime authority.
4. `Standard` and `Pulse` continue to isolate only their mode-owned state:
   prompt drafts, agent transcript/input state, workflow session state, Pulse
   preset/session authority, and other hidden runtime context.
5. Hidden Pulse runtime state must stay out of visible Standard agent surfaces
   and Standard route payloads, even though the right rail remains global.

## Consequences

Positive:

1. Users can tab between `Standard` and `Pulse` without losing workspace
   context in the right rail.
2. The Create-mode switch remains a runtime-mode transition, not a second
   workspace fork.
3. Project/session persistence can preserve one coherent right-rail workspace
   while still isolating Standard/Pulse runtime ownership.

Tradeoffs:

1. Returning to `Standard` may still show an output or quick-slot state that was
   last focused while `Pulse` was active.
2. Future work must not treat shared right-rail state as evidence that Standard
   and Pulse should share transcript/runtime state.
3. Any lane-specific UX built on top of the right rail must account for the
   global authority boundary instead of assuming per-mode isolation.

## Validation

This decision is implemented correctly only when:

1. `Pulse -> Standard -> Pulse` preserves the active Pulse runtime when
   authorized.
2. `Pulse -> Standard` keeps `Reference Grid`, `Quick Slot Inventory`, and
   `Canvas` state within one shared workspace authority.
3. Standard continues to avoid rendering hidden Pulse transcript/input/workflow
   state.
