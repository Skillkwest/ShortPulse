# AI Studio Reference Grid Stabilization Plan (v4)

## Goal
Stabilize AI Studio interactions in the 50-60 reference zone without introducing third-party prop/state libraries.

## Final Decisions
- Keep current architecture and selector store strategy.
- Prioritize grid delivery/render controls first, then complete remaining output-coupling cleanup.
- Keep browser-native perf audits (`runReferenceGridAudit`, `runStudioShellAudit`) as release gates.

## Scope
- Selector-based output decoupling in page orchestration.
- Strict preview/full delivery semantics for reference cards.
- Decode/hydration concurrency budgets for images.
- Adaptive virtualization and RAF-throttled scroll sync.
- Dense-mode visual simplification for paint-heavy card effects.
- Perf watchdog + memory guard degrade levels with hysteresis.

## Runtime Flags
- `NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE`
- `NEXT_PUBLIC_REFERENCE_GRID_STRICT_PREVIEW_LADDER`
- `NEXT_PUBLIC_REFERENCE_GRID_DECODE_BUDGET`
- `NEXT_PUBLIC_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION`
- `NEXT_PUBLIC_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY`
- `NEXT_PUBLIC_REFERENCE_GRID_MEMORY_GUARD`
- `NEXT_PUBLIC_REFERENCE_GRID_PERF_WATCHDOG`

## Perf Harness Gates
- Grid gates at count 60:
  - `grid_click_p95_ms_at_60 <= 120`
  - `grid_long_task_p95_ms_at_60 <= 100`
  - `grid_max_input_stall_ms_at_60 <= 800`
  - `rendered_item_count_p95_at_60 <= 28`
- Existing shell gates remain unchanged.

## Validation
- `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
- `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
- Manual flows:
  - drag/drop files
  - media URL paste
  - prompt paste
  - archive/restore
  - agent describe + add-to-grid
