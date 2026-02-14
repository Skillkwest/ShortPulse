/**
 * Media Library page for per-user uploads/downloads/deletes/moves in the private Supabase bucket.
 * Handles filtering, signed URL fetches, tab-aware caching, and modal actions while delegating storage and auth to shared helpers.
 */
import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logMediaPerf } from "../lib/mediaPerfTelemetry";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../lib/mediaPreviewPath";
import { getSignedMediaUrl } from "../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../lib/supabaseClient";
import { isMoveDestinationDataTab } from "../features/media-library/logic/mediaMoveRouting";
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
import { useMediaPreviewSigningController } from "../features/media-library/hooks/useMediaPreviewSigningController";
import { useMediaSingleMoveController } from "../features/media-library/hooks/useMediaSingleMoveController";
import { useMediaTabDataController } from "../features/media-library/hooks/useMediaTabDataController";
import { useMediaUploadController } from "../features/media-library/hooks/useMediaUploadController";
import {
  BUCKET,
  MEDIA_DATA_TABS,
  createMediaTabBooleanState,
  createMediaTabCacheState,
  createMediaTabRequestState,
  formatDate,
  getErrorMessage,
  getMediaDataTabForRow,
  isMediaDataTab,
  isMissingRoutineError,
  isVideoFile,
  normalizeMediaSearchTerm,
  resolveRouteSignBudget,
  sortByCreatedAtDesc,
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
  type MediaTabCache as MediaTabCacheState,
  type MediaTabRequestState,
} from "../features/media-library/logic/mediaLibraryPageHelpers";

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

type MediaTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

type MediaTabCache = MediaTabCacheState<MediaRow>;
type MediaCardRefCallback = (node: HTMLDivElement | null) => void;

const MEDIA_LIBRARY_PAGE_SIZE = 60;
const MEDIA_LIBRARY_CACHE_TTL_MS = 30_000;

