/**
 * Shared Media Library surface signing hook.
 * Centralizes sign-controller wiring so surfaces consume one signing seam instead of owning nonce/visibility plumbing directly.
 */
import type { MediaDataTab, MediaSignBudget } from "../logic/mediaLibraryPageHelpers";
import { useMediaPreviewSigningController } from "./useMediaPreviewSigningController";
import type { UseMediaSurfacePreviewRuntimeResult } from "./useMediaSurfacePreviewRuntime";

type PreviewSigningRowBase = {
  id: string;
  storage_path: string;
  source?: string | null;
  file_type: string;
  status?: "uploading" | "ready";
  signedUrl?: string | null;
};

type UseMediaSurfacePreviewSigningArgs<TRow extends PreviewSigningRowBase, TTab extends string> = {
  runtime: Pick<
    UseMediaSurfacePreviewRuntimeResult<TRow, TTab>,
    | "activeMediaQueryRef"
    | "activeTabRef"
    | "applySignedUrlsToTab"
    | "currentUserIdRef"
    | "hydrateViaStorageDownload"
    | "isMountedRef"
    | "mediaSignInFlightRef"
    | "resolveSignedUrlsByMediaIds"
    | "setSignPassNonce"
    | "signAttemptRef"
    | "signBudget"
    | "signPassNonce"
    | "visibleMediaIdsRef"
    | "visibleMediaVersion"
  >;
  activeMediaTab: MediaDataTab | null;
  activeMediaCacheLoading: boolean;
  activeMediaCachePagesLoaded: number;
  activeMediaQuery: string;
  filteredMedia: TRow[];
  signBudgetOverride?: MediaSignBudget;
  isSigningPassEnabled?: boolean;
  isSignPrefetchEnabled?: boolean;
  surface?: "media-library-modal" | "media-library-panel" | "elements-media-panel";
  unresolvedWarningPrefix?: string;
  isResultStillRelevant?: (params: { tab: MediaDataTab; query: string }) => boolean;
  maxSignAttemptsPerItem?: number;
  maxSignCandidatesPerRow?: number;
  backgroundHydrateFallbackEnabled?: boolean;
};

/**
 * Runs shared preview signing for a Media Library surface using the shared preview runtime state.
 */
export const useMediaSurfacePreviewSigning = <
  TRow extends PreviewSigningRowBase,
  TTab extends string,
>({
  runtime,
  activeMediaTab,
  activeMediaCacheLoading,
  activeMediaCachePagesLoaded,
  activeMediaQuery,
  filteredMedia,
  signBudgetOverride,
  isSigningPassEnabled,
  isSignPrefetchEnabled,
  surface,
  unresolvedWarningPrefix,
  isResultStillRelevant,
  maxSignAttemptsPerItem,
  maxSignCandidatesPerRow,
  backgroundHydrateFallbackEnabled,
}: UseMediaSurfacePreviewSigningArgs<TRow, TTab>) => {
  useMediaPreviewSigningController<TRow, TTab>({
    activeMediaTab,
    activeMediaCacheLoading,
    activeMediaCachePagesLoaded,
    activeMediaQuery,
    activeMediaQueryRef: runtime.activeMediaQueryRef,
    activeTabRef: runtime.activeTabRef,
    applySignedUrlsToTab: runtime.applySignedUrlsToTab,
    currentUserIdRef: runtime.currentUserIdRef,
    filteredMedia,
    hydrateViaStorageDownload: runtime.hydrateViaStorageDownload,
    isMountedRef: runtime.isMountedRef,
    mediaSignInFlightRef: runtime.mediaSignInFlightRef,
    resolveSignedUrlsByMediaIds: runtime.resolveSignedUrlsByMediaIds,
    setSignPassNonce: runtime.setSignPassNonce,
    signAttemptRef: runtime.signAttemptRef,
    signBudget: signBudgetOverride ?? runtime.signBudget,
    signPassNonce: runtime.signPassNonce,
    visibleMediaIdsRef: runtime.visibleMediaIdsRef,
    visibleMediaVersion: runtime.visibleMediaVersion,
    isSigningPassEnabled,
    isSignPrefetchEnabled,
    surface,
    unresolvedWarningPrefix,
    isResultStillRelevant,
    maxSignAttemptsPerItem,
    maxSignCandidatesPerRow,
    backgroundHydrateFallbackEnabled,
  });
};
