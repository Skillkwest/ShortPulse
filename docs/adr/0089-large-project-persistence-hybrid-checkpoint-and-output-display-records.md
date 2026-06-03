# ADR 0089: Large Project Persistence Hybrid Checkpoint And Output Display Records

## Status

Accepted

## Date

2026-06-03

## Context

ADR 0063 established `project_workspace_states` as the durable project workspace seam and ADR 0065 added project-owned generated-output association plus async restore refresh.

That architecture is good enough for ordinary project sizes, but the large-project architecture lane found a clear scaling boundary:

- production workspace size is heavily skewed toward a small number of very large outlier projects,
- the largest saved project row is currently about `782 KB` with `611` active outputs,
- `outputs.active` dominates payload mass on those outliers,
- autosave for the hot project is still landing as near-full snapshot rewrite almost every time,
- and both save-adjacent lag and restore `/workspace` fetch time rise materially with project size.

The current system also already shows a useful internal split:

- checkpoint-style project workspace restore,
- additive project association tables,
- and async generated-output refresh/materialization after bootstrap.

The large-project lane compared four architecture families:

1. improve the checkpoint-only model,
2. checkpoint plus append-only revision journal,
3. fully normalized per-entity project source of truth,
4. hybrid lightweight checkpoint plus project-owned output materialization.

Targeted external pattern research reinforced the repo findings:

- Figma uses checkpoint plus incremental journal patterns because whole-file checkpointing scales poorly,
- Notion uses record-level transactions plus background derivative work,
- Replicache demonstrates the value of per-entity versions and diff-based pull/read models,
- and Microsoft’s CQRS/Event Sourcing guidance explicitly warns that full event sourcing adds substantial complexity and should be adopted only when its extra benefits justify the cost.

ShortPulse needs a design that changes the scaling law for very large projects without forcing the complexity and migration burden of full event sourcing where the product does not currently need it.

## Decision

Adopt a **hybrid large-project persistence architecture** with a **lightweight project checkpoint** plus **versioned project-owned output display records**.

### 1. Keep a project checkpoint, but narrow its responsibility

The durable checkpoint remains the bootstrap restore seam for project routes, but it must stop acting as the full authoritative output inventory.

The checkpoint should own:

- workspace shell state needed to reopen the authored board,
- quick-slot and reference-grid membership/order/selection state,
- durable canvas state,
- and minimal output stubs only where first paint requires them.

The checkpoint must not remain the hot persistence unit for rich output display payloads.

### 2. Introduce project-owned output display records as the heavy-output persistence seam

ShortPulse will introduce a project-owned output display record layer, referred to in this ADR as `project_output_display_items`.

This layer becomes the primary persistence surface for:

- output display authority,
- preview/full asset pointers,
- output lifecycle and visibility state,
- generated-output recovery identity,
- and other right-rail/read-model fields that currently bloat `outputs.active`.

The checkpoint points at these records by identity and ordering instead of embedding full output rows.

### 3. Use per-record versioning as the primary incremental write model

The first rebuild will **not** adopt full event sourcing as the canonical write model.

Instead:

- each project-owned output display record gets a monotonic version,
- the checkpoint carries its own monotonic revision,
- and project read/write flows update only the changed display records plus the checkpoint fields that truly changed.

This means:

- large output-heavy saves become incremental,
- restore can fetch only changed display records after bootstrap,
- and read/write models can evolve toward CQRS-style separation without requiring append-only event replay for every state transition.

### 4. Allow a narrow revision surface, but do not make an event store the primary system of record

ShortPulse may add a narrow project revision mechanism for:

- checkpoint freshness,
- ordering changes,
- membership changes,
- and incremental client refresh coordination.

However:

- the system will not adopt full event sourcing as the authoritative persistence model for project workspaces in this first architecture shift,
- and the new runtime will not require replaying an append-only event log to answer ordinary project reads.

### 5. Preserve the current global inventory and project-membership split

This ADR does not replace:

- `ai_generations`,
- `generation_projection`,
- `project_generation_items`,
- `project_media_items`,
- `project_prompt_items`,
- or the global Media Library inventory model.

Instead, the new project output display layer references and materializes those existing canonical/global sources into a project-owned read shape appropriate for restore and right-rail use.

### 6. Preserve current project durability invariants

The new architecture must preserve:

- `projectId` as the durable boundary,
- server-authoritative sanitization,
- fail-closed project restore,
- additive project association over global inventory,
- global Media Library folder authority,
- and conversational runtime exclusion from project checkpoint restore.

## Consequences

- Positive:
  - Large projects stop paying full-checkpoint rewrite cost for ordinary output changes.
  - Restore can keep the fast checkpoint bootstrap while moving heavy output detail behind incremental refresh.
  - The architecture aligns with the repo’s existing partial split instead of fighting it.
  - The system gains a cleaner path to output-specific observability, versioning, and staged migration.
  - Migration risk is materially lower than a full record-native or full event-sourced rewrite.
- Negative:
  - The system becomes explicitly multi-layered: checkpoint, output display records, and deeper generation/global sources.
  - Ordering, membership, and synchronization contracts must be defined carefully or the split will become messy.
  - Some temporary coexistence between old snapshot output rows and new display records may be required during migration.
  - The repo will need new tests and telemetry around per-record versioning and checkpoint/display convergence.

## Follow-ups

1. Define the exact checkpoint schema boundary for the lightweight checkpoint.
2. Define the exact `project_output_display_items` contract and which current output fields move there.
3. Decide whether ordering/membership refresh is handled by checkpoint revision alone or by a small supplemental project revision feed.
4. Design the migration path from embedded snapshot output rows to project-owned display records.
5. Add implementation ADRs or schema docs once the exact read/write contract is chosen.

## Alternatives considered

- Improved checkpoint-only persistence:
  - Rejected as the primary long-term direction because it preserves the scaling law that is already under pressure on real projects.
- Checkpoint plus full append-only event sourcing:
  - Rejected for the first rebuild because the complexity, migration burden, and replay-heavy operational model are not justified by ShortPulse’s current product requirements.
- Fully normalized per-entity project source of truth:
  - Rejected as the first move because it is too broad and disruptive relative to the narrower measured hotspot.
