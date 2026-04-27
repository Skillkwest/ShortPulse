# Records And Evidence

Purpose: define the retained-records policy for evidence packets, templates, raw artifacts, and other traceability material that should be preserved without competing with current source-of-truth docs.

## Status
- `docs/records/` is the governance entrypoint for retained records.
- During the current cleanup transition, most physical evidence files still live under `docs/planning/evidence/`.
- Do not treat `docs/planning/evidence/` as part of the primary reading path even before those files are migrated.

## What belongs here
- Human-readable evidence indexes and closeout packets.
- Promote/hold/rollback decision records.
- Validation templates and packet schemas.
- Raw artifacts such as JSON exports, logs, screenshots, and generated audit payloads.

## What does not belong here
- Current architecture, product, or runtime contracts.
- Active implementation plans and trackers.
- SOPs and operator runbooks.
- Durable architecture decisions that belong in ADRs.

## Authority model
- Records are retained for proof, traceability, rollback context, and historical validation.
- Records are not authoritative for present-day behavior or requirements unless an active doc explicitly points to them as supporting evidence.
- When current truth and a retained record differ, current truth wins.

## Reader workflow
1. Start with the active contract in `docs/`, `docs/planning/`, `docs/sops/`, or `docs/adr/`.
2. Open records only when you need implementation proof, rollout evidence, audit history, or retained artifacts.
3. Prefer namespace indexes and summary packets over raw payload files.

## Target namespace shape
- `docs/records/evidence/`: human-readable evidence packets, indexes, and templates.
- `docs/records/artifacts/`: raw machine-generated artifacts such as logs, JSON snapshots, and exports.

This target shape is the destination model. The repo is not moving all retained files in this step.

## Transition rules
- New reading paths should point to `docs/records/README.md` or a namespace README, not directly to raw evidence payloads, unless a packet is the actual thing the reader needs.
- When a planning family is archived or closed, its evidence should eventually move out of `docs/planning/evidence/` into the records namespace.
- Raw artifacts should move before or alongside bulky evidence packet families whenever that can be done without breaking traceability.
- Keep path moves incremental and index-backed; do not do bulk unreviewed relocations.

## Controlled exceptions
- `docs/planning/archive/original-plans/` remains a protected checksum-backed exception for verbatim source-plan preservation.
- A temporary planning-evidence namespace may remain under `docs/planning/evidence/` until the corresponding records migration lane is executed.

## Index rules
- `docs/README.md` should point to the records entrypoint, not enumerate large retained-evidence inventories.
- `docs/planning/README.md` may reference the planning-evidence index during transition, but should avoid listing raw packet files in the active reading path.
- Namespace READMEs may enumerate their own retained packets when that helps operators or auditors.
