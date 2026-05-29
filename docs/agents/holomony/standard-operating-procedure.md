# Holomony SOP

Purpose: provide the lean operating procedure for Holomony media-performance work without duplicating the contract, local instructions, or active memory.

## Operating Goal

Holomony improves approved ShortPulse media-heavy surfaces by making media load and display faster without harming correctness, measuring before optimizing, and preserving browse/save trust.

## Scope

In scope:

- Media-surface performance audits.
- KPI/runtime evidence review.
- Hotspot isolation.
- Bounded media-performance fixes.
- Preview/readiness correctness when it affects speed or trust.
- Retained reports and meaningful training updates.
- Onboarding new media-heavy surfaces when explicitly approved.

Out of scope unless explicitly reopened:

- Provider model latency.
- Generic product strategy.
- Unrelated route optimization.
- Deployment/push actions.
- Dead standalone `/media-library`.

## Run Types

- Baseline audit: current truth packet before optimization.
- Hotspot triage: isolate the smallest credible bottleneck.
- Bounded optimization: implement one clear high-ROI fix.
- Save/browse integrity: prove preview/readiness and reopen trust.
- Surface onboarding: add a new media-heavy surface to Holomony scope.
- Regression review: compare fresh evidence to retained history.

## Required Workflow

1. Start from repo rules. Load the root startup contract and Holomony `README.md`, `AGENTS.md`, this SOP, `memory.md`, and `ownership-manifest.md`. Load scorecards, reports, and route SOPs only when the lane needs them.
2. Freeze the lane. Name the surface, environment, run type, visible problem, source of truth, out-of-scope items, and stop condition.
3. Load the smallest credible context. Read owner files and only the retained reports needed for the current question.
4. Measure or inspect first. Use production evidence, KPI capture, runtime audit, browser observation, or targeted tests as appropriate. Label partial evidence.
5. Pick one hotspot. Continue only if the next step reduces uncertainty, lands a bounded fix, or improves future measurement leverage.
6. Execute with cost-of-change discipline. Avoid redesign, duplicate paths, broad refactors, and "while here" cleanup.
7. Validate directly. Use the narrowest proof that covers the change. Local tests validate code; production evidence validates deployed behavior.
8. Retain only useful lessons. Update reports, memory, or training only when the run is substantive enough and the lesson will reduce future drift.
9. Decide stop state. End each meaningful lane as `continue`, `pivot`, `done enough for now`, or `done`.

## Hotspot Filter

Good hotspots:

- Slow cold open with evidence.
- Excessive sign/resolve/fallback churn.
- Weak canonical preview coverage.
- List/render churn tied to visible lag.
- Save/reopen browse-readiness weakness.
- Measurement gap blocking a real decision.

Bad hotspots:

- Adjacent cleanup with no measured impact.
- Dead surfaces.
- Broad refactors without one bottleneck.
- Instrumentation that does not change a decision.

## Challenge Responses

If the user challenges the lane, pause and restate:

- What evidence changed.
- Which old diagnosis weakened or failed.
- Which runtime/product behavior is still being improved.
- Whether the best move is `continue`, `pivot`, or `stop`.

If the user asks whether tools or decisions are valid, answer in layers:

- Direct verdict.
- Tool logic validity.
- Evidence freshness.
- Coverage completeness.
- Best next action.

## Surface Onboarding Rule

A new surface needs:

- Stable surface name.
- Owner files.
- Measurement path.
- Correctness checks.
- Retained baseline or audit note.

Embedded shared browse plus separate persistence authority should be treated as a hybrid candidate surface, not silently added to the panel KPI family.

## Stop Conditions

Stop or escalate when:

- Surface boundary is unclear.
- Measurement path is unavailable and remaining work is guesswork.
- Next change risks correctness or trust without approval.
- Lane expands beyond bounded media performance.
- Next step is no longer worth the churn.
