/**
 * Media library selector modal for AI Studio.
 * Loads user media/prompts and lets creators add them to the reference grid.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppMessage } from "../../../components/AppMessage";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { createMediaPerfTimer, logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import { MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM } from "../../../lib/mediaPreviewRuntimePolicy";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import {
  MEDIA_MODAL_CACHE_TTL_MS,
  MEDIA_MODAL_PAGE_SIZE,
  createMediaTabCacheState,
  getMediaDataTabForRow,
  isAudioFile,
  isMediaDataTab,
  isNextImageOptimizerUrl,
  isVideoFile,
  normalizeMediaSearchTerm,
  resolveMediaMetadataPromptText,
  resolveMediaMetadataTranscriptText,
  resolveNextImageOptimizerSourceUrl,
  sortByCreatedAtDesc,
  type MediaDataTab,
  type MediaFileRow,
  type MediaTab,
  type MediaTabCache,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryModalControls } from "./media-library-modal/MediaLibraryModalControls";
import { useMediaSurfacePreviewSigning } from "../../media-library/hooks/useMediaSurfacePreviewSigning";
import { useMediaSurfacePreviewRuntime } from "../../media-library/hooks/useMediaSurfacePreviewRuntime";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaTabDataController } from "../../media-library/hooks/useMediaTabDataController";
import { MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED } from "../../media-library/logic/mediaLibraryRuntimeConfig";
import { resolveSignedSelectionUrl } from "../../media-library/logic/mediaPreviewResolver";
import { resolveVisibleMediaRows } from "../../media-library/logic/resolveVisibleMediaRows";
import { getMediaLibrarySurfaceConfig } from "../../media-library/runtime";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type MediaLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video" | "audio";
    createdAt?: string | null;
    filename?: string | null;
    promptText?: string | null;
    transcriptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    previewPosterUrl?: string | null;
    previewPosterStoragePath?: string | null;
    fullUrl?: string | null;
  }) => void;
  onSelectPrompt: (payload: {
    id: string;
    promptText: string;
    createdAt?: string | null;
    title?: string | null;
  }) => void;
};

export function MediaLibraryModal({
  isOpen,
  onClose,
  onSelectMedia,
  onSelectPrompt,
}: MediaLibraryModalProps) {
  const modalSurfaceConfig = getMediaLibrarySurfaceConfig("modal");
  useAiStudioModalActivity("media-library-modal", isOpen);
  const [activeTab, setActiveTab] = useState<MediaTab>("uploaded_images");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<MediaFileRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [mediaTabCache, setMediaTabCache] =
    useState<Record<MediaDataTab, MediaTabCache>>(createMediaTabCacheState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const firstCardShellLoggedRef = useRef(false);
  const openToFirstMediaTimerRef = useRef<ReturnType<typeof createMediaPerfTimer> | null>(null);
  const openToFirstMediaLoggedRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);
  const isOpenRef = useRef(isOpen);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );
  const activeMediaTab = isMediaDataTab(activeTab) ? activeTab : null;
  const activeMediaCache = activeMediaTab ? mediaTabCache[activeMediaTab] : null;
  const adaptivePreviewQualityEnabled = isAdaptiveSurfaceEnabled("media-library-modal-grid");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-modal",
    enabled: isOpen && adaptivePreviewQualityEnabled,
  });
  const activeMediaQuery = useMemo(
    () => normalizeMediaSearchTerm(debouncedSearch),
    [debouncedSearch]
  );

  useVisibleErrorTelemetry({
    source: "telemetry.ai_studio.media_library_modal_error",
    scope: "app",
    severity: "low",
    message: error,
    metadata: {
      active_tab: activeTab,
      modal_open: isOpen,
    },
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const previewRuntime = useMediaSurfacePreviewRuntime<MediaFileRow, MediaTab, HTMLElement>({
    activeMediaQuery,
    activeTab,
    firstMediaPaintEventName: "media.modal.first_media_paint",
    previewProfile: modalSurfaceConfig.imageCardPreviewProfile,
    signBudgetResolver: modalSurfaceConfig.signBudgetResolver,
    surface: modalSurfaceConfig.listSurface,
    visibilityRootMargin: modalSurfaceConfig.visibilityRootMargin,
    setFiles,
    setMediaTabCache,
    shouldApplySignedUrlsToActiveRows: (tab) => isOpenRef.current && activeTab === tab,
    beforeRetry: ({ row: file, failedUrl }) => {
      if (!isNextImageOptimizerUrl(failedUrl)) return;
      const sourceUrl = resolveNextImageOptimizerSourceUrl(failedUrl);
      const tab = getMediaDataTabForRow(file);
      if (sourceUrl) {
        applySignedUrlsToTab(tab, new Map([[file.id, sourceUrl]]));
      }
      setOptimizerFallbackMediaIds((prev) => {
        if (prev.has(file.id)) return prev;
        const next = new Set(prev);
        next.add(file.id);
        return next;
      });
    },
  });
  const {
    activeMediaQueryRef,
    activeTabRef,
    currentUserIdRef,
    getMediaCardRef,
    handleMediaPreviewError,
    markFirstMediaPaint: markSurfaceFirstMediaPaint,
    mediaTabRequestRef,
    refreshSignedUrl,
    signStoragePath,
    signedUrlRetryRef,
    applySignedUrlsToTab,
  } = previewRuntime;

  const markFirstMediaPaint = useCallback(
    (assetKind: "image" | "video") => {
      markSurfaceFirstMediaPaint(assetKind);
      if (!openToFirstMediaLoggedRef.current) {
        openToFirstMediaLoggedRef.current = true;
        openToFirstMediaTimerRef.current?.("media.modal.open_to_first_media", {
          surface: "media-library-modal",
          tab: activeTab,
          asset_kind: assetKind,
          query_mode: activeMediaQuery ? "search" : "default",
        });
      }
    },
    [activeMediaQuery, activeTab, markSurfaceFirstMediaPaint]
  );
  const handleSearchChange = useCallback((nextSearch: string) => {
    setOptimizerFallbackMediaIds(new Set());
    setSearch(nextSearch);
  }, []);
  const handleTabChange = useCallback((nextTab: MediaTab) => {
    setOptimizerFallbackMediaIds(new Set());
    setActiveTab(nextTab);
  }, []);

  const { fetchMediaTabPage } = useMediaTabDataController<MediaFileRow, PromptRow>({
    activeMediaCache,
    activeMediaQuery,
    activeMediaTab,
    activeTab,
    activeTabRef,
    cacheTtlMs: MEDIA_MODAL_CACHE_TTL_MS,
    surface: "media-library-modal",
    currentUserIdRef,
    fetchEnabled: isOpen,
    loadMoreSentinelRef,
    loadMoreObserverRootRef: modalBodyRef as React.MutableRefObject<HTMLElement | null>,
    loadMoreRootMargin: "500px 0px",
    mediaTabCache,
    mediaTabRequestRef,
    pageSize: MEDIA_MODAL_PAGE_SIZE,
    promptsLoaded,
    setError,
    setFiles,
    setLoading,
    setMediaTabCache,
    setPrompts,
    setPromptsLoaded,
  });

  useEffect(() => {
    if (isOpen) {
      // Intentional reset on open to preserve modal session behavior without altering interaction flow.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds(new Set());
      setSearch("");
      setDebouncedSearch("");
      setOptimizerFallbackMediaIds(new Set());
      firstCardShellLoggedRef.current = false;
      setActiveTab((prev) => prev ?? "uploaded_images");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab === "saved_prompts") return;
    openToFirstMediaTimerRef.current = createMediaPerfTimer({
      surface: "media-library-modal",
      tab: activeTab,
      query_mode: activeMediaQuery ? "search" : "default",
    });
    openToFirstMediaLoggedRef.current = false;
  }, [activeMediaQuery, activeTab, isOpen]);

  const promptSearchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const sortedPrompts = useMemo(() => {
    const promptRows = !promptSearchTerm
      ? prompts
      : prompts.filter((prompt) => {
          const title = prompt.title?.toLowerCase() ?? "";
          const text = prompt.prompt_text?.toLowerCase() ?? "";
          return title.includes(promptSearchTerm) || text.includes(promptSearchTerm);
        });
    return sortByCreatedAtDesc(promptRows);
  }, [promptSearchTerm, prompts]);
  const activeMedia = useMemo(() => {
    return resolveVisibleMediaRows({
      rows: files,
      activeMediaTab,
      activeMediaQuery,
      cachedMediaQuery: activeMediaCache?.query,
    });
  }, [activeMediaCache?.query, activeMediaQuery, activeMediaTab, files]);
  const effectiveSignBudget = useMemo(() => {
    if (activeMediaTab !== "private") return previewRuntime.signBudget;
    return {
      ...previewRuntime.signBudget,
      prefetchWindow: Math.min(previewRuntime.signBudget.prefetchWindow, 8),
      signBatchSize: Math.min(previewRuntime.signBudget.signBatchSize, 3),
    };
  }, [activeMediaTab, previewRuntime.signBudget]);

  useMediaSurfacePreviewSigning<MediaFileRow, MediaTab>({
    runtime: previewRuntime,
    activeMediaTab,
    activeMediaCacheLoading: Boolean(activeMediaCache?.loading),
    activeMediaCachePagesLoaded: activeMediaCache?.pagesLoaded ?? 0,
    activeMediaQuery,
    filteredMedia: activeMedia,
    signBudgetOverride: effectiveSignBudget,
    isSigningPassEnabled: isOpen,
    surface: "media-library-modal",
    unresolvedWarningPrefix: "[media-library-modal]",
    maxSignAttemptsPerItem: MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
    maxSignCandidatesPerRow: activeMediaTab === "private" ? 2 : 4,
    isSignPrefetchEnabled: MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
    isResultStillRelevant: ({ tab, query }) =>
      isOpenRef.current && activeTabRef.current === tab && activeMediaQueryRef.current === query,
  });

  const isMediaTab = activeTab !== "saved_prompts";
  const loadingMoreMedia = Boolean(activeMediaCache?.loaded && activeMediaCache?.loading);
  const showBlockingLoading = loading && activeTab !== "saved_prompts" && activeMedia.length === 0;
  const showBackgroundRefreshing =
    isMediaTab && activeMedia.length > 0 && Boolean(activeMediaCache?.loading);
  const hasMoreMediaPages = Boolean(activeMediaCache?.hasMore);
  const handleSelectPromptCard = useCallback(
    (prompt: PromptRow) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(prompt.id);
        return next;
      });
      onSelectPrompt({
        id: prompt.id,
        promptText: prompt.prompt_text,
        createdAt: prompt.created_at ?? null,
        title: prompt.title,
      });
    },
    [onSelectPrompt]
  );
  const handleSelectMediaFile = useCallback(
    async (file: MediaFileRow) => {
      const nextUrl =
        (await resolveSignedSelectionUrl({
          row: file,
          currentUserId: currentUserIdRef.current,
          signStoragePath,
        })) ??
        (await refreshSignedUrl(file)) ??
        file.signedUrl;
      if (!nextUrl) return;
      const previewStoragePath = file.preview_storage_path ?? file.storage_path;
      const isVideo = isVideoFile(file.file_type);
      const previewPosterStoragePath = isVideo
        ? (file.poster_variant_path ?? file.thumb_variant_path ?? null)
        : null;
      const previewPosterUrl = previewPosterStoragePath
        ? await signStoragePath(previewPosterStoragePath, { forceRefresh: true })
        : null;
      const fullStoragePath = file.storage_path;
      const previewUrl = nextUrl;
      const fullUrl =
        (fullStoragePath && fullStoragePath !== previewStoragePath
          ? await signStoragePath(fullStoragePath, { forceRefresh: true })
          : null) ?? nextUrl;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(file.id);
        return next;
      });
      onSelectMedia({
        id: file.id,
        url: nextUrl,
        fileType: isAudioFile(file.file_type) ? "audio" : isVideo ? "video" : "image",
        createdAt: file.created_at ?? null,
        filename: file.filename,
        promptText: resolveMediaMetadataPromptText(file.metadata),
        transcriptText: resolveMediaMetadataTranscriptText(file.metadata),
        source: file.source ?? "upload",
        previewStoragePath,
        previewPosterStoragePath,
        fullStoragePath,
        previewUrl,
        previewPosterUrl,
        fullUrl,
      });
    },
    [currentUserIdRef, onSelectMedia, refreshSignedUrl, signStoragePath]
  );

  useEffect(() => {
    if (!isOpen || loading || firstCardShellLoggedRef.current) return;
    const visibleCount = activeTab === "saved_prompts" ? sortedPrompts.length : activeMedia.length;
    if (visibleCount <= 0) return;
    firstCardShellLoggedRef.current = true;
    logMediaPerf("media.modal.first_card_shell", {
      surface: "media-library-modal",
      tab: activeTab,
      visible_item_count: visibleCount,
    });
  }, [activeMedia.length, activeTab, isOpen, loading, sortedPrompts.length]);

  if (!isOpen) return null;

  return (
    <AiStudioModalLayer>
      <div className="media-library-modal-backdrop" {...backdropDismiss}>
        <div
          className="media-library-modal media-library-modal-packed"
          role="dialog"
          aria-modal="true"
          aria-label="Media library"
          onClick={(event) => event.stopPropagation()}
        >
          <MediaLibraryModalControls
            activeTab={activeTab}
            isMediaTab={isMediaTab}
            search={search}
            onClose={onClose}
            onTabChange={handleTabChange}
            onSearchChange={handleSearchChange}
          />

          <div className="media-library-modal-body" ref={modalBodyRef}>
            {showBlockingLoading ? <p className="tiny subdued">Loading media library…</p> : null}
            {showBackgroundRefreshing ? <p className="tiny subdued">Refreshing media…</p> : null}
            {error ? <AppMessage tone="error" mode="inline" message={error} /> : null}

            {!showBlockingLoading && !error && activeTab === "saved_prompts" ? (
              <MediaLibraryPromptGrid
                prompts={prompts}
                sortedPrompts={sortedPrompts}
                selectedIds={selectedIds}
                onSelectPromptCard={handleSelectPromptCard}
              />
            ) : null}

            {!showBlockingLoading && !error && isMediaTab ? (
              <>
                <MediaLibraryMediaGrid
                  activeMedia={activeMedia}
                  selectedIds={selectedIds}
                  optimizerFallbackMediaIds={optimizerFallbackMediaIds}
                  adaptivePressureLevel={mediaAdaptivePressure.previewPressureLevel}
                  adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
                  scrollContainerRef={modalBodyRef as React.MutableRefObject<HTMLElement | null>}
                  getMediaCardRef={getMediaCardRef}
                  onSelectMediaFile={(file) => {
                    void handleSelectMediaFile(file);
                  }}
                  onMediaPreviewError={handleMediaPreviewError}
                  onMediaPaint={markFirstMediaPaint}
                  onSignedUrlLoaded={(id) => {
                    signedUrlRetryRef.current[id] = 0;
                  }}
                  onRequestSignedUrl={refreshSignedUrl}
                />
                {hasMoreMediaPages ? (
                  <div className="media-load-more" ref={loadMoreSentinelRef}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (!activeMediaTab) return;
                        void fetchMediaTabPage(activeMediaTab, {
                          query: activeMediaQuery,
                          reason: "load_more",
                        });
                      }}
                      disabled={loadingMoreMedia}
                    >
                      {loadingMoreMedia ? "Loading more..." : "Load more"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
