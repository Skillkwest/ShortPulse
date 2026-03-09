/**
 * Media library selector modal for AI Studio.
 * Loads user media/prompts and lets creators add them to the reference grid.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { createMediaPerfTimer, logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import {
  MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
  type MediaSignBudget,
} from "../../../lib/mediaPreviewRuntimePolicy";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import {
  BUCKET,
  MEDIA_MODAL_CACHE_TTL_MS,
  MEDIA_MODAL_PAGE_SIZE,
  createMediaTabBooleanState,
  createMediaTabCacheState,
  createMediaTabRequestState,
  getMediaDataTabForRow,
  isMediaDataTab,
  isNextImageOptimizerUrl,
  isVideoFile,
  normalizeMediaSearchTerm,
  resolveMediaMetadataPromptText,
  resolveModalSignBudget,
  resolveNextImageOptimizerSourceUrl,
  sortByCreatedAtDesc,
  type MediaCardRefCallback,
  type MediaDataTab,
  type MediaFileRow,
  type MediaTab,
  type MediaTabBooleanState,
  type MediaTabCache,
  type MediaTabRequestState,
  type NavigatorWithConnection,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryModalControls } from "./media-library-modal/MediaLibraryModalControls";
import { useMediaPreviewRecoveryController } from "../../media-library/hooks/useMediaPreviewRecoveryController";
import { useMediaPreviewSigningController } from "../../media-library/hooks/useMediaPreviewSigningController";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaTabDataController } from "../../media-library/hooks/useMediaTabDataController";
import { MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED } from "../../media-library/logic/mediaLibraryFeatureFlags";
import { resolveSignedSelectionUrl } from "../../media-library/logic/mediaPreviewResolver";
import {
  hydrateMediaPreviewViaStorageDownload,
  resolveAndApplySignedPreviewUrlsByRows,
  signMediaStoragePath,
} from "../../media-library/logic/mediaPreviewRuntimeShared";

type MediaLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    filename?: string | null;
    promptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    fullUrl?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
};

export function MediaLibraryModal({
  isOpen,
  onClose,
  onSelectMedia,
  onSelectPrompt,
}: MediaLibraryModalProps) {
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
  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const signAttemptRef = useRef<Record<string, number>>({});
  const downloadFallbackInFlightRef = useRef<Record<string, boolean>>({});
  const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
  const firstCardShellLoggedRef = useRef(false);
  const firstMediaPaintLoggedRef = useRef(false);
  const openToFirstMediaTimerRef = useRef<ReturnType<typeof createMediaPerfTimer> | null>(null);
  const openToFirstMediaLoggedRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<MediaTab>(activeTab);
  const activeMediaQueryRef = useRef("");
  const isOpenRef = useRef(isOpen);
  const mediaTabRequestRef = useRef<MediaTabRequestState>(createMediaTabRequestState());
  const mediaSignInFlightRef = useRef<MediaTabBooleanState>(createMediaTabBooleanState());
  const mediaCardNodesRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const mediaCardRefCallbacksRef = useRef<Record<string, MediaCardRefCallback>>({});
  const mediaCardObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleMediaIdsRef = useRef<Set<string>>(new Set());
  const [visibleMediaVersion, setVisibleMediaVersion] = useState(0);
  const [signPassNonce, setSignPassNonce] = useState(0);
  const [signBudget, setSignBudget] = useState<MediaSignBudget>(resolveModalSignBudget);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
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
    source: "client.ai_studio.media_library_modal_error",
    scope: "app",
    severity: "medium",
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
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    activeMediaQueryRef.current = activeMediaQuery;
  }, [activeMediaQuery]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    const refreshBudget = () => {
      setSignBudget((prev) => {
        const next = resolveModalSignBudget();
        if (
          prev.initialSignLimit === next.initialSignLimit &&
          prev.prefetchWindow === next.prefetchWindow &&
          prev.signBatchSize === next.signBatchSize
        ) {
          return prev;
        }
        return next;
      });
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    connection?.addEventListener?.("change", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
      connection?.removeEventListener?.("change", refreshBudget);
    };
  }, []);

  useEffect(() => {
    signAttemptRef.current = {};
    setOptimizerFallbackMediaIds(new Set());
  }, [activeTab, activeMediaQuery]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(
    () => () => {
      for (const objectUrl of Object.values(objectUrlByMediaIdRef.current)) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrlByMediaIdRef.current = {};
      isMountedRef.current = false;
    },
    []
  );

  const getMediaCardRef = useCallback((fileId: string): MediaCardRefCallback => {
    const existing = mediaCardRefCallbacksRef.current[fileId];
    if (existing) return existing;
    const callback: MediaCardRefCallback = (node) => {
      const previousNode = mediaCardNodesRef.current.get(fileId);
      if (previousNode && previousNode !== node) {
        mediaCardObserverRef.current?.unobserve(previousNode);
      }
      if (!node) {
        mediaCardNodesRef.current.delete(fileId);
        if (visibleMediaIdsRef.current.delete(fileId)) {
          setVisibleMediaVersion((prev) => prev + 1);
        }
        return;
      }
      node.dataset.mediaId = fileId;
      mediaCardNodesRef.current.set(fileId, node);
      mediaCardObserverRef.current?.observe(node);
    };
    mediaCardRefCallbacksRef.current[fileId] = callback;
    return callback;
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }
    const visibleIds = visibleMediaIdsRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const fileId = (entry.target as HTMLElement).dataset.mediaId;
          if (!fileId) continue;
          if (entry.isIntersecting) {
            if (!visibleIds.has(fileId)) {
              visibleIds.add(fileId);
              changed = true;
            }
            continue;
          }
          if (visibleIds.delete(fileId)) {
            changed = true;
          }
        }
        if (changed) {
          setVisibleMediaVersion((prev) => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: "460px 0px",
        threshold: 0.01,
      }
    );
    mediaCardObserverRef.current = observer;
    for (const node of mediaCardNodesRef.current.values()) {
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
      mediaCardObserverRef.current = null;
      visibleIds.clear();
    };
  }, []);

  const signStoragePath = useCallback(
    (storagePath: string, options?: { forceRefresh?: boolean }): Promise<string | null> =>
      signMediaStoragePath(storagePath, options),
    []
  );

  const applySignedUrlsToTab = useCallback((tab: MediaDataTab, signedById: Map<string, string>) => {
    if (!signedById.size) return;
    setMediaTabCache((prev) => {
      const cache = prev[tab];
      let changed = false;
      const nextRows = cache.rows.map((row) => {
        const signedUrl = signedById.get(row.id);
        if (!signedUrl || row.signedUrl === signedUrl) return row;
        changed = true;
        return { ...row, signedUrl };
      });
      if (!changed) return prev;
      return {
        ...prev,
        [tab]: {
          ...cache,
          rows: nextRows,
        },
      };
    });
    if (isOpenRef.current && activeTabRef.current === tab) {
      setFiles((prev) =>
        prev.map((file) => {
          const signedUrl = signedById.get(file.id);
          return signedUrl ? { ...file, signedUrl } : file;
        })
      );
    }
  }, []);

  const setObjectUrlForMediaRow = useCallback(
    (file: MediaFileRow, objectUrl: string) => {
      const previousObjectUrl = objectUrlByMediaIdRef.current[file.id];
      if (previousObjectUrl && previousObjectUrl !== objectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }
      objectUrlByMediaIdRef.current[file.id] = objectUrl;
      applySignedUrlsToTab(getMediaDataTabForRow(file), new Map([[file.id, objectUrl]]));
    },
    [applySignedUrlsToTab]
  );

  const hydrateViaStorageDownload = useCallback(
    async (file: MediaFileRow): Promise<string | null> => {
      if (downloadFallbackInFlightRef.current[file.id]) return null;
      downloadFallbackInFlightRef.current[file.id] = true;
      try {
        const supabase = ensureSupabaseClient();
        return await hydrateMediaPreviewViaStorageDownload({
          row: file,
          currentUserId: currentUserIdRef.current,
          downloadFromStoragePath: async (storagePath) => {
            const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
            if (error || !data) return null;
            return data as Blob;
          },
          applyObjectUrlForRow: setObjectUrlForMediaRow,
        });
      } catch {
        return null;
      } finally {
        downloadFallbackInFlightRef.current[file.id] = false;
      }
    },
    [setObjectUrlForMediaRow]
  );

  const resolveSignedUrlsByMediaIds = useCallback(
    (tab: MediaDataTab, rows: MediaFileRow[]): Promise<Set<string>> =>
      resolveAndApplySignedPreviewUrlsByRows({
        tab,
        rows,
        applySignedUrlsToTab,
      }),
    [applySignedUrlsToTab]
  );

  const { refreshSignedUrl, handleMediaPreviewError } =
    useMediaPreviewRecoveryController<MediaFileRow>({
      applySignedUrlsToTab,
      currentUserIdRef,
      resolveSignedUrlsByMediaIds,
      hydrateViaStorageDownload,
      signStoragePath,
      signedUrlRetryRef,
      objectUrlByMediaIdRef,
      resolveTabForRow: getMediaDataTabForRow,
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

  const markFirstMediaPaint = useCallback(
    (assetKind: "image" | "video") => {
      if (firstMediaPaintLoggedRef.current) return;
      firstMediaPaintLoggedRef.current = true;
      logMediaPerf("media.modal.first_media_paint", {
        surface: "media-library-modal",
        tab: activeTab,
        asset_kind: assetKind,
      });
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
    [activeMediaQuery, activeTab]
  );

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
      setSelectedIds(new Set());
      setSearch("");
      setDebouncedSearch("");
      firstCardShellLoggedRef.current = false;
      firstMediaPaintLoggedRef.current = false;
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

  const mediaSearchTerm = useMemo(() => activeMediaQuery.toLowerCase(), [activeMediaQuery]);
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
    if (!activeMediaTab) return [];
    const base = files.filter((item) => getMediaDataTabForRow(item) === activeMediaTab);
    if (!mediaSearchTerm) return base;
    return base.filter((file) => {
      const name = file.filename?.toLowerCase() ?? "";
      const path = file.storage_path?.toLowerCase() ?? "";
      return name.includes(mediaSearchTerm) || path.includes(mediaSearchTerm);
    });
  }, [activeMediaTab, files, mediaSearchTerm]);

  useMediaPreviewSigningController({
    activeMediaTab,
    activeMediaCacheLoading: Boolean(activeMediaCache?.loading),
    activeMediaCachePagesLoaded: activeMediaCache?.pagesLoaded ?? 0,
    activeMediaQueryRef,
    activeTabRef,
    applySignedUrlsToTab,
    currentUserIdRef,
    filteredMedia: activeMedia,
    hydrateViaStorageDownload,
    isMountedRef,
    mediaSignInFlightRef,
    resolveSignedUrlsByMediaIds,
    setSignPassNonce,
    signAttemptRef,
    signBudget,
    signPassNonce,
    visibleMediaIdsRef,
    visibleMediaVersion,
    isSigningPassEnabled: isOpen,
    surface: "media-library-modal",
    unresolvedWarningPrefix: "[media-library-modal]",
    maxSignAttemptsPerItem: MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
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
      const fullStoragePath = file.storage_path;
      const previewUrl = file.signedUrl ?? nextUrl;
      const fullUrl = nextUrl;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(file.id);
        return next;
      });
      onSelectMedia({
        id: file.id,
        url: nextUrl,
        fileType: isVideoFile(file.file_type) ? "video" : "image",
        filename: file.filename,
        promptText: resolveMediaMetadataPromptText(file.metadata),
        source: file.source ?? "upload",
        previewStoragePath,
        fullStoragePath,
        previewUrl,
        fullUrl,
      });
    },
    [onSelectMedia, refreshSignedUrl, signStoragePath]
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
    <div className="media-library-modal-backdrop" onClick={onClose}>
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
          onTabChange={setActiveTab}
          onSearchChange={setSearch}
        />

        <div className="media-library-modal-body" ref={modalBodyRef}>
          {showBlockingLoading ? <p className="tiny subdued">Loading media library…</p> : null}
          {showBackgroundRefreshing ? <p className="tiny subdued">Refreshing media…</p> : null}
          {error ? <p className="tiny subdued">{error}</p> : null}

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
  );
}
