# ADR 0022: Reference Grid Domain Modular Architecture

## Status
Accepted

## Date
2026-02-23

## Context
AI Studio reference-grid behavior is currently concentrated in a few large files where rendering, domain state, ingestion, media runtime behavior, and quick-slot projection semantics are tightly coupled.

This has created higher regression risk and slower iteration for:
1. quick-slot inventory behavior,
2. add-files and media-library insertion paths,
3. shared preview/signing/retry behavior.

Existing ADRs define performance and adaptive-media policies, but do not define a strict modular domain contract for reference entities and projections.

## Decision
Adopt a modular reference-grid domain architecture with explicit contracts and phased strangler migration.

### 1) Domain contract
Introduce canonical discriminated entities and normalized state:
- `ReferenceEntity` union (`upload | libraryMedia | generated | promptReference`)
- `ReferenceState` normalized shape (`ids`, `entities`, `quickSlotIds`, `archivedIds`, `meta`)

### 2) Ingestion contract
Normalize all ingestion entry points through one canonical `ReferenceInput` adapter:
- file picker,
- drag/drop,
- paste,
- media-library selection,
- agent add-to-grid.

### 3) Projection contract
Represent `all refs`, `quick slots`, and `archived` as explicit projection selectors.

### 4) Runtime contract
Converge modal and route preview/sign/retry/download behavior through a shared reference-media runtime interface.

### 5) Migration strategy
Use compatibility adapters (`StudioOutput <-> ReferenceEntity`) and temporary feature flags through phased rollout, then retire adapters/flags during cleanup.

### 6) Guardrails
Extend architecture-boundary and size-budget checks with a staged warn-to-enforce lane for reference-grid targets.

## Consequences
### Positive
1. Lower regression risk from clearer contracts and isolated responsibilities.
2. Faster targeted change velocity for ingestion and quick-slot semantics.
3. Better parity guarantees between AI Studio modal and Media Library route runtime behavior.
4. Enforceable architecture boundaries for future work.

### Negative
1. Temporary complexity from compatibility adapters and migration flags.
2. Additional docs/evidence overhead per phase.
3. Short-term dual path maintenance during strangler rollout.

### Follow-ups
1. Maintain phase evidence in `docs/planning/evidence/reference-grid-modularization/`.
2. Promote reference-grid guardrails from warn to enforce at closeout.
3. Retire temporary migration flags in Phase 6.

## Alternatives considered
- Option A: Big-bang rewrite of reference-grid subsystem.
  - Rejected due to higher regression and rollback risk.
- Option B: Continue incremental tweaks in existing monolith files.
  - Rejected due to persistent coupling and structural drift risk.
- Option C: Introduce external state library during modularization.
  - Rejected because current program locks to reducer + selectors with no new dependency.
