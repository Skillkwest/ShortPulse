/**
 * Media Library page for per-user uploads/downloads/deletes/moves in the private Supabase bucket.
 * Handles filtering, signed URL fetches, tab-aware caching, and modal actions while delegating storage and auth to shared helpers.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResolvedAccountPlan } from "../features/billing/useResolvedAccountPlan";
import {
  formatStorageBytes,
  formatStorageUsageValue,
  getDefaultPlanStorageLimitBytes,
} from "../features/billing/storage";
import { useMediaStorageQuotaSummary } from "../features/billing/useMediaStorageQuotaSummary";
import { isAdaptiveSurfaceEnabled } from "../lib/adaptive-media";
import { createMediaPerfTimer, logMediaPerf } from "../lib/mediaPerfTelemetry";
import { ensureSupabaseQueryClient } from "../lib/supabaseClient";
import {
  isMoveDestinationDataTab,
  type MediaTab,
} from "../features/media-library/logic/mediaMoveRouting";
import { useMediaBulkMoveController } from "../features/media-library/hooks/useMediaBulkMoveController";
import { useMediaBulkDeleteController } from "../features/media-library/hooks/useMediaBulkDeleteController";
import { MediaLibraryModalStack } from "../features/media-library/components/MediaLibraryModalStack";
import { MediaLibraryWorkspaceContent } from "../features/media-library/components/MediaLibraryWorkspaceContent";
import {
  collectMediaStoragePathsForDelete,
  logMediaEvent,
  removeStoragePaths,
} from "../features/media-library/logic/mediaLibraryDataEffects";
import { useMediaFileModalCrud } from "../features/media-library/hooks/useMediaFileModalCrud";
import { useMediaModalImageZoom } from "../features/media-library/hooks/useMediaModalImageZoom";
import { useMediaPromptModalCrud } from "../features/media-library/hooks/useMediaPromptModalCrud";
import { useMediaSurfacePreviewSigning } from "../features/media-library/hooks/useMediaSurfacePreviewSigning";
import { useMediaSurfacePreviewRuntime } from "../features/media-library/hooks/useMediaSurfacePreviewRuntime";
import { useMediaSingleMoveController } from "../features/media-library/hooks/useMediaSingleMoveController";
import { useMediaAdaptivePressure } from "../features/media-library/hooks/useMediaAdaptivePressure";
import { useMediaTabDataController } from "../features/media-library/hooks/useMediaTabDataController";
import { useMediaUploadController } from "../features/media-library/hooks/useMediaUploadController";
import { MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED } from "../features/media-library/logic/mediaLibraryFeatureFlags";
import {
  getMediaLibrarySurfaceConfig,
  useMediaLibraryRouteRuntime,
} from "../features/media-library/runtime";
import {
  BUCKET,
  formatDate,
  getErrorMessage,
  isMediaDataTab,
  isVideoFile,
  normalizeMediaSearchTerm,
  sortByCreatedAtDesc,
} from "../features/media-library/logic/mediaLibraryPageHelpers";
import { resolveVisibleMediaRows } from "../features/media-library/logic/resolveVisibleMediaRows";

type MediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: "image" | "video" | string;
  file_size: number | null;
  source?: "upload" | "ai_studio" | string | null;
  source_ref?: string | null;
  prompt_id?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  updated_at?: string;
  created_at: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: "text" | "image" | "video" | string;
  source: "manual" | "ai_studio" | "agent" | string;
  created_at: string;
  updated_at: string;
};

const MEDIA_LIBRARY_PAGE_SIZE = 60;
const MEDIA_LIBRARY_CACHE_TTL_MS = 30_000;
const ROUTE_SURFACE_CONFIG = getMediaLibrarySurfaceConfig("route");

export default function MediaLibrary() {
  const router = useRouter();
  const { resolvedPlan } = useResolvedAccountPlan();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>("uploaded_images");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
  const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
  const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [focusedFile, setFocusedFile] = useState<MediaRow | null>(null);
  const activeMediaTab = isMediaDataTab(activeTab) ? activeTab : null;
  const {
    activeMediaCache,
    aspectMap,
    cachedMediaBytes,
    files,
    mediaTabCache,
    prompts,
    promptsLoaded,
    setAspectRatio,
    setSignedUrls,
    setFiles,
    setMediaTabCache,
    setPrompts,
    setPromptsLoaded,
  } = useMediaLibraryRouteRuntime<MediaRow, PromptRow>({ activeMediaTab });
  const {
    closePromptModal,
    deletePrompt,
    focusedPrompt,
    handlePromptEditChange,
    openPromptModal,
    promptEditValue,
    promptModalError,
    promptSaveSuccess,
    savePromptEdits,
    savingPromptEdit,
  } = useMediaPromptModalCrud<PromptRow>({
    getErrorMessage,
    logMediaEvent,
    setPageError: setError,
    setPrompts,
    setSelectedIds,
  });
  const firstCardShellLoggedRef = useRef(false);
  const openToFirstMediaTimerRef = useRef<ReturnType<typeof createMediaPerfTimer> | null>(null);
  const openToFirstMediaLoggedRef = useRef(false);
  const { quotaSummary, refreshQuotaSummary } = useMediaStorageQuotaSummary({
    fallbackPlanId: resolvedPlan?.id,
  });
  const refreshStorageUsageBytes = refreshQuotaSummary;
  const totalBytes = quotaSummary?.usedBytes ?? cachedMediaBytes;
  const planLimitBytes =
    quotaSummary?.totalLimitBytes ?? getDefaultPlanStorageLimitBytes(resolvedPlan?.id);
  const planUsage = { label: "Current plan", name: resolvedPlan?.label ?? "Free" };
  const storageUsageValue = useMemo(() => {
    return formatStorageUsageValue(totalBytes, planLimitBytes);
  }, [planLimitBytes, totalBytes]);
  const adaptivePreviewQualityEnabled = isAdaptiveSurfaceEnabled("media-library-grid");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-route",
    enabled: adaptivePreviewQualityEnabled,
  });
  const activeMediaQuery = useMemo(
    () => normalizeMediaSearchTerm(debouncedSearch),
    [debouncedSearch]
  );
  const previewRuntime = useMediaSurfacePreviewRuntime<MediaRow, MediaTab>({
    activeMediaQuery,
    activeTab,
    applySignedUrlsToSurface: (_tab, signedById) => setSignedUrls(signedById),
    firstMediaPaintEventName: "media.route.first_media_paint",
    previewProfile: ROUTE_SURFACE_CONFIG.imageCardPreviewProfile,
    shouldApplySignedUrlsToActiveRows: (tab) => activeTab === tab,
    signBudgetResolver: ROUTE_SURFACE_CONFIG.signBudgetResolver,
    surface: ROUTE_SURFACE_CONFIG.listSurface,
    visibilityRootMargin: ROUTE_SURFACE_CONFIG.visibilityRootMargin,
    setFiles,
    setFocusedFile,
    setMediaTabCache,
  });
  const {
    activeTabRef,
    currentUserIdRef,
    getMediaCardRef,
    handleMediaPreviewError,
    markFirstMediaPaint,
    mediaTabRequestRef,
    signStoragePath,
    signedUrlRetryRef,
  } = previewRuntime;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if ((!focusedFile && !focusedPrompt) || typeof document === "undefined") return;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      html.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [focusedFile, focusedPrompt]);

  useEffect(() => {
    document.body.classList.add("media-library-body");
    document.documentElement.classList.add("media-library-body");
    return () => {
      document.body.classList.remove("media-library-body");
      document.documentElement.classList.remove("media-library-body");
    };
  }, []);
  useEffect(() => {
    setSelectedIds([]);
    setBulkMoveError(null);
    setBulkMoveNotice(null);
    setBulkMoveMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    void refreshQuotaSummary();
  }, [cachedMediaBytes, refreshQuotaSummary]);

  useEffect(() => {
    if (!isMediaDataTab(activeTab)) {
      openToFirstMediaTimerRef.current = null;
      openToFirstMediaLoggedRef.current = false;
      return;
    }
    openToFirstMediaTimerRef.current = createMediaPerfTimer({
      surface: "media-library-route",
      tab: activeTab,
      query_mode: activeMediaQuery ? "search" : "default",
    });
    openToFirstMediaLoggedRef.current = false;
  }, [activeMediaQuery, activeTab]);

  useEffect(() => {
    if (selectedIds.length) return;
    setBulkMoveMenuOpen(false);
    setBulkMoveError(null);
    setBulkMoveNotice(null);
  }, [selectedIds.length]);

  const { fetchMediaTabPage, markInactiveMediaCachesStale, updateVisibleRows } =
    useMediaTabDataController<MediaRow, PromptRow>({
      activeMediaCache,
      activeMediaQuery,
      activeMediaTab,
      activeTab,
      activeTabRef,
      cacheTtlMs: MEDIA_LIBRARY_CACHE_TTL_MS,
      surface: "media-library-route",
      currentUserIdRef,
      loadMoreSentinelRef,
      mediaTabCache,
      mediaTabRequestRef,
      pageSize: MEDIA_LIBRARY_PAGE_SIZE,
      promptsLoaded,
      setError,
      setFiles,
      setLoading,
      setMediaTabCache,
      setPrompts,
      setPromptsLoaded,
    });

  const {
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileChange,
    isDragging,
    selectedFiles,
    uploadCount,
    uploading,
  } = useMediaUploadController<MediaRow>({
    activeMediaTab,
    activeTab,
    currentUserIdRef,
    getErrorMessage,
    logMediaEvent,
    markInactiveMediaCachesStale,
    refreshStorageUsageBytes,
    setError,
    signStoragePath,
    updateVisibleRows,
  });

  const promptSearchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const loadingMoreMedia = Boolean(activeMediaCache?.loaded && activeMediaCache?.loading);
  const hasMoreMediaPages = Boolean(activeMediaCache?.hasMore);
  const filteredMedia = useMemo(() => {
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
      prefetchWindow: Math.min(previewRuntime.signBudget.prefetchWindow, 12),
      signBatchSize: Math.min(previewRuntime.signBudget.signBatchSize, 5),
    };
  }, [activeMediaTab, previewRuntime.signBudget]);

  useMediaSurfacePreviewSigning<MediaRow, MediaTab>({
    runtime: previewRuntime,
    activeMediaTab,
    activeMediaCacheLoading: Boolean(activeMediaCache?.loading),
    activeMediaCachePagesLoaded: activeMediaCache?.pagesLoaded ?? 0,
    activeMediaQuery,
    filteredMedia,
    signBudgetOverride: effectiveSignBudget,
    isSignPrefetchEnabled: MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
    maxSignCandidatesPerRow: activeMediaTab === "private" ? 2 : 4,
  });

  const filteredPrompts = useMemo(() => {
    if (activeTab !== "saved_prompts") return [];
    const promptRows = !promptSearchTerm
      ? prompts
      : prompts.filter((p) => {
          const title = p.title?.toLowerCase() ?? "";
          const text = p.prompt_text?.toLowerCase() ?? "";
          return title.includes(promptSearchTerm) || text.includes(promptSearchTerm);
        });
    return sortByCreatedAtDesc(promptRows);
  }, [activeTab, promptSearchTerm, prompts]);

  const isPromptTab = activeTab === "saved_prompts";
  const visibleCount = isPromptTab ? filteredPrompts.length : filteredMedia.length;
  const countLabel = isPromptTab ? "prompts" : "files";
  useEffect(() => {
    if (loading || firstCardShellLoggedRef.current) return;
    if (visibleCount <= 0) return;
    firstCardShellLoggedRef.current = true;
    logMediaPerf("media.route.first_card_shell", {
      surface: "media-library-route",
      tab: activeTab,
      visible_item_count: visibleCount,
    });
  }, [activeTab, loading, visibleCount]);

  const selectableMediaIds = useMemo(
    () => filteredMedia.filter((item) => item.status !== "uploading").map((item) => item.id),
    [filteredMedia]
  );
  const selectablePromptIds = useMemo(
    () => filteredPrompts.map((item) => item.id),
    [filteredPrompts]
  );
  const selectableIds = isPromptTab ? selectablePromptIds : selectableMediaIds;
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const deleteButtonLabel = allVisibleSelected ? "Delete all" : "Delete selected";
  const deleteItemLabel = isPromptTab
    ? selectedIds.length === 1
      ? "prompt"
      : "prompts"
    : selectedIds.length === 1
      ? "file"
      : "files";

  useEffect(() => {
    if (!selectedIds.length) return;
    const selectableIdSet = new Set(selectableIds);
    setSelectedIds((prev) => {
      const next = prev.filter((id) => selectableIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [selectableIds, selectedIds.length]);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const downloadFile = async (row: MediaRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseQueryClient();
      const { data, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(row.storage_path);
      if (downloadError) throw downloadError;
      const blob = data as Blob;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = row.filename || "media-file";
      link.click();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to download media"));
    }
  };

  const cacheAspectRatio = useCallback(
    (id: string, ratio: number) => {
      setAspectRatio(id, ratio);
    },
    [setAspectRatio]
  );

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    signedUrlRetryRef.current[id] = 0;
    cacheAspectRatio(id, img.naturalWidth / img.naturalHeight);
    markFirstMediaPaint("image");
    if (!openToFirstMediaLoggedRef.current) {
      openToFirstMediaLoggedRef.current = true;
      openToFirstMediaTimerRef.current?.("media.route.open_to_first_media", {
        surface: "media-library-route",
        tab: activeTab,
        asset_kind: "image",
        query_mode: activeMediaQuery ? "search" : "default",
      });
    }
  };

  const handleVideoMeta = (id: string, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = event.currentTarget;
    if (!vid.videoWidth || !vid.videoHeight) return;
    signedUrlRetryRef.current[id] = 0;
    cacheAspectRatio(id, vid.videoWidth / vid.videoHeight);
    markFirstMediaPaint("video");
    if (!openToFirstMediaLoggedRef.current) {
      openToFirstMediaLoggedRef.current = true;
      openToFirstMediaTimerRef.current?.("media.route.open_to_first_media", {
        surface: "media-library-route",
        tab: activeTab,
        asset_kind: "video",
        query_mode: activeMediaQuery ? "search" : "default",
      });
    }
  };

  const toggleSelect = (file: MediaRow) => {
    if (file.status === "uploading") return;
    setBulkMoveError(null);
    setBulkMoveNotice(null);
    setSelectedIds((prev) =>
      prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]
    );
  };

  const togglePromptSelect = (promptId: string) => {
    setBulkMoveError(null);
    setBulkMoveNotice(null);
    setSelectedIds((prev) =>
      prev.includes(promptId) ? prev.filter((id) => id !== promptId) : [...prev, promptId]
    );
  };

  const selectAllVisible = () => {
    setBulkMoveError(null);
    setBulkMoveNotice(null);
    setSelectedIds(isPromptTab ? selectablePromptIds : selectableMediaIds);
  };

  const {
    cancelDeleteFile,
    closeModal: closeFileModal,
    confirmDeleteFile,
    deleteTarget,
    handleRenameInputChange,
    modalError,
    openModal: openFileModal,
    renameSuccess,
    renameValue,
    requestDeleteFile,
    saveRename,
    savingRename,
    setModalError,
  } = useMediaFileModalCrud<MediaRow>({
    activeMediaTab,
    collectMediaStoragePathsForDelete,
    focusedFile,
    getErrorMessage,
    logMediaEvent,
    markInactiveMediaCachesStale,
    refreshStorageUsageBytes,
    removeStoragePaths,
    setPageError: setError,
    setFocusedFile,
    setSelectedIds,
    updateVisibleRows,
  });

  const focusedAspectRatio = useMemo(() => {
    if (!focusedFile) return 4 / 5;
    const ratio = aspectMap[focusedFile.id];
    if (Number.isFinite(ratio) && ratio > 0) return ratio;
    return isVideoFile(focusedFile.file_type) ? 9 / 16 : 4 / 5;
  }, [aspectMap, focusedFile]);
  const isFocusedImage = Boolean(focusedFile && !isVideoFile(focusedFile.file_type));
  const {
    cacheModalImageNaturalSize,
    handleModalImageClick,
    handleModalImageKeyDown,
    handleModalImagePointerDown,
    handleModalImagePointerMove,
    handleModalImagePointerUp,
    handleModalImageWheel,
    handleModalPreviewWheel,
    isModalImagePanning,
    modalImagePan,
    modalImageZoomActive,
    modalImageZoomScale,
    modalPreviewRef,
    resetModalImageZoom,
  } = useMediaModalImageZoom({ isFocusedImage });

  const {
    bulkDeleting,
    cancelDeleteSelected,
    confirmDeleteIds,
    confirmDeleteSelected,
    requestDeleteSelected,
  } = useMediaBulkDeleteController<MediaRow, PromptRow>({
    activeTabKey: activeTab,
    activeMediaTab,
    collectMediaStoragePathsForDelete,
    currentUserIdRef,
    files,
    getErrorMessage,
    isPromptTab,
    logMediaEvent,
    markInactiveMediaCachesStale,
    refreshStorageUsageBytes,
    removeStoragePaths,
    selectedIds,
    setPageError: setError,
    setPrompts,
    setSelectedIds,
    updateVisibleRows,
  });

  const {
    applyMovedFilesToCaches,
    canMoveToAnotherTab,
    clearMoveState,
    modalMoveTabOptions,
    moveError,
    moveFocusedFile,
    moveMenuOpen,
    movingFile,
    setMoveMenuOpen,
  } = useMediaSingleMoveController<MediaRow>({
    activeTabRef,
    currentUserIdRef,
    focusedFile,
    getErrorMessage,
    setActiveTab,
    setFiles,
    setFocusedFile,
    setMediaTabCache,
    setModalError,
    setPageError: setError,
    setSelectedIds,
    signStoragePath,
  });

  const { bulkMoveTabOptions, canBulkMove, moveSelectedFiles, selectedMediaRows } =
    useMediaBulkMoveController({
      activeMediaTab,
      activeTabRef,
      applyMovedFilesToCaches,
      bulkDeleting,
      bulkMoving,
      currentUserIdRef,
      files,
      getErrorMessage,
      selectedIds,
      setActiveTab,
      setBulkMoveError,
      setBulkMoveMenuOpen,
      setBulkMoveNotice,
      setBulkMoving,
      setError,
      setFiles,
      setFocusedFile,
      setSelectedIds,
    });

  const openModal = useCallback(
    (file: MediaRow) => {
      openFileModal(file);
      clearMoveState();
      resetModalImageZoom();
      void signStoragePath(file.storage_path, { forceRefresh: false }).then((fullQualityUrl) => {
        if (!fullQualityUrl) return;
        setFocusedFile((prev) =>
          prev && prev.id === file.id ? ({ ...prev, signedUrl: fullQualityUrl } as MediaRow) : prev
        );
      });
    },
    [clearMoveState, openFileModal, resetModalImageZoom, setFocusedFile, signStoragePath]
  );

  const closeModal = useCallback(() => {
    closeFileModal();
    clearMoveState();
    resetModalImageZoom();
  }, [clearMoveState, closeFileModal, resetModalImageZoom]);

  useEffect(() => {
    const hasOpenModal = Boolean(
      deleteTarget || confirmDeleteIds?.length || focusedFile || focusedPrompt
    );
    if (!hasOpenModal || typeof window === "undefined") return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      if (deleteTarget) {
        event.preventDefault();
        cancelDeleteFile();
        return;
      }
      if (confirmDeleteIds?.length) {
        event.preventDefault();
        cancelDeleteSelected();
        return;
      }
      if (focusedPrompt) {
        event.preventDefault();
        closePromptModal();
        return;
      }
      if (focusedFile) {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    cancelDeleteFile,
    cancelDeleteSelected,
    closeModal,
    closePromptModal,
    confirmDeleteIds,
    deleteTarget,
    focusedFile,
    focusedPrompt,
  ]);

  return (
    <>
      <Head>
        <title>ShortPulse · Media Library</title>
        <meta name="description" content="Secure per-user media library." />
      </Head>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" className="page page-wide">
        <MediaLibraryWorkspaceContent
          filtersRowProps={{
            activeTab,
            countLabel,
            search,
            visibleCount,
            onSearchChange: (value) => setSearch(value),
            onSelectTab: (tab) => setActiveTab(tab),
          }}
          gallerySectionProps={{
            activeMediaQuery,
            activeMediaTab,
            activeTab,
            adaptivePressureLevel: mediaAdaptivePressure.previewPressureLevel,
            adaptivePreviewQualityEnabled,
            allVisibleSelected,
            aspectMap,
            bulkDeleting,
            bulkMoveError,
            bulkMoveMenuOpen,
            bulkMoveNotice,
            bulkMoveTabOptions,
            bulkMoving,
            canBulkMove,
            deleteButtonLabel,
            deleteItemLabel,
            files: filteredMedia,
            formatDate,
            getMediaCardRef,
            handleImageLoad,
            handleMediaPreviewError,
            handleVideoMeta,
            hasMoreMediaPages,
            isPromptTab,
            isVideoFile,
            loadMoreSentinelRef,
            loading,
            loadingMoreMedia,
            onClearSelection: () => {
              setSelectedIds([]);
              setBulkMoveError(null);
              setBulkMoveNotice(null);
            },
            onDeletePrompt: deletePrompt,
            onDownloadFile: downloadFile,
            onFetchMediaTabPage: fetchMediaTabPage,
            onMoveSelected: (destinationTab) => {
              if (!isMoveDestinationDataTab(destinationTab)) return;
              void moveSelectedFiles(destinationTab);
            },
            onOpenFileModal: openModal,
            onOpenPromptModal: openPromptModal,
            onRequestDeleteFile: requestDeleteFile,
            onRequestDeleteSelected: requestDeleteSelected,
            onSelectAllVisible: selectAllVisible,
            onToggleBulkMoveMenu: () => {
              setBulkMoveError(null);
              setBulkMoveMenuOpen((prev) => !prev);
            },
            onToggleFileSelect: toggleSelect,
            onTogglePromptSelect: togglePromptSelect,
            prompts: filteredPrompts,
            selectedIds,
            selectedMediaRowsCount: selectedMediaRows.length,
            selectableIdsCount: selectableIds.length,
          }}
          headerProps={{
            planLabel: planUsage.label,
            planName: planUsage.name,
            storageUsageValue,
            storageCapacityValue: formatStorageBytes(planLimitBytes),
          }}
          uploadStageProps={{
            activeTab,
            error,
            fileInputRef,
            isDragging,
            planLimitBytes,
            selectedFiles,
            totalBytes,
            uploadCount,
            uploading,
            onDragLeave: handleDragLeave,
            onDragOver: handleDragOver,
            onDrop: handleDrop,
            onFileChange: handleFileChange,
            onTriggerFilePicker: triggerFilePicker,
            onOpenBilling: () => {
              void router.push("/profile?section=storage");
            },
          }}
        />
      </main>

      <MediaLibraryModalStack
        confirmDeleteIds={confirmDeleteIds}
        deleteTarget={deleteTarget}
        fileModal={{
          canMoveToAnotherTab,
          cacheModalImageNaturalSize,
          cacheAspectRatio,
          closeModal,
          downloadFile,
          focusedAspectRatio,
          focusedFile,
          handleMediaPreviewError,
          handleModalImageClick,
          handleModalImageKeyDown,
          handleModalImagePointerDown,
          handleModalImagePointerMove,
          handleModalImagePointerUp,
          handleModalImageWheel,
          handleModalPreviewWheel,
          handleRenameInputChange,
          isModalImagePanning,
          isVideoFile,
          modalError,
          modalImagePan,
          modalImageZoomActive,
          modalImageZoomScale,
          modalMoveTabOptions,
          modalPreviewRef,
          moveError,
          moveFocusedFile,
          moveMenuOpen,
          movingFile,
          renameSuccess,
          renameValue,
          requestDeleteFile,
          saveRename,
          savingRename,
          setMoveMenuOpen,
        }}
        onCancelDeleteFile={cancelDeleteFile}
        onCancelDeleteSelected={cancelDeleteSelected}
        onConfirmDeleteFile={confirmDeleteFile}
        onConfirmDeleteSelected={confirmDeleteSelected}
        promptModal={{
          closePromptModal,
          deletePrompt,
          focusedPrompt,
          handlePromptEditChange,
          promptEditValue,
          promptModalError,
          promptSaveSuccess,
          savePromptEdits,
          savingPromptEdit,
        }}
      />
    </>
  );
}
