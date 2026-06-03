# Large Project Persistence: Implementation Handoff

Date: 2026-06-03

Purpose: provide the concise source-of-truth handoff that lets the next implementation lane begin without reopening the architecture choice.

## What Was Proven

The large-project persistence lane established that the real scaling hotspot is not generic workspace state. It is rich `outputs.active` payload mass inside a full-snapshot project persistence model.

Measured production evidence showed:

- workspace size is highly skewed toward a small number of very large outlier projects
- the largest saved row is about `782 KB`
- the hot project has `611` active outputs
- `outputs.active` dominates payload mass
- autosave candidates on the hot project are effectively all full snapshots
- save lag and `/workspace` read time both rise materially with project size

## Chosen Direction

ADR 0089 is the canonical architecture decision:

- keep a lightweight project checkpoint
- move heavy output state to versioned project-owned output display records
- keep current global inventory and project-association seams
- use per-record versioning, not full event sourcing

## Build Contract

The implementation source of truth is now:

- [ADR 0089](../../../../../adr/0089-large-project-persistence-hybrid-checkpoint-and-output-display-records.md)
- [build contract v1](./2026-06-03-large-project-persistence-build-contract-v1.md)
- [schema and transport spec v1](./2026-06-03-large-project-persistence-schema-and-transport-spec-v1.md)

Those three documents together now answer:

- what the checkpoint owns
- what the display record owns
- what stays global or association-backed
- where ordering and membership authority live
- how route compatibility should work during migration

## Migration And Proof Package

The next implementation lane should also treat these as required companions:

- [migration and rollout plan](./2026-06-03-large-project-persistence-migration-and-rollout-plan.md)
- [proof and observability plan](./2026-06-03-large-project-persistence-proof-and-observability-plan.md)

## Exact Next Implementation Scope

The first implementation lane should do only this:

1. add additive schema support for `checkpoint_revision` and `project_output_display_items`
2. backfill display records from existing project snapshots
3. compose compatibility reads from checkpoint + display records
4. convert save normalization from full snapshot persistence toward coordinated checkpoint/display-record mutations

It should not begin with:

- a public route rewrite
- a full event store
- a Media Library ownership redesign
- a new archived-output product model

## Stop Condition Reached

This architecture lane is now implementation-ready because the repo contains:

- a chosen architecture
- a durable ADR
- an exact checkpoint/display-record contract
- schema and transport decisions
- migration and rollout sequencing
- proof and observability gates
- an implementation handoff artifact

At this point, continuing inside the architecture lane would be momentum, not ROI. The correct next lane is implementation against these contracts.
