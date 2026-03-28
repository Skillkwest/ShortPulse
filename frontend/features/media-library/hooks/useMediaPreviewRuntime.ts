/**
 * Route wrapper around the shared Media Library surface preview runtime.
 * Preserves the existing route contract while moving the reusable preview engine behind a shared hook.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import type { MediaTab } from "../logic/mediaMoveRouting";
import {
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
  type MediaTabCache,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";
import { getMediaLibrarySurfaceConfig } from "../runtime";
import { useMediaSurfacePreviewRuntime } from "./useMediaSurfacePreviewRuntime";

type PreviewRuntimeRowBase = {
  id: string;
  storage_path: string;
  file_type: "image" | "video" | string;
  source?: "upload" | "ai_studio" | string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  signedUrl?: string | null;
};

type MediaCardRefCallback = (node: HTMLDivElement | null) => void;

type UseMediaPreviewRuntimeArgs<TRow extends PreviewRuntimeRowBase> = {
  activeMediaQuery: string;
  activeTab: MediaTab;
  applySignedUrlsToSurface?: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  setFiles: Dispatch<SetStateAction<TRow[]>>;
  setFocusedFile: Dispatch<SetStateAction<TRow | null>>;
  setMediaTabCache: Dispatch<SetStateAction<Record<MediaDataTab, MediaTabCache<TRow>>>>;
};

type UseMediaPreviewRuntimeResult<TRow extends PreviewRuntimeRowBase> = {
  activeMediaQueryRef: MutableRefObject<string>;
  activeTabRef: MutableRefObject<MediaTab>;
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  currentUserIdRef: MutableRefObject<string | null>;
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  handleMediaPreviewError: (row: TRow) => void;
  hydrateViaStorageDownload: (row: TRow) => Promise<string | null>;
  isMountedRef: MutableRefObject<boolean>;
  markFirstMediaPaint: (assetKind: "image" | "video") => void;
  mediaSignInFlightRef: MutableRefObject<MediaTabBooleanState>;
  mediaTabRequestRef: MutableRefObject<MediaTabRequestState>;
  resolveSignedUrlsByMediaIds: (tab: MediaDataTab, rows: TRow[]) => Promise<Set<string>>;
  setSignPassNonce: Dispatch<SetStateAction<number>>;
  signAttemptRef: MutableRefObject<Record<string, number>>;
  signBudget: MediaSignBudget;
  signPassNonce: number;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
  ) => Promise<string | null>;
  signedUrlRetryRef: MutableRefObject<Record<string, number>>;
  visibleMediaIdsRef: MutableRefObject<Set<string>>;
  visibleMediaVersion: number;
};

const ROUTE_SURFACE_CONFIG = getMediaLibrarySurfaceConfig("route");

export const useMediaPreviewRuntime = <TRow extends PreviewRuntimeRowBase>({
  activeMediaQuery,
  activeTab,
  applySignedUrlsToSurface,
  setFiles,
  setFocusedFile,
  setMediaTabCache,
}: UseMediaPreviewRuntimeArgs<TRow>): UseMediaPreviewRuntimeResult<TRow> => {
  return useMediaSurfacePreviewRuntime<TRow, MediaTab>({
    activeMediaQuery,
    activeTab,
    applySignedUrlsToSurface,
    firstMediaPaintEventName: "media.route.first_media_paint",
    previewProfile: ROUTE_SURFACE_CONFIG.imageCardPreviewProfile,
    setFiles,
    setFocusedFile,
    setMediaTabCache,
    shouldApplySignedUrlsToActiveRows: (tab) => activeTab === tab,
    signBudgetResolver: ROUTE_SURFACE_CONFIG.signBudgetResolver,
    surface: ROUTE_SURFACE_CONFIG.listSurface,
    visibilityRootMargin: ROUTE_SURFACE_CONFIG.visibilityRootMargin,
  });
};
