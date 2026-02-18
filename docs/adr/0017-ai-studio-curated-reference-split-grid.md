# ADR 0017: AI Studio Curated Reference Split Grid

## Status
Accepted

## Date
2026-02-18

## Context
AI Studio users needed a faster way to stage a small working set of references without losing the existing all-references workflow and without adding new persistence or backend writes. The current single-grid surface made frequent “focus subset” workflows slower under higher output counts.

The solution needed to preserve:
- existing reference-grid perf harness selectors and telemetry paths,
- existing adaptive preview/watchdog/media budget runtime,
- session-only behavior for curated selections (no Supabase curated list),
- safe rollback during rollout.

## Decision
Implement a split reference grid inside one `ReferenceCanvas` runtime:
- top `Curated` section with session-memory ids only,
- bottom `All refs` section with existing behavior and selector hooks preserved,
- horizontal keyboard + pointer divider (default 35/65 split),
- curated population only via internal drag from All refs,
- drag-origin contract via `text/reference-source-surface`,
- curated implies `pinned=true` to prevent soft-archive eviction while curated,
- deterministic curated cleanup on delete/reset/stale-id pruning,
- rollout kill switch via `NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT`.

## Consequences
### Positive
- Faster reference curation loop for active sessions.
- No backend schema/storage changes required.
- Existing perf runtime (watchdog/hydration/media budget) remains shared and centralized.
- Rollback remains one env-flag change.

### Tradeoffs
- `ReferenceCanvas` gains additional split-surface complexity.
- Duplicate card rendering for curated ids requires duplicate-safe video/observer bookkeeping.
- Additional UI state (split ratio + curated drag state) is session-local and intentionally non-persistent.

## Rollout Flag
- `NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT` (default `true`)

## Alternatives Considered
- Two independent `ReferenceCanvas` instances.
  - Rejected due duplicated runtime observers/budgets and higher perf regression risk.
- Pre-emptive large subsystem refactor before split feature.
  - Rejected due churn/risk versus targeted feature scope.

## Related
- `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`
- `docs/sops/sop_media_performance_operations.md`
