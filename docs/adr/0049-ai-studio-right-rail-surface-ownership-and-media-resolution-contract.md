# ADR 0049: AI Studio Right-Rail Surface Ownership and Media Resolution Contract

## Status
Accepted

## Context
Existing ADRs already established important parts of the AI Studio right rail:
1. ADR 0013 locked bounded-work expectations for the Reference Grid.
2. ADR 0017 introduced the Quick Slot / All Refs split surface inside one shared runtime.
3. ADR 0030 added the rail Canvas and made the right rail a three-surface workspace.
4. ADR 0044 locked the broad surface-delivery policy model.
5. ADR 0046 established Reference Grid visibility as a protected authority surface.

What remained underspecified in the repo was the right-rail contract for:
1. which surface owns duplicate output work when the same output appears in Quick Slot and All Refs,
2. how right-rail drop routing should behave when shell capture and concrete target surfaces overlap,
3. where preview/full/fallback media resolution policy is allowed to live in the right-rail hot path.

That gap created a pattern of repeated controller-local fixes instead of one explicit right-rail policy.

## Decision
1. Treat the AI Studio right rail as one protected surface family containing:
   - `Reference Grid`
   - `Quick Slot Inventory`
   - `rail Canvas`
2. Concrete target surface is authoritative for right-rail drag/drop routing. Shell capture may assist routing and visuals, but it must not override the intended rail target.
3. When the same output appears in both Quick Slot and All Refs, Quick Slot is the primary owner for duplicate loading, hydration, and media warmup priority. All Refs duplicates may still render, but they are secondary.
4. Right-rail preview/full/fallback resolution policy must be shared through one resolver/controller contract. Downstream right-rail consumers must not independently recompute that policy in parallel.
5. Additional right-rail performance work must preserve bounded-work posture and should prefer shared-contract simplification over new local conditionals.

## Consequences
- Positive:
  - Makes duplicate-surface behavior explicit and testable.
  - Prevents shell-level routing from becoming the accidental source of truth for rail drops.
  - Gives the right rail one hot-path media resolution seam instead of repeated controller-local policy.
- Negative:
  - Adds an explicit architectural contract that future right-rail work must respect.
  - Limits quick one-off fixes that bypass the shared seams.
- Follow-ups:
  - Keep the right-rail tracker aligned with this contract.
  - Add a new ADR only if these boundaries change, not for each optimization slice.

## Alternatives considered
- Option A: keep equal priority between Quick Slot and All Refs duplicates.
  - Rejected because it preserves duplicated loading and hydration work in the hottest user-facing path.
- Option B: let shell drag/drop capture remain the effective owner of right-rail drop semantics.
  - Rejected because it conflicts with the right rail's concrete target surfaces and causes routing drift.
- Option C: let each right-rail consumer resolve its own preview/fallback chain.
  - Rejected because it repeats expensive policy work and recreates the same fragmentation that caused the current churn.
