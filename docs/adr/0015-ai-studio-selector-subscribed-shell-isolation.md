# ADR 0015: AI Studio Selector-Subscribed Shell Isolation

## Status
Accepted (February 18, 2026)

## Context
ADR 0014 reduced shell drag/drop churn and improved memoization, but the page orchestration layer still depended heavily on full `outputs` arrays. At ~50-60 references, non-grid shell sections (toolbar/properties/preview) were still rerendering on unrelated output updates.

The remaining bottleneck was state coupling, not grid virtualization or DnD transport.

## Decision
Adopt a selector-subscribed output-store architecture and split shell boundaries:

1. Introduce `aiStudioOutputStore` using `useSyncExternalStore` with indexed output snapshots.
2. Expose id/index selectors (`useOutputSelector`, `useOutputById`, `useOutputCounts`, `useVisibleOutputWindow`) and migrate non-grid lookups away from broad arrays.
3. Extend `useAiStudioState` with:
   - `getOutputById`
   - `subscribeOutputs`
   - `getOutputSnapshot`
4. Split shell rendering into dedicated boundary components:
   - `AiStudioShellFrame`
   - `AiStudioToolbarRail`
   - `AiStudioPropertiesRail`
   - `AiStudioReferenceRail`
   - `AiStudioPreviewRail`
5. Add shell section render counters and 60-reference shell gates to the in-browser audit API.
6. Add `requestAnimationFrame` status flush and transition-priority scheduling for non-urgent task status updates.

Feature flags:
- `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE`
- `NEXT_PUBLIC_AI_STUDIO_SHELL_BOUNDARY_SPLIT`
- `NEXT_PUBLIC_AI_STUDIO_SELECTOR_CALLBACKS`
- `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`

## Consequences
- Positive:
  - Non-grid sections subscribe to narrow slices instead of broad output arrays.
  - Shell rerender behavior is measurable at section granularity.
  - Poll/status churn has lower synchronous UI pressure under active generation.
- Negative:
  - Added custom store complexity and additional rollout flags.
  - More moving parts in shell composition and performance instrumentation.

## Alternatives Considered
- Memo/callback tuning only: insufficient, because parent-level output coupling remained.
- Third-party DnD migration: not aligned with the dominant bottleneck.
- Full state-library migration now: higher migration risk and larger API churn than needed for this phase.

