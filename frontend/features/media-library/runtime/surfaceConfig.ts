/**
 * Shared Media Library surface config.
 * Centralizes modal and panel runtime knobs so future adapters do not duplicate them.
 */
import { resolveModalSignBudget } from "../../ai-studio/logic/mediaLibraryModalModel";
import { resolveMediaPreviewSignBudget } from "../../../lib/mediaPreviewRuntimePolicy";
import { MEDIA_LIBRARY_PANEL_MAX_COLUMNS } from "../logic/mediaLibraryRuntimeConfig";
import type { MediaLibrarySurfaceConfig, MediaLibrarySurfaceKind } from "./types";
import type { MediaSignBudget } from "../../../lib/mediaPreviewRuntimePolicy";

const PANEL_SIGN_SMALL_SCREEN_QUERY = "(max-width: 900px)";

const PANEL_SIGN_BUDGET_DESKTOP = {
  initialSignLimit: 6,
  prefetchWindow: 8,
  signBatchSize: 4,
};

const PANEL_SIGN_BUDGET_SMALL_SCREEN = {
  initialSignLimit: 5,
  prefetchWindow: 6,
  signBatchSize: 3,
};

const PANEL_SIGN_BUDGET_CONSTRAINED = {
  initialSignLimit: 3,
  prefetchWindow: 4,
  signBatchSize: 2,
};

/**
 * Resolves the canonical sign-budget profile for the AI Studio Media Library panel.
 */
export const resolvePanelSignBudget = () =>
  resolveMediaPreviewSignBudget({
    desktop: PANEL_SIGN_BUDGET_DESKTOP,
    smallScreen: PANEL_SIGN_BUDGET_SMALL_SCREEN,
    constrained: PANEL_SIGN_BUDGET_CONSTRAINED,
    smallScreenQuery: PANEL_SIGN_SMALL_SCREEN_QUERY,
  });

/**
 * Keeps the mixed `All Media` root tab modest so first open does not over-spend signing work.
 */
export const resolvePanelMixedAllMediaSignBudget = (budget: MediaSignBudget): MediaSignBudget => ({
  initialSignLimit: Math.max(
    MEDIA_LIBRARY_PANEL_MAX_COLUMNS,
    Math.min(budget.initialSignLimit, MEDIA_LIBRARY_PANEL_MAX_COLUMNS)
  ),
  prefetchWindow: Math.max(
    MEDIA_LIBRARY_PANEL_MAX_COLUMNS,
    Math.min(budget.prefetchWindow, MEDIA_LIBRARY_PANEL_MAX_COLUMNS + 1)
  ),
  signBatchSize: Math.max(
    MEDIA_LIBRARY_PANEL_MAX_COLUMNS,
    Math.min(budget.signBatchSize, MEDIA_LIBRARY_PANEL_MAX_COLUMNS)
  ),
});

export const MEDIA_LIBRARY_SURFACE_CONFIG: Record<
  MediaLibrarySurfaceKind,
  MediaLibrarySurfaceConfig
> = {
  modal: {
    kind: "modal",
    listSurface: "media-library-modal",
    listProfile: "expanded",
    adaptiveSurface: "media-library-modal-grid",
    imageCardPreviewProfile: "media-library-modal-image-card",
    pageSize: 36,
    cacheTtlMs: 60_000,
    loadMoreRootMargin: "500px 0px",
    visibilityRootMargin: "460px 0px",
    signBudgetResolver: resolveModalSignBudget,
  },
  panel: {
    kind: "panel",
    // Elements and Character panels share this runtime adapter while preserving
    // their own MediaListSurface labels for API telemetry and signing policy.
    listSurface: "media-library-panel",
    listProfile: "expanded",
    adaptiveSurface: "media-library-panel-grid",
    imageCardPreviewProfile: "media-library-panel-image-card",
    pageSize: 18,
    cacheTtlMs: null,
    loadMoreRootMargin: "600px 0px",
    visibilityRootMargin: "460px 0px",
    signBudgetResolver: resolvePanelSignBudget,
  },
};

/**
 * Returns the shared runtime config for a Media Library surface adapter.
 */
export const getMediaLibrarySurfaceConfig = (
  kind: MediaLibrarySurfaceKind
): MediaLibrarySurfaceConfig => MEDIA_LIBRARY_SURFACE_CONFIG[kind];
