# ADR 0014: AI Studio Shell Decoupling and Event Backpressure

## Status
Accepted (February 18, 2026)

## Context
After bounded-work improvements to the Reference Grid, user-reported lag shifted to the wider AI Studio shell once sessions reached moderate reference counts (~50+ cards). The dominant symptoms were:
- slow workflow tab switching,
- delayed properties-panel interactions,
- sluggish drag/drop handling outside the grid itself.

Profiling showed shell-wide rerenders and high-frequency drag event churn as primary contributors, rather than raw grid rendering cost.

## Decision
Adopt shell decoupling plus drag/drop backpressure as the next performance baseline:

1. Memoize and stabilize shell-facing props/hooks so non-grid panels are not invalidated by unrelated output churn.
2. Keep native HTML5 drag/drop and route right-column DnD through a dedicated controller with optional RAF-throttled mode updates.
3. Add selector-style output accessors for non-grid surfaces to reduce broad array coupling.
4. Add a browser-native shell performance audit (`runStudioShellAudit`) alongside existing grid audit APIs.
5. Gate rollout with feature flags:
   - `NEXT_PUBLIC_AI_STUDIO_SHELL_DECOUPLE`
   - `NEXT_PUBLIC_AI_STUDIO_DND_BACKPRESSURE`
   - `NEXT_PUBLIC_AI_STUDIO_PANEL_MEMOIZATION`
   - `NEXT_PUBLIC_AI_STUDIO_HIGH_DENSITY_SHELL_MODE`

## Consequences
- Positive:
  - Better responsiveness in toolbar/panel/drop surfaces under medium and large reference counts.
  - Lower dragover-induced state churn and fewer unnecessary shell paints.
  - Measurable shell acceptance gates in the same in-browser harness flow as reference-grid gates.
- Negative:
  - Increased composition complexity between page orchestration hooks and shell components.
  - Additional feature flags to manage during rollout.

## Alternatives Considered
- Third-party DnD package as primary fix: rejected due runtime overhead and weak alignment with rerender-root-cause.
- CSS-only tuning: rejected as insufficient without event/render decoupling.
- Grid-only tuning follow-up: rejected because remaining bottleneck is shell-level interaction work.
