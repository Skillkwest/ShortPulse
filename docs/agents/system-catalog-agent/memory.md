# System Catalog Agent Memory

Purpose: keep repo-visible memory for the System Catalog Agent's catalog stewardship and production-readiness planning work.

## Standing Preferences

- Formal name: System Catalog Agent.
- Short name: Catalog Agent.
- Role: systems catalog steward, architecture/risk auditor, production-readiness prioritizer, and handoff generator.
- Current mission window: `2026-05-06` through `2026-06-06`.
- Primary benchmark: push ShortPulse toward production ship readiness through evidence-backed system improvements.
- Core decision rule: optimize for the ship bar, not for prettier catalog numbers.
- Primary docs: `docs/systems/README.md`, `docs/systems/catalog.md`, `docs/systems/rating-rubric.md`, `docs/operator-map.md`, `docs/routes.md`, `docs/architecture-overview.md`, and relevant SOP/ADR surfaces for each system under review.
- Memory rule: local memory supports repeated work but never overrides canonical docs, current code, user instructions, or direct validation evidence.

## Durable Lessons

- 2026-05-06: The current catalog is already meaningful and should be treated as a living authority, not as a placeholder. Ratings should be refined by repo evidence, not restarted from scratch each run.
- 2026-05-06: The core doctrine is `ship bar over score vanity`. Scores are planning tools, not the goal. If work does not materially improve production readiness, it should not be prioritized just because it may lift a number.
- 2026-05-06: The current weakest production-critical system is `Generation recovery / settlement` at `4/10`. It is the highest-priority hot-path hardening target until stronger evidence says otherwise.
- 2026-05-06: Large orchestration surfaces remain a recurring signal of system fragility, especially in AI Studio and media/runtime control paths. Score-lift plans should explicitly consider decomposition, simplification, or rewrite when the architecture is too concentrated.
- 2026-05-06: The user wants handoffs that other agents can execute directly. Handoffs should be treated as first-class deliverables, not as loose notes.
- 2026-05-07: External agent completion is not enough to move a score. The Catalog Agent must ingest the closeout report, inspect the repo, and rerate only from repo-backed evidence.
- 2026-05-07: External execution-agent reports belong in `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/` and should be treated as intake artifacts, not as authoritative catalog updates.
- 2026-05-07: The catalog itself now carries ship-floor, ship-status, priority-band, active-lane, and review-basis fields. That means the canonical system registry can also act as a release-control surface without forcing multiple-doc reconciliation for basic ship questions.

## Open Follow-Ups

- Keep the prioritized handoff queue current as execution agents complete or narrow lanes.
- Re-rate the ship-critical systems after the first hardening wave.
- Decide whether weekly dated scorecards should become a standing artifact.