type NavigatorWithConnection = Navigator & {
  connection?: {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [mediaTabCache, setMediaTabCache] =
    useState<Record<MediaDataTab, MediaTabCache>>(createMediaTabCacheState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>("uploaded_images");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [aspectMap, setAspectMap] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
  const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
  const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [focusedFile, setFocusedFile] = useState<MediaRow | null>(null);
  const [storageUsageBytes, setStorageUsageBytes] = useState<number | null>(null);
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
  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const signAttemptRef = useRef<Record<string, number>>({});
  const downloadFallbackInFlightRef = useRef<Record<string, boolean>>({});
  const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
  const firstCardShellLoggedRef = useRef(false);
  const firstMediaPaintLoggedRef = useRef(false);
  const activeTabRef = useRef<MediaTab>(activeTab);
  const activeMediaQueryRef = useRef("");
  const mediaTabRequestRef = useRef<MediaTabRequestState>(createMediaTabRequestState());
  const mediaSignInFlightRef = useRef<MediaTabBooleanState>(createMediaTabBooleanState());
  const mediaCardNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const mediaCardRefCallbacksRef = useRef<Record<string, MediaCardRefCallback>>({});
  const mediaCardObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleMediaIdsRef = useRef<Set<string>>(new Set());
  const [visibleMediaVersion, setVisibleMediaVersion] = useState(0);
  const [signPassNonce, setSignPassNonce] = useState(0);
  const [signBudget, setSignBudget] = useState<MediaSignBudget>(resolveRouteSignBudget);
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const cachedMediaBytes = useMemo(() => {
    const byId = new Map<string, number>();
    for (const tab of MEDIA_DATA_TABS) {
      for (const file of mediaTabCache[tab].rows) {
        if (!byId.has(file.id)) {
          byId.set(file.id, file.file_size || 0);
        }
      }
    }
    return Array.from(byId.values()).reduce((sum, size) => sum + size, 0);
  }, [mediaTabCache]);
  const totalBytes = storageUsageBytes ?? cachedMediaBytes;
  const planLimitMb = 1024;
  const planUsage = { label: "Plan", name: "Creative Suite" };
  const storageUsageValue = useMemo(() => {
    const usedMb = totalBytes / (1024 * 1024);
    const limitGb = planLimitMb / 1024;
    return `${usedMb.toFixed(1)} MB / ${limitGb.toFixed(1)} GB`;
  }, [planLimitMb, totalBytes]);
  const activeMediaTab = isMediaDataTab(activeTab) ? activeTab : null;
  const activeMediaCache = activeMediaTab ? mediaTabCache[activeMediaTab] : null;
  const activeMediaQuery = useMemo(
    () => normalizeMediaSearchTerm(debouncedSearch),
    [debouncedSearch]
  );

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
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    const refreshBudget = () => {
      setSignBudget((prev) => {
        const next = resolveRouteSignBudget();
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
  }, [activeTab, activeMediaQuery]);

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

  const refreshStorageUsageBytes = useCallback(async () => {
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase.rpc("get_media_library_usage_bytes");
      if (error) {
        if (isMissingRoutineError(error)) return;
        throw error;
      }
      const parsed = typeof data === "number" ? data : Number.parseInt(String(data ?? "0"), 10);
      if (Number.isFinite(parsed)) {
        setStorageUsageBytes(Math.max(0, parsed));
      }
    } catch {
      // Fall back to cached-row estimate when RPC is unavailable.
    }
  }, []);

  useEffect(() => {
    document.body.classList.add("media-library-body");
    document.documentElement.classList.add("media-library-body");
    return () => {
      document.body.classList.remove("media-library-body");
      document.documentElement.classList.remove("media-library-body");
    };
  }, []);

  useEffect(() => {
    void refreshStorageUsageBytes();
  }, [refreshStorageUsageBytes]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkMoveError(null);
    setBulkMoveNotice(null);
    setBulkMoveMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (selectedIds.length) return;
    setBulkMoveMenuOpen(false);
    setBulkMoveError(null);
    setBulkMoveNotice(null);
  }, [selectedIds.length]);

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
        rootMargin: "520px 0px",
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
    async (storagePath: string, options?: { forceRefresh?: boolean }): Promise<string | null> =>
      getSignedMediaUrl({
        bucket: BUCKET,
        storagePath,
        expiresInSeconds: 3600,
        forceRefresh: options?.forceRefresh ?? false,
      }),
    []
  );

  const applySignedUrlsToTab = useCallback(
    (tab: MediaDataTab, signedById: Map<string, string>) => {
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
      if (activeTabRef.current === tab) {
        setFiles((prev) =>
          prev.map((file) => {
            const signedUrl = signedById.get(file.id);
            return signedUrl ? { ...file, signedUrl } : file;
          })
        );
      }
      setFocusedFile((prev) => {
        if (!prev) return prev;
        const signedUrl = signedById.get(prev.id);
        return signedUrl ? { ...prev, signedUrl } : prev;
      });
    },
    [setFocusedFile]
  );

  const setObjectUrlForMediaRow = useCallback(
    (file: MediaRow, objectUrl: string) => {
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
    async (file: MediaRow): Promise<string | null> => {
      if (downloadFallbackInFlightRef.current[file.id]) return null;
      downloadFallbackInFlightRef.current[file.id] = true;
      try {
        const supabase = ensureSupabaseClient();
        const storageCandidates = resolveMediaSigningStoragePaths(file, currentUserIdRef.current);
        for (const storagePath of storageCandidates) {
          const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
          if (error || !data) continue;
          const blob = data as Blob;
          if (!blob.size) continue;
          const objectUrl = URL.createObjectURL(blob);
          setObjectUrlForMediaRow(file, objectUrl);
          return objectUrl;
        }
        return null;
      } catch {
        return null;
      } finally {
        downloadFallbackInFlightRef.current[file.id] = false;
      }
    },
    [setObjectUrlForMediaRow]
  );

  const resolveSignedUrlsByMediaIds = useCallback(
    async (tab: MediaDataTab, rows: MediaRow[]): Promise<Set<string>> => {
      const ids = Array.from(new Set(rows.map((row) => row.id).filter(Boolean)));
      const unresolvedIds = new Set(ids);
      if (!ids.length) return unresolvedIds;
      try {
        const response = await fetchWithAuth("/api/media/resolve-previews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ids,
            expiresInSeconds: 3600,
          }),
          shortpulseLogScope: "app",
        }).catch(() => null);
        if (!response?.ok) return unresolvedIds;
        const payload = (await response.json().catch(() => null)) as {
          urls?: Record<string, string | null>;
        } | null;
        const urls = payload?.urls ?? {};
        const resolvedById = new Map<string, string>();
        for (const mediaId of ids) {
          const url = urls[mediaId];
          if (!url) continue;
          resolvedById.set(mediaId, url);
          unresolvedIds.delete(mediaId);
        }
        applySignedUrlsToTab(tab, resolvedById);
        return unresolvedIds;
      } catch {
        return unresolvedIds;
      }
    },
    [applySignedUrlsToTab]
  );

  const refreshSignedUrl = useCallback(
    async (file: MediaRow): Promise<string | null> => {
      const signingCandidates = resolveMediaSigningStoragePaths(file, currentUserIdRef.current);
      if (!signingCandidates.length) return null;
      try {
        for (const storagePath of signingCandidates) {
          const nextSignedUrl = await signStoragePath(storagePath, { forceRefresh: true });
          if (!nextSignedUrl) continue;
          const previousObjectUrl = objectUrlByMediaIdRef.current[file.id];
          if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            delete objectUrlByMediaIdRef.current[file.id];
          }
          applySignedUrlsToTab(getMediaDataTabForRow(file), new Map([[file.id, nextSignedUrl]]));
          return nextSignedUrl;
        }
        const directUrl = resolveMediaDirectPreviewUrls(file)[0] ?? null;
        if (directUrl) {
          const previousObjectUrl = objectUrlByMediaIdRef.current[file.id];
          if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            delete objectUrlByMediaIdRef.current[file.id];
          }
          applySignedUrlsToTab(getMediaDataTabForRow(file), new Map([[file.id, directUrl]]));
          return directUrl;
        }
        return null;
      } catch {
        return null;
      }
    },
    [applySignedUrlsToTab, signStoragePath]
  );

  const handleMediaPreviewError = useCallback(
    (file: MediaRow) => {
      const attempts = signedUrlRetryRef.current[file.id] ?? 0;
      if (attempts >= 3) return;
      signedUrlRetryRef.current[file.id] = attempts + 1;
      void refreshSignedUrl(file).then(async (nextUrl) => {
        const returnedSameUrl = Boolean(nextUrl && file.signedUrl && nextUrl === file.signedUrl);
        if (nextUrl && !returnedSameUrl) return;
        const stillUnresolved = await resolveSignedUrlsByMediaIds(getMediaDataTabForRow(file), [
          file,
        ]);
        if (!stillUnresolved.has(file.id)) return;
        void hydrateViaStorageDownload(file);
      });
    },
    [hydrateViaStorageDownload, refreshSignedUrl, resolveSignedUrlsByMediaIds]
  );

  const markFirstMediaPaint = useCallback(
    (assetKind: "image" | "video") => {
      if (firstMediaPaintLoggedRef.current) return;
      firstMediaPaintLoggedRef.current = true;
      logMediaPerf("media.route.first_media_paint", {
        surface: "media-library-route",
        tab: activeTab,
        asset_kind: assetKind,
      });
    },
    [activeTab]
  );

  const { fetchMediaTabPage, markInactiveMediaCachesStale, updateVisibleRows } =
    useMediaTabDataController<MediaRow, PromptRow>({
      activeMediaCache,
      activeMediaQuery,
      activeMediaTab,
      activeTab,
      activeTabRef,
      cacheTtlMs: MEDIA_LIBRARY_CACHE_TTL_MS,
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

  const mediaSearchTerm = useMemo(() => activeMediaQuery.toLowerCase(), [activeMediaQuery]);
  const promptSearchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const loadingMoreMedia = Boolean(activeMediaCache?.loaded && activeMediaCache?.loading);
  const hasMoreMediaPages = Boolean(activeMediaCache?.hasMore);
  const filteredMedia = useMemo(() => {
    if (!activeMediaTab) return [];
    const base = files.filter((file) => getMediaDataTabForRow(file) === activeMediaTab);
    if (!mediaSearchTerm) return base;
    return base.filter((f) => {
      const name = f.filename?.toLowerCase() ?? "";
      const path = f.storage_path?.toLowerCase() ?? "";
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
    filteredMedia,
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

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const downloadFile = async (row: MediaRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
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

  const cacheAspectRatio = useCallback((id: string, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setAspectMap((prev) => {
      if (prev[id] === ratio) return prev;
      return { ...prev, [id]: ratio };
    });
  }, []);

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    signedUrlRetryRef.current[id] = 0;
    cacheAspectRatio(id, img.naturalWidth / img.naturalHeight);
    markFirstMediaPaint("image");
  };

  const handleVideoMeta = (id: string, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = event.currentTarget;
    if (!vid.videoWidth || !vid.videoHeight) return;
    signedUrlRetryRef.current[id] = 0;
    cacheAspectRatio(id, vid.videoWidth / vid.videoHeight);
    markFirstMediaPaint("video");
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
    deletingSingle,
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
    },
    [clearMoveState, openFileModal, resetModalImageZoom]
  );

  const closeModal = useCallback(() => {
    closeFileModal();
    clearMoveState();
    resetModalImageZoom();
  }, [clearMoveState, closeFileModal, resetModalImageZoom]);

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
          }}
          uploadStageProps={{
            activeTab,
            error,
            fileInputRef,
            isDragging,
            planLimitMb,
            selectedFiles,
            totalBytes,
            uploadCount,
            uploading,
            onDragLeave: handleDragLeave,
            onDragOver: handleDragOver,
            onDrop: handleDrop,
            onFileChange: handleFileChange,
            onTriggerFilePicker: triggerFilePicker,
          }}
        />
      </main>

      <MediaLibraryModalStack
        bulkDeleting={bulkDeleting}
        confirmDeleteIds={confirmDeleteIds}
        deleteTarget={deleteTarget}
        deletingSingle={deletingSingle}
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
