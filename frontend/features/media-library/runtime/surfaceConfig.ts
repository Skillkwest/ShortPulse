/**
 * Shared Media Library surface config.
 * Centralizes route, modal, and panel runtime knobs so future adapters do not duplicate them.
 */
import { resolveModalSignBudget } from "../../ai-studio/logic/mediaLibraryModalModel";
import { resolveMediaPreviewSignBudget } from "../../../lib/mediaPreviewRuntimePolicy";
import { resolveRouteSignBudget } from "../logic/mediaLibraryPageHelpers";
import type { MediaLibrarySurfaceConfig, MediaLibrarySurfaceKind } from "./types";

const PANEL_SIGN_SMALL_SCREEN_QUERY = "(max-width: 900px)";

const PANEL_SIGN_BUDGET_DESKTOP = {
  initialSignLimit: 4,
  prefetchWindow: 4,
  signBatchSize: 4,
};

const PANEL_SIGN_BUDGET_SMALL_SCREEN = {
  initialSignLimit: 3,
  prefetchWindow: 3,
  signBatchSize: 3,
};

const PANEL_SIGN_BUDGET_CONSTRAINED = {
  initialSignLimit: 2,
  prefetchWindow: 2,
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

export const MEDIA_LIBRARY_SURFACE_CONFIG: Record<
  MediaLibrarySurfaceKind,
  MediaLibrarySurfaceConfig
> = {
  route: {
    kind: "route",
    listSurface: "media-library-route",
    listProfile: "minimal",
    adaptiveSurface: "media-library-grid",
    imageCardPreviewProfile: "media-library-route-image-card",
    pageSize: 60,
    cacheTtlMs: 30_000,
    loadMoreRootMargin: "600px 0px",
    visibilityRootMargin: "520px 0px",
    signBudgetResolver: resolveRouteSignBudget,
  },
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
