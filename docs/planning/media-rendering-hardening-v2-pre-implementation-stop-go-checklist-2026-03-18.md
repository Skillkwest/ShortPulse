# Media Rendering Hardening v2 Pre-Implementation Stop/Go Checklist (2026-03-18)

Last updated: 2026-03-18
Status: active

## Purpose
Define the minimum planning completeness required before behavior-changing implementation starts.

## Stop/Go Checklist
- [x] Master plan, roadmap, tracker, risk register, decision log, and QA checklist are updated and mutually consistent.
- [x] Surface inventory lock includes all in-scope hot-path surfaces and known long-tail surfaces, either as explicit rows or explicit queued annex entries with disposition notes.
- [x] Surface policy matrix exists for route, modal, panel, media-library file modal, media-library panel preview modal, reference-grid, quick-slot, character-grid, quick-swap, and detail-modal.
- [x] Telemetry baseline truth spec identifies trustworthy vs blocked metrics and documents any surface coverage limits for timing baselines.
- [x] Test realignment matrix classifies all policy-sensitive tests.
- [x] Metadata authority spec is accepted as the planned source of truth for dimensions.
- [x] Execution tracker is seeded with at least one slice per upcoming phase.
- [x] Evidence namespace is locked to `docs/planning/evidence/media-rendering-hardening-v2/`.
- [x] ADR trigger rule is accepted for durable delivery-policy changes.
- [x] `mini-ecosystem/` remains explicitly out of scope.

## No-Go Conditions
1. Any protected surface lacks a policy row in the surface policy matrix.
2. Baseline evidence still depends on blocked telemetry fields.
3. Tests that protect likely-to-change drift have not been classified.
4. The next slice has no rollback note or evidence target.
5. Contract matrix and decision log disagree on current program truth.
6. A known user-visible image surface is neither represented in the inventory lock nor explicitly queued with disposition.
7. A baseline packet treats an uninstrumented surface as having trusted first-card or first-media timing without an approved replacement metric.

## Go Condition
Implementation may start only when every checklist item above is complete and no `No-Go` condition remains open.
