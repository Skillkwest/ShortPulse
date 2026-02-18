# ADR 0016: AI Studio Reference Grid Adaptive Delivery And Watchdog

## Status
Accepted

## Date
2026-02-18

## Context
AI Studio shell isolation improvements reduced cross-rail re-render churn, but 50-60 reference sessions still experienced lag from grid delivery/render pressure. The remaining bottlenecks were concentrated in image hydration/decode, virtualization window size, and high-paint card effects.

## Decision
Adopt an adaptive reference-grid runtime that combines:
- selector-based page output decoupling for non-grid orchestration paths,
- strict preview/full URL ladder semantics for card delivery resolution,
- explicit image hydration/decode inflight caps,
- density/pressure-aware virtualization overscan,
- dense-mode visual simplification for card paint paths,
- watchdog-driven degrade levels (0/1/2) with hysteresis using long-task/input-stall/heap signals.

## Consequences
### Positive
- 50-60 reference interaction latency is bounded by explicit gates.
- Grid throughput can degrade gracefully under runtime pressure instead of stalling.
- Debug visibility improves via grid data attributes and perf-audit scenario metrics.

### Tradeoffs
- Runtime behavior now depends on additional feature flags.
- Image hydration staging introduces more internal state in `ReferenceCanvas`.
- Watchdog sampling adds low overhead to long-task/input-stall monitoring.

## Rollout Flags
- `NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE`
- `NEXT_PUBLIC_REFERENCE_GRID_STRICT_PREVIEW_LADDER`
- `NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE`
- `NEXT_PUBLIC_REFERENCE_GRID_DECODE_BUDGET`
- `NEXT_PUBLIC_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION`
- `NEXT_PUBLIC_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY`
- `NEXT_PUBLIC_REFERENCE_GRID_MEMORY_GUARD`
- `NEXT_PUBLIC_REFERENCE_GRID_PERF_WATCHDOG`
- `NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP`
- `NEXT_PUBLIC_REFERENCE_GRID_CSS_CONTAINMENT`
- `NEXT_PUBLIC_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT`
- `NEXT_PUBLIC_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET`
- `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY`
- `NEXT_PUBLIC_REFERENCE_GRID_TELEMETRY_BACKPRESSURE`
- `NEXT_PUBLIC_REFERENCE_GRID_PRECONNECT_HINTS`
- `NEXT_PUBLIC_REFERENCE_GRID_TRANSITION_NONURGENT`
- `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`
- `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE` (`stable` / `legacy` fallback preset)

## Operational Note
- Perf harness runtime remains disabled in production by default and can be enabled only for controlled audits via `NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME=true`.
- CI includes an authenticated production-mode perf gate job (`ai_studio_perf_gate`) when audit credentials are available.
- CI emits a companion notice job (`ai_studio_perf_gate_notice`) when perf-gate secrets are missing.

## Related
- `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`
- `docs/adr/0015-ai-studio-selector-subscribed-shell-isolation.md`
- `docs/sops/sop_media_performance_operations.md`
