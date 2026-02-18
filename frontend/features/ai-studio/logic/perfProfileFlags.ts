/**
 * AI Studio performance profile defaults with explicit env override support.
 * `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE=stable|legacy` controls fallback behavior
 * when individual flags are not set.
 */
type PerfProfileName = "stable" | "legacy";

const PERF_PROFILE_RAW = (process.env.NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE ?? "stable")
  .trim()
  .toLowerCase();
const PERF_PROFILE_VALID = PERF_PROFILE_RAW === "stable" || PERF_PROFILE_RAW === "legacy";

export const AI_STUDIO_PERF_PROFILE: PerfProfileName =
  PERF_PROFILE_RAW === "legacy" ? "legacy" : "stable";

if (!PERF_PROFILE_VALID && process.env.NODE_ENV !== "test") {
  console.warn(
    `[ai-studio][perf-profile] Unknown NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE="${PERF_PROFILE_RAW}". Falling back to "stable".`
  );
}

const resolveBooleanFlag = (rawValue: string | undefined, fallback: boolean): boolean => {
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  return fallback;
};

const STABLE_DEFAULTS = {
  outputSelectorStore: true,
  selectorCallbacks: true,
  pageOutputDecouple: true,
  referenceGridPreconnectHints: true,
  perfAuditRuntime: false,
  shellDecouple: true,
  shellDndBackpressure: true,
  shellPanelMemoization: true,
  shellBoundarySplit: true,
  shellHighDensityMode: true,
  referenceGridAdaptivePreview: true,
  referenceGridCuratedSplit: true,
  referenceGridStrictPreviewLadder: true,
  referenceGridDecodeBudget: true,
  referenceGridDynamicVirtualization: true,
  referenceGridDenseVisualSimplify: true,
  referenceGridMemoryGuard: true,
  referenceGridPerfWatchdog: true,
  referenceGridHardViewportCap: true,
  referenceGridCssContainment: true,
  referenceGridLoadingPlaceholderTimeout: true,
  referenceGridGlobalMediaBudget: true,
  referenceGridAdaptivePreviewQuality: true,
  referenceGridTelemetryBackpressure: true,
  referenceGridTransitionNonUrgent: true,
  referenceGridRenderCommitTelemetry: false,
  referenceGridUpdateBackpressure: true,
  rafStatusFlush: true,
} as const;

const LEGACY_DEFAULTS = {
  outputSelectorStore: true,
  selectorCallbacks: true,
  pageOutputDecouple: true,
  referenceGridPreconnectHints: false,
  perfAuditRuntime: false,
  shellDecouple: true,
  shellDndBackpressure: true,
  shellPanelMemoization: true,
  shellBoundarySplit: true,
  shellHighDensityMode: true,
  referenceGridAdaptivePreview: true,
  referenceGridCuratedSplit: true,
  referenceGridStrictPreviewLadder: true,
  referenceGridDecodeBudget: true,
  referenceGridDynamicVirtualization: true,
  referenceGridDenseVisualSimplify: true,
  referenceGridMemoryGuard: true,
  referenceGridPerfWatchdog: true,
  referenceGridHardViewportCap: false,
  referenceGridCssContainment: false,
  referenceGridLoadingPlaceholderTimeout: false,
  referenceGridGlobalMediaBudget: false,
  referenceGridAdaptivePreviewQuality: false,
  referenceGridTelemetryBackpressure: false,
  referenceGridTransitionNonUrgent: false,
  referenceGridRenderCommitTelemetry: false,
  referenceGridUpdateBackpressure: false,
  rafStatusFlush: false,
} as const;

const PROFILE_DEFAULTS = AI_STUDIO_PERF_PROFILE === "legacy" ? LEGACY_DEFAULTS : STABLE_DEFAULTS;

export const PERF_FLAG_OUTPUT_SELECTOR_STORE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE,
  PROFILE_DEFAULTS.outputSelectorStore
);
export const PERF_FLAG_SELECTOR_CALLBACKS = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_SELECTOR_CALLBACKS,
  PROFILE_DEFAULTS.selectorCallbacks
);
export const PERF_FLAG_PAGE_OUTPUT_DECOUPLE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE,
  PROFILE_DEFAULTS.pageOutputDecouple
);
export const PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_PRECONNECT_HINTS,
  PROFILE_DEFAULTS.referenceGridPreconnectHints
);
export const PERF_FLAG_AUDIT_RUNTIME = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME,
  PROFILE_DEFAULTS.perfAuditRuntime
);
export const PERF_FLAG_SHELL_DECOUPLE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_SHELL_DECOUPLE,
  PROFILE_DEFAULTS.shellDecouple
);
export const PERF_FLAG_SHELL_DND_BACKPRESSURE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_DND_BACKPRESSURE,
  PROFILE_DEFAULTS.shellDndBackpressure
);
export const PERF_FLAG_SHELL_PANEL_MEMOIZATION = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_PANEL_MEMOIZATION,
  PROFILE_DEFAULTS.shellPanelMemoization
);
export const PERF_FLAG_SHELL_BOUNDARY_SPLIT = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_SHELL_BOUNDARY_SPLIT,
  PROFILE_DEFAULTS.shellBoundarySplit
);
export const PERF_FLAG_SHELL_HIGH_DENSITY_MODE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_HIGH_DENSITY_SHELL_MODE,
  PROFILE_DEFAULTS.shellHighDensityMode
);
export const PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW,
  PROFILE_DEFAULTS.referenceGridAdaptivePreview
);
export const PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT,
  PROFILE_DEFAULTS.referenceGridCuratedSplit
);
export const PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_STRICT_PREVIEW_LADDER,
  PROFILE_DEFAULTS.referenceGridStrictPreviewLadder
);
export const PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_DECODE_BUDGET,
  PROFILE_DEFAULTS.referenceGridDecodeBudget
);
export const PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION,
  PROFILE_DEFAULTS.referenceGridDynamicVirtualization
);
export const PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY,
  PROFILE_DEFAULTS.referenceGridDenseVisualSimplify
);
export const PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_MEMORY_GUARD,
  PROFILE_DEFAULTS.referenceGridMemoryGuard
);
export const PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_PERF_WATCHDOG,
  PROFILE_DEFAULTS.referenceGridPerfWatchdog
);
export const PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP,
  PROFILE_DEFAULTS.referenceGridHardViewportCap
);
export const PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_CSS_CONTAINMENT,
  PROFILE_DEFAULTS.referenceGridCssContainment
);
export const PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT,
  PROFILE_DEFAULTS.referenceGridLoadingPlaceholderTimeout
);
export const PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET,
  PROFILE_DEFAULTS.referenceGridGlobalMediaBudget
);
export const PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY,
  PROFILE_DEFAULTS.referenceGridAdaptivePreviewQuality
);
export const PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_TELEMETRY_BACKPRESSURE,
  PROFILE_DEFAULTS.referenceGridTelemetryBackpressure
);
export const PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_TRANSITION_NONURGENT,
  PROFILE_DEFAULTS.referenceGridTransitionNonUrgent
);
export const PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY,
  PROFILE_DEFAULTS.referenceGridRenderCommitTelemetry
);
export const PERF_FLAG_REFERENCE_GRID_UPDATE_BACKPRESSURE = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE,
  PROFILE_DEFAULTS.referenceGridUpdateBackpressure
);
export const PERF_FLAG_RAF_STATUS_FLUSH = resolveBooleanFlag(
  process.env.NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH,
  PROFILE_DEFAULTS.rafStatusFlush
);
