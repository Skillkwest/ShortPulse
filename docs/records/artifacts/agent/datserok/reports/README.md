# Datserok Reports

Purpose: retain dated project-persistence audit packets, implementation investigation summaries, and source-of-truth comparisons when a Datserok run needs durable detail beyond memory or the run log.

## Usage

- Create a dated report here only when the run produces reusable persistence evidence.
- Prefer concise summaries that link back to the active contract, code owners, tests, or production observations.
- Do not store raw chat transcripts here.

## Current Reports

- `2026-05-31-project-persistence-authority-audit.md`
  - first substantive Datserok authority audit for current shipped project persistence
- `2026-06-03-large-project-persistence-architecture-prep-current-state.md`
  - large-project architecture prep checkpoint covering invariants, current-state architecture, and next measurement/research questions
- `2026-06-03-large-project-persistence-external-pattern-memo.md`
  - targeted primary-source pattern memo covering checkpoint-plus-journal, record-level transaction, and incremental sync approaches relevant to ShortPulse
- `2026-06-03-large-project-persistence-candidate-architecture-matrix.md`
  - first candidate comparison matrix scoring checkpoint-only, journal, normalized, and hybrid split directions against the measured ShortPulse workload
- `2026-06-03-large-project-persistence-checkpoint-boundary-proposal.md`
  - first concrete checkpoint-vs-output-materialization boundary proposal for the leading hybrid split architecture
- `2026-06-03-large-project-persistence-output-display-record-proposal.md`
  - proposed project-owned output display record contract derived from current right-rail, preview, and restore consumers
- `2026-06-03-large-project-persistence-implementation-path.md`
  - chosen architecture summary plus staged implementation path for the large-project persistence rebuild
- `2026-06-03-large-project-persistence-build-contract-v1.md`
  - implementation-grade contract defining the lightweight checkpoint payload, project output display record payload, source-of-truth split, and mutation surface
- `2026-06-03-large-project-persistence-schema-and-transport-spec-v1.md`
  - resolves the remaining implementation-shaping decisions for revision storage, display-record deletion, preview read composition, and compatibility transport posture
- `2026-06-03-large-project-persistence-migration-and-rollout-plan.md`
  - staged coexistence, backfill, cutover, rollback, and validation-gate plan for moving from rich checkpoint snapshots to the hybrid architecture
- `2026-06-03-large-project-persistence-proof-and-observability-plan.md`
  - synthetic project ladder, success metrics, telemetry, and proof gates for validating the new persistence model at scale
- `2026-06-03-large-project-persistence-implementation-handoff.md`
  - concise handoff tying together the measured hotspot, ADR 0089, the build contract, and the exact next implementation scope
