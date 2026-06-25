# ADR 0013: AI Studio Reference Grid Bounded-Work Architecture

## Status

Accepted (February 17, 2026); amended for July 7 launch cap (June 12, 2026); amended for browser-load cap (June 13, 2026)

## Context

AI Studio Reference Grid degrades under large mixed-media sessions because client work scales linearly with card count across multiple dimensions:

- local upload previews were stored as heavy payloads,
- output lifecycle updates and poll churn triggered frequent broad rerenders,
- visual/compositing cost remained high as card density increased,
- active card count had no bounded hot-path cap.

Existing direction in ADR 0009 established derivative-first delivery + virtualization, but the session-local Reference Grid still needed explicit bounded-work controls for large-card-count smoothness targets.

## Decision

Adopt a bounded-work runtime for AI Studio Reference Grid:

1. Intake memory control

- Prefer object-URL previews for local uploads.
- Add deterministic object-URL cleanup during output lifecycle changes.

2. Output metadata for adaptive delivery

- Extend `StudioOutput` with media source + preview tier + preview/full path hints.

3. Soft archive by default

- Keep the newest active references in the hot path.
- For the July 7 launch window, cap the visible active Reference Grid workset at 128 items.
- Start high-density pressure at 96 items so the grid reduces browser work before it reaches the hard cap.
- Move older over-cap cards into an archived bucket with restore actions instead of dropping them.
- Project persistence must preserve project-restorable archived/cold rows separately from the hot active workset so reopening a project does not silently discard over-cap media.

4. Update backpressure

- Deduplicate no-op output patches.
- Throttle non-critical progress/status UI updates.

5. High-density render posture

- Lower virtualization activation threshold.
- Apply high-density styling reductions to limit expensive paint/compositing costs.

6. Telemetry

- Add explicit Reference Grid performance events for render commits, long tasks, heap samples, and archive transitions.

## Consequences

- Positive:
  - Significant reduction in memory pressure and main-thread contention at high card counts.
  - Better interaction reliability while preserving existing UX semantics (autoplay preserved, restore available).
  - Clear operational telemetry for regressions and tuning.
- Negative:
  - Increased state/orchestration complexity (active + archived outputs).
  - Requires disciplined cleanup handling for local object URLs.
- Follow-ups:
  - Continue toward normalized output storage for deeper O(1) update guarantees.
  - Add perf-harness baselines for 96/128-card profiles and archive-restore flows.
  - Revisit adaptive preview tiering once derivative coverage is fully deployed.

## Alternatives considered

- Knob-only tuning: rejected as insufficient durability.
- Renderer/library swap alone: rejected as incomplete without state/memory controls.
- Server-windowing only: rejected because mixed session-local references remain client hot-path.
