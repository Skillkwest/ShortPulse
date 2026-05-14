# Lever Artifact Memory

Purpose: retain working memory notes for Lever outside the primary repo-visible memory surface.

## Current Focus

- Keep model onboarding and retirement mechanical.
- Preserve the operator-only inventory boundary.
- Make future add/retire runs easier to validate than the last one.

## Working Rule

When a run produces a durable lesson, promote the concise version into `docs/agents/lever/memory.md` and keep broader notes here or in a dated report.

## Durable Notes

- 2026-05-11: The first real retirement (`kie-ai/seedance-1.5-pro`) showed that lifecycle demotion alone is not enough. App-visible modal/order residue can survive and must be audited explicitly after the catalog change.
- 2026-05-11: `model:doctor` now needs to tolerate deprecated queued compatibility routes during a retirement window; otherwise the first real retirement path breaks the tooling instead of validating it.
- 2026-05-13: The first full hard removal of `kie-ai/seedance-1.5-pro` confirmed that Lever should preserve historical training/change records while eliminating all active runtime, route, pricing, and visible app support.
