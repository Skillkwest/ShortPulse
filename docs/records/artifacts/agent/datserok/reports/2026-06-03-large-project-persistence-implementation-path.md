# Large Project Persistence: Chosen Architecture And Implementation Path

Date: 2026-06-03

Purpose: convert the architecture choice from ADR 0089 into a staged implementation path that stays high ROI and avoids patchwork.

## Chosen Architecture

The chosen direction is:

- lightweight project checkpoint
- versioned project-owned output display records
- existing global inventory and project-association seams retained
- narrow revisioning only where needed for checkpoint freshness and incremental refresh
- no full event sourcing as the first rebuild

## Why This Is The Best Fit

It solves the measured hotspot directly:

- `outputs.active` is the dominant large-project payload
- current autosave is still near-full snapshot rewrite
- current restore/read cost rises with project size

It also stays disciplined:

- it changes the scaling law where the pressure actually is,
- it reuses the repo’s current checkpoint + projection split,
- and it avoids dragging ShortPulse into a full event-store migration that the current product does not need.

## Implementation Path

## Phase 1: Make the checkpoint explicitly lightweight

Goal:

- stop treating the checkpoint as the full output inventory contract

Work:

- define the exact checkpoint schema boundary
- reduce embedded output rows to minimal stubs or remove them where safe
- preserve:
  - quick-slot ids
  - removed ids
  - active selection id if needed
  - canvas references
  - workspace shell state

Proof:

- project restore still reopens to a coherent board shell
- canvas and quick-slot membership still restore correctly
- checkpoint bytes drop materially on the hot project

## Phase 2: Introduce project output display records

Goal:

- move heavy output display state out of the checkpoint

Work:

- add the new project-owned output display persistence seam
- populate it from current snapshot/generated/library/project association sources
- define per-record versioning
- define stable ordering keys

Proof:

- right-rail cards can render from the new display records
- project list previews can resolve from the new display records or a compatible projection
- project restore no longer depends on embedded rich output rows

## Phase 3: Convert the write path to incremental output updates

Goal:

- ordinary project saves update only changed display records and checkpoint shell fields

Work:

- output add/update/archive/visibility changes become per-record writes
- checkpoint updates only when shell/order/membership/canvas changes
- preserve sanitization and ownership filtering on write

Proof:

- save-time payload and write fanout fall materially on the hot project
- large projects no longer autosave as near-full snapshot rewrites

## Phase 4: Convert restore/read to checkpoint plus display-record hydration

Goal:

- restore from:
  - checkpoint shell first
  - then output display records

Work:

- bootstrap shell from checkpoint
- hydrate right rail and all-refs from project output display records
- keep generated-output projection refresh only for fields still intentionally late-bound

Proof:

- `/workspace` fetch cost trends down for large projects
- first paint remains coherent
- later hydration fills richer output detail without broken cards

## Phase 5: Retire the old embedded-output dependency

Goal:

- remove the snapshot-era assumption that rich output display lives inside `outputs.active`

Work:

- delete compatibility reads that expect full display rows in the checkpoint
- simplify repair/refresh logic around the new source of truth
- tighten docs/tests/telemetry to the new architecture

Proof:

- no remaining canonical dependency on rich snapshot output rows
- checkpoint schema is stable and intentionally small

## Key Implementation Decisions

### Use per-record versions, not full event sourcing

Reason:

- best complexity-to-value ratio for current ShortPulse needs
- aligns with Replicache-style row-version thinking and CQRS-style read/write separation
- avoids replay-heavy operational burden

### Keep checkpoint revisioning

Reason:

- checkpoint freshness and first-paint bootstrap still need a clear monotonic authority seam

### Keep global inventory and project association tables

Reason:

- they are already good foundations
- the issue is not that those foundations exist
- the issue is that the checkpoint is carrying too much output display mass

## Recommended Immediate Next Build Spec

Before implementation begins, write one more contract doc defining:

1. exact checkpoint fields
2. exact output display record fields
3. exact update events or mutation types for:
   - output add
   - output update
   - output archive/restore
   - quick-slot membership change
   - hidden/show change
   - canvas reference change

That spec becomes the implementation source of truth.
