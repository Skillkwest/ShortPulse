/**
 * Shared Media Library surface config.
 * Centralizes modal and panel runtime knobs so future adapters do not duplicate them.
 */
import { resolveModalSignBudget } from "../../ai-studio/logic/mediaLibraryModalModel";
import { resolveMediaPreviewSignBudget } from "../../../lib/mediaPreviewRuntimePolicy";
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
 * Downshifts the eager sign budget for the mixed `All Media` root tab without weakening
 * the dedicated image/video tabs that already measure well.
 */
export const resolvePanelMixedAllMediaSignBudget = (budget: MediaSignBudget): MediaSignBudget => ({
  initialSignLimit: Math.max(1, Math.min(budget.initialSignLimit, 2)),
  prefetchWindow: Math.max(1, Math.min(budget.prefetchWindow, 3)),
  signBatchSize: Math.max(1, Math.min(budget.signBatchSize, 2)),
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
    listSurface: "media-library-panel",
    listProfile: "expanded",
    adaptiveSurface: "media-library-panel-grid",
    imageCardPreviewProfile: "media-library-panel-image-card",
    pageSize: 36,
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
