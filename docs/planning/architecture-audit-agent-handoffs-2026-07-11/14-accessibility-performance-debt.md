# Next-Agent Handoff: Accessibility And Measured Performance Debt

Lane id: `architecture-audit-14-accessibility-performance-debt`

Status: isolated fixes first; broad optimization only after measurement. Current video/reference UI files may be overlap-gated.

## Copy/Paste Assignment

Close confirmed desktop accessibility defects and establish evidence-driven performance budgets. Preserve intended UI and visual behavior. Do not treat file size, component size, or theoretical mobile concerns as automatic refactor authority.

## Required Context

Read first:

- `AGENTS.md`, desktop-first policy, accessibility/UI conventions, AI Studio right-rail ADR/SOPs, and performance guidance

Inspect first:

- lip-sync upload control and corresponding tests
- shared dialog/modal primitives and focus handling
- Reference Grid and guest-surface animation behavior
- built route CSS/JS chunks and bundle analysis
- object URL/blob registries and pressure/long-task telemetry
- Admin Kanban loading/query limits and actual production scale metrics

## Confirmed Problems And Decisions

- Lip-sync upload needs a semantic keyboard-operable control: do now once overlap clears.
- Dialog focus management should be fixed in a shared primitive, after inventorying current consumers.
- Reduced-motion coverage is specifically needed on confirmed Reference Grid/guest animations; do not apply an untested app-wide override.
- CSS restructuring, lazy loading, and registry bounding require measurements first.
- Large-file warnings are hotspot signals, not permission to split every file.
- Admin's 10k query ceiling should wait for observed scale/latency evidence unless current production metrics prove urgency.

## Owned Write Surface

- semantic lip-sync upload control
- shared dialog focus trap, initial focus, return focus, Escape, and background isolation
- scoped `prefers-reduced-motion` behavior for confirmed animations
- bundle/CSS/runtime-pressure measurement scripts or reports
- narrowly proven lazy-load, registry-bound, or chunk fixes
- focused accessibility, keyboard, focus, motion, and performance regression tests

## Avoid Surface

- mobile-specific polish or touch-only redesign
- visual redesign of AI Studio or Reference Grid
- route-thinness/global component refactor
- arbitrary file splitting to satisfy warning thresholds
- Admin pagination/rearchitecture without scale evidence
- overlapping Video/Reference UI files owned by current work

## Implementation Sequence

1. Fresh-check overlap and ship the isolated semantic upload fix with tests.
2. Inventory dialog consumers; repair the owning shared primitive and regression-test representative dialogs.
3. Add scoped reduced-motion rules and verify default motion is unchanged.
4. Capture production-representative desktop route chunks, CSS duplication, long tasks, memory/object-URL counts, and Admin data volumes.
5. Rank measured hotspots by user impact and risk.
6. Implement only the top bounded optimization, then remeasure and ratchet its budget.

## Acceptance Criteria

- Upload is operable and announced correctly by keyboard/screen-reader semantics.
- Dialog focus cannot escape, returns correctly, and respects Escape/background isolation.
- Confirmed motion-heavy surfaces honor reduced-motion without breaking default visuals.
- Every performance change cites a baseline, target, after-measurement, and regression budget.
- No intended desktop behavior or workspace-global right-rail authority changes.

## Validation And Proof

- Run focused component tests and desktop keyboard/focus manual checks.
- Test `prefers-reduced-motion` on the exact affected surfaces.
- Measure production-like optimized builds; development timing is not performance proof.
- For live proof use `https://www.shortpulse.ai`, never localhost as deployed evidence.

## Stop Rules

- Stop on overlapping UI ownership.
- Do not broaden into mobile work.
- Do not optimize an unmeasured hotspot or accept a regression hidden by aggregate bundle totals.
