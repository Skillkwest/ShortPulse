/**
 * Media Library page for per-user uploads/downloads/deletes/moves in the private Supabase bucket.
 * Handles filtering, signed URL fetches, tab-aware caching, and modal actions while delegating storage and auth to shared helpers.
 */
import Head from "next/head";
import {
  CaretDown,
  CheckCircle,
  CloudArrowUp,
  DownloadSimple,
  LockSimple,
  MagnifyingGlass,
  ShieldCheck,
  Trash,
} from "phosphor-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardNavPrefab } from "../components/DashboardNavPrefab";
import { logMediaPerf } from "../lib/mediaPerfTelemetry";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../lib/mediaPreviewPath";
import { getSignedMediaUrl, invalidateSignedMediaUrl } from "../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../lib/supabaseClient";
import {
  buildModalMoveTabOptions,
  isMoveDestinationDataTab,
} from "../features/media-library/logic/mediaMoveRouting";
import { useMediaBulkMoveController } from "../features/media-library/hooks/useMediaBulkMoveController";
import { useMediaFileModalCrud } from "../features/media-library/hooks/useMediaFileModalCrud";
import { useMediaModalImageZoom } from "../features/media-library/hooks/useMediaModalImageZoom";
import { useMediaPromptModalCrud } from "../features/media-library/hooks/useMediaPromptModalCrud";
import { useMediaPreviewSigningController } from "../features/media-library/hooks/useMediaPreviewSigningController";
import { useMediaTabDataController } from "../features/media-library/hooks/useMediaTabDataController";
import { useMediaUploadController } from "../features/media-library/hooks/useMediaUploadController";
import { applyMovedRowsToMediaTabCache } from "../features/media-library/logic/mediaMoveCache";
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
  isMissingRelationError,
  isMissingRoutineError,
  isNonEmptyString,
  isVideoFile,
  mergePageRows,
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

type MediaVariantPathRow = {
  storage_path: string | null;
};

type MediaDeleteTarget = Pick<
  MediaRow,
  | "id"
  | "storage_path"
  | "preview_storage_path"
  | "thumb_variant_path"
  | "poster_variant_path"
  | "preview_variant_path"
>;

type MediaDeleteLookupRow = Pick<
  MediaRow,
  | "id"
  | "storage_path"
  | "file_type"
  | "metadata"
  | "thumb_variant_path"
  | "poster_variant_path"
  | "preview_variant_path"
>;

type MoveMediaResponse = {
  file: MediaRow;
  fromTab: MediaDataTab;
  toTab: MediaDataTab;
};

type MoveFileResult = {
  nextFile: MediaRow;
  toTab: MediaDataTab;
  previousSignPaths: string[];
};

const MEDIA_LIBRARY_PAGE_SIZE = 60;
const MEDIA_LIBRARY_CACHE_TTL_MS = 30_000;
const STORAGE_DELETE_BATCH_SIZE = 100;

type NavigatorWithConnection = Navigator & {
  connection?: {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

const logMediaEvent = async (
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const supabase = ensureSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("media_events").insert({
      user_id: userId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
    if (error) {
      console.warn("Media event log failed", error);
    }
  } catch (err) {
    console.warn("Media event log error", err);
  }
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
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
  const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
  const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [focusedFile, setFocusedFile] = useState<MediaRow | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [movingFile, setMovingFile] = useState(false);
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
  const bulkDeleteInFlightRef = useRef(false);
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
    setConfirmDeleteIds(null);
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

  const collectMediaStoragePathsForDelete = useCallback(
    async (targets: MediaDeleteTarget[]): Promise<string[]> => {
      if (!targets.length) return [];
      const basePaths = targets.flatMap((target) => [
        target.storage_path,
        target.preview_storage_path,
        target.thumb_variant_path,
        target.poster_variant_path,
        target.preview_variant_path,
      ]);
      const dedupedBasePaths = Array.from(new Set(basePaths.filter(isNonEmptyString)));
      const targetIds = targets.map((target) => target.id);
      if (!targetIds.length) return dedupedBasePaths;

      const supabase = ensureSupabaseClient();
      const { data: variantRows, error: variantError } = await supabase
        .from("media_asset_variants")
        .select("storage_path")
        .in("media_file_id", targetIds);

      // Backward compatibility for environments that have not applied migration 005 yet.
      if (variantError && isMissingRelationError(variantError)) {
        return dedupedBasePaths;
      }
      if (variantError) throw variantError;

      const variantPaths = ((variantRows ?? []) as MediaVariantPathRow[]).map(
        (row) => row.storage_path
      );

      return Array.from(new Set([...dedupedBasePaths, ...variantPaths.filter(isNonEmptyString)]));
    },
    []
  );

  const removeStoragePaths = useCallback(async (paths: string[]): Promise<void> => {
    if (!paths.length) return;
    const supabase = ensureSupabaseClient();
    for (let start = 0; start < paths.length; start += STORAGE_DELETE_BATCH_SIZE) {
      const batch = paths.slice(start, start + STORAGE_DELETE_BATCH_SIZE);
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(batch);
      if (storageError) throw storageError;
      batch.forEach((path) => {
        invalidateSignedMediaUrl(BUCKET, path);
      });
    }
  }, []);

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

  const deleteSelected = async (idsOverride?: string[]): Promise<boolean> => {
    const idsToDelete = [...(idsOverride ?? selectedIds)];
    if (!idsToDelete.length || bulkDeleteInFlightRef.current) return false;
    bulkDeleteInFlightRef.current = true;
    setBulkDeleting(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      if (isPromptTab) {
        const { error: deleteError } = await supabase
          .from("media_prompts")
          .delete()
          .in("id", idsToDelete);
        if (deleteError) throw deleteError;
        setPrompts((prev) => prev.filter((prompt) => !idsToDelete.includes(prompt.id)));
        setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
        idsToDelete.forEach((promptId) => {
          void logMediaEvent("delete", "media_prompt", promptId);
        });
      } else {
        let targets: MediaDeleteTarget[] = files
          .filter((f) => idsToDelete.includes(f.id))
          .map((file) => ({
            id: file.id,
            storage_path: file.storage_path,
            preview_storage_path: file.preview_storage_path,
            thumb_variant_path: file.thumb_variant_path,
            poster_variant_path: file.poster_variant_path,
            preview_variant_path: file.preview_variant_path,
          }));
        if (targets.length < idsToDelete.length) {
          const targetIdSet = new Set(targets.map((target) => target.id));
          const missingIds = idsToDelete.filter((id) => !targetIdSet.has(id));
          if (missingIds.length) {
            const { data: missingRows, error: missingRowsError } = await supabase
              .from("media_files")
              .select(
                "id, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
              )
              .in("id", missingIds);
            if (missingRowsError) throw missingRowsError;

            const supplementalTargets = ((missingRows ?? []) as MediaDeleteLookupRow[]).map(
              (row) => ({
                id: row.id,
                storage_path: row.storage_path,
                preview_storage_path:
                  resolveMediaSigningStoragePaths(row, currentUserIdRef.current)[0] ??
                  row.storage_path,
                thumb_variant_path: row.thumb_variant_path,
                poster_variant_path: row.poster_variant_path,
                preview_variant_path: row.preview_variant_path,
              })
            );
            targets = [...targets, ...supplementalTargets];
          }
        }
        const paths = await collectMediaStoragePathsForDelete(targets);
        await removeStoragePaths(paths);
        const { error: deleteError } = await supabase
          .from("media_files")
          .delete()
          .in("id", idsToDelete);
        if (deleteError) throw deleteError;
        updateVisibleRows((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
        setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
        targets.forEach((target) => {
          void logMediaEvent("delete", "media_file", target.id, {
            storage_path: target.storage_path,
          });
        });
        markInactiveMediaCachesStale(activeMediaTab);
        void refreshStorageUsageBytes();
      }
      return true;
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, `Unable to delete selected ${isPromptTab ? "prompts" : "media"}`)
      );
      return false;
    } finally {
      bulkDeleteInFlightRef.current = false;
      setBulkDeleting(false);
    }
  };

  const requestDeleteSelected = () => {
    if (!selectedIds.length) return;
    if (isPromptTab) {
      void deleteSelected();
      return;
    }
    setConfirmDeleteIds([...selectedIds]);
    setError(null);
  };

  const cancelDeleteSelected = () => {
    if (bulkDeleting) return;
    setConfirmDeleteIds(null);
  };

  const confirmDeleteSelected = async () => {
    if (!confirmDeleteIds?.length) return;
    const deleted = await deleteSelected(confirmDeleteIds);
    if (deleted) {
      setConfirmDeleteIds(null);
    }
  };

  const applyMovedFilesToCaches = useCallback(
    (movedFiles: MediaRow[], destinationTab: MediaDataTab) => {
      if (!movedFiles.length) return;
      setMediaTabCache((prev) =>
        applyMovedRowsToMediaTabCache({
          cacheState: prev,
          movedRows: movedFiles,
          destinationTab,
        })
      );
    },
    []
  );

  const applyMovedFileToCaches = useCallback(
    (file: MediaRow, destinationTab: MediaDataTab) => {
      applyMovedFilesToCaches([file], destinationTab);
    },
    [applyMovedFilesToCaches]
  );

  const requestMoveFileToTab = useCallback(
    async (file: MediaRow, destinationTab: MediaDataTab): Promise<MoveFileResult> => {
      const response = await fetchWithAuth("/api/media/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: file.id,
          destinationTab,
        }),
        shortpulseLogScope: "app",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;
        throw new Error(
          payload?.details ?? payload?.error ?? `Unable to move file (${response.status})`
        );
      }

      const payload = (await response.json()) as MoveMediaResponse;
      const movedFile = payload.file;
      const previewStoragePath =
        resolveMediaSigningStoragePaths(movedFile, currentUserIdRef.current)[0] ??
        movedFile.storage_path;
      const signedUrl = await signStoragePath(previewStoragePath, { forceRefresh: true });

      return {
        nextFile: {
          ...movedFile,
          preview_storage_path: previewStoragePath,
          signedUrl: signedUrl ?? undefined,
          status: "ready",
        },
        toTab: payload.toTab,
        previousSignPaths: resolveMediaSigningStoragePaths(file, currentUserIdRef.current),
      };
    },
    [signStoragePath]
  );

  const moveFocusedFile = useCallback(
    async (destinationTab: MediaDataTab) => {
      if (!focusedFile || movingFile) return;
      setMovingFile(true);
      setMoveError(null);
      setModalError(null);
      setError(null);
      const previousFile = focusedFile;

      try {
        const result = await requestMoveFileToTab(previousFile, destinationTab);
        const nextFocusedFile = result.nextFile;
        for (const path of result.previousSignPaths) {
          invalidateSignedMediaUrl(BUCKET, path);
        }

        applyMovedFileToCaches(nextFocusedFile, result.toTab);
        setFiles((prev) => {
          const rowsWithoutFile = prev.filter((row) => row.id !== nextFocusedFile.id);
          if (activeTabRef.current !== result.toTab) return rowsWithoutFile;
          return mergePageRows(rowsWithoutFile, [nextFocusedFile]).filter(
            (row) => getMediaDataTabForRow(row) === result.toTab
          );
        });
        setFocusedFile(nextFocusedFile);
        setSelectedIds((prev) => prev.filter((id) => id !== nextFocusedFile.id));
        setMoveMenuOpen(false);
        if (activeTabRef.current !== result.toTab) {
          setActiveTab(result.toTab);
        }
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Unable to move file");
        setMoveError(message);
      } finally {
        setMovingFile(false);
      }
    },
    [
      applyMovedFileToCaches,
      focusedFile,
      movingFile,
      requestMoveFileToTab,
      setFocusedFile,
      setModalError,
    ]
  );

  const modalMoveTabOptions = useMemo(() => buildModalMoveTabOptions(focusedFile), [focusedFile]);
  const canMoveToAnotherTab = useMemo(
    () => modalMoveTabOptions.some((option) => !option.disabled),
    [modalMoveTabOptions]
  );

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
      setMoveError(null);
      setMoveMenuOpen(false);
      resetModalImageZoom();
    },
    [openFileModal, resetModalImageZoom]
  );

  const closeModal = useCallback(() => {
    closeFileModal();
    setMoveError(null);
    setMoveMenuOpen(false);
    resetModalImageZoom();
  }, [closeFileModal, resetModalImageZoom]);

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
        <section className="panel saved-header-bar saved-hero hero-image-card">
          <div className="saved-header-left">
            <div className="saved-title-stack">
              <div className="saved-title-row">
                <h1 className="title">Media Library</h1>
              </div>
              <p className="subdued">
                Upload, organize, and manage your workspace media in one place.
              </p>
            </div>
          </div>
          <div className="header-cards media-header-cards">
            <div className="header-stat-card" aria-label="Media storage">
              <div className="status-icon compact" aria-hidden="true">
                <CloudArrowUp size={18} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">Media storage</p>
                <p className="status-value small">{storageUsageValue}</p>
              </div>
            </div>
            <div className="header-stat-card" aria-label="Plan status">
              <div className="status-icon compact" aria-hidden="true">
                <ShieldCheck size={16} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">{planUsage.label}</p>
                <p className="status-value small">{planUsage.name}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="panel media-stage hero-image-card media-panel"
          style={{
            backgroundImage: "none",
          }}
        >
          <div
            className={`drop-zone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label="File upload area"
          >
            <p className="title">Drag and drop media here</p>
            {uploading && (
              <div className="subdued tiny" role="status" aria-live="polite">
                Uploading {uploadCount || ""} file{uploadCount === 1 ? "" : "s"}…
              </div>
            )}
            {error && (
              <div className="auth-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
          </div>

          <div className="upload-side">
            <p className="eyebrow">Add files</p>
            <h3>Browse your computer</h3>
            <button className="btn-primary add-files-cta" type="button" onClick={triggerFilePicker}>
              <DownloadSimple size={20} weight="bold" />
              Add Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={activeTab === "private" ? "image/*" : "image/*,video/*"}
              onChange={handleFileChange}
              aria-label="Select media files"
              style={{ display: "none" }}
            />
            {selectedFiles.length > 0 && (
              <div className="subdued tiny">
                {selectedFiles.length} selected •{" "}
                {selectedFiles
                  .map((f) => f.name)
                  .slice(0, 3)
                  .join(", ")}
                {selectedFiles.length > 3 ? "…" : ""}
              </div>
            )}
            <div className="upload-storage">
              <div>
                <p className="tiny subdued">Storage used</p>
                <strong>{(totalBytes / (1024 * 1024)).toFixed(1)} MB</strong>
                <span className="tiny subdued">of {(planLimitMb / 1024).toFixed(1)} GB</span>
              </div>
              <button type="button" className="btn-secondary upgrade-btn">
                Need more storage?
              </button>
            </div>
          </div>
        </section>

        <div className="media-filters-row">
          <div
            className="panel media-filter-dashboard-card media-panel"
            aria-label="Workspace navigation"
          >
            <DashboardNavPrefab />
          </div>
          <section
            className="panel media-filters media-panel"
            aria-label="Media filters and search"
          >
            <div className="filter-tabs" role="tablist" aria-label="Media categories">
              <button
                type="button"
                className={`pill-toggle big ${activeTab === "uploaded_images" ? "active" : ""}`}
                onClick={() => setActiveTab("uploaded_images")}
              >
                Uploaded Images
              </button>
              <button
                type="button"
                className={`pill-toggle big ${activeTab === "uploaded_videos" ? "active" : ""}`}
                onClick={() => setActiveTab("uploaded_videos")}
              >
                Uploaded Videos
              </button>
              <button
                type="button"
                className={`pill-toggle big ${activeTab === "saved_prompts" ? "active" : ""}`}
                onClick={() => setActiveTab("saved_prompts")}
              >
                Saved Prompts
              </button>
              <button
                type="button"
                className={`pill-toggle big ${activeTab === "ai_generations" ? "active" : ""}`}
                onClick={() => setActiveTab("ai_generations")}
              >
                AI Studio Generations
              </button>
              <button
                type="button"
                className={`pill-toggle big ${activeTab === "private" ? "active" : ""}`}
                onClick={() => setActiveTab("private")}
              >
                <LockSimple size={14} weight="bold" aria-hidden />
                Private
              </button>
            </div>
            <span className="pill tiny filter-count">
              {visibleCount} {countLabel}
            </span>
            <div className="search-wrap">
              <div className="search-input">
                <MagnifyingGlass size={16} weight="bold" />
                <input
                  type="text"
                  placeholder={
                    isPromptTab ? "Search saved prompts" : "Search media by name or file"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <section
          className={`panel media-gallery media-panel ${isPromptTab ? "" : "media-gallery-packed"}`}
        >
          <div className="gallery-actions">
            <div className="section-heading minimal">
              <div>
                <p className="eyebrow">
                  {activeTab === "uploaded_images"
                    ? "Uploaded images"
                    : activeTab === "uploaded_videos"
                      ? "Uploaded videos"
                      : activeTab === "private"
                        ? "Private images"
                        : activeTab === "saved_prompts"
                          ? "Saved prompts"
                          : "AI Studio generations"}
                </p>
                <h3>
                  {activeTab === "uploaded_images"
                    ? "Your uploaded images"
                    : activeTab === "uploaded_videos"
                      ? "Your uploaded videos"
                      : activeTab === "private"
                        ? "Your private images"
                        : activeTab === "saved_prompts"
                          ? "Your saved prompts"
                          : "AI Studio generations"}
                </h3>
              </div>
            </div>
            <div className="gallery-btns">
              {selectedIds.length ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedIds([]);
                    setBulkMoveError(null);
                    setBulkMoveNotice(null);
                  }}
                >
                  Deselect all
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={selectAllVisible}
                disabled={!selectableIds.length || allVisibleSelected || bulkMoving}
              >
                Select all
              </button>
              {!isPromptTab ? (
                <div className="gallery-move">
                  <button
                    type="button"
                    className="btn-secondary gallery-move-toggle"
                    onClick={() => {
                      setBulkMoveError(null);
                      setBulkMoveMenuOpen((prev) => !prev);
                    }}
                    disabled={
                      !selectedMediaRows.length || !canBulkMove || bulkDeleting || bulkMoving
                    }
                    aria-haspopup="menu"
                    aria-expanded={bulkMoveMenuOpen}
                  >
                    <span>{bulkMoving ? "Moving..." : "Move selected"}</span>
                    <CaretDown
                      size={14}
                      weight="bold"
                      className={bulkMoveMenuOpen ? "is-open" : ""}
                      aria-hidden
                    />
                  </button>
                  {bulkMoveMenuOpen ? (
                    <div className="gallery-move-menu" role="menu" aria-label="Move selected media">
                      {bulkMoveTabOptions.map((option) => {
                        const label = option.reason
                          ? `${option.label} · ${option.reason}`
                          : option.label;
                        return (
                          <button
                            key={option.tab}
                            type="button"
                            className="gallery-move-option"
                            role="menuitem"
                            disabled={
                              option.disabled || !isMoveDestinationDataTab(option.tab) || bulkMoving
                            }
                            onClick={() => {
                              if (option.disabled || !isMoveDestinationDataTab(option.tab)) return;
                              void moveSelectedFiles(option.tab);
                            }}
                            title={label}
                          >
                            <span>{option.label}</span>
                            {option.reason ? <small>{option.reason}</small> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="btn-danger"
                onClick={requestDeleteSelected}
                disabled={!selectedIds.length || bulkDeleting || bulkMoving}
                aria-label={`${deleteButtonLabel} ${selectedIds.length} ${deleteItemLabel}`}
              >
                {bulkDeleting ? "Deleting..." : deleteButtonLabel}
              </button>
            </div>
          </div>
          {bulkMoveNotice && !isPromptTab ? (
            <div className="subdued tiny media-bulk-move-notice" role="status" aria-live="polite">
              {bulkMoveNotice}
            </div>
          ) : null}
          {bulkMoveError && !isPromptTab ? (
            <div className="auth-error media-bulk-move-error" role="alert" aria-live="assertive">
              {bulkMoveError}
            </div>
          ) : null}
          {loading && <div className="subdued tiny">Loading media…</div>}
          {!loading && isPromptTab && !filteredPrompts.length && (
            <div className="subdued tiny">No prompts saved yet.</div>
          )}
          {!loading && !isPromptTab && !filteredMedia.length && (
            <div className="subdued tiny">
              {activeTab === "uploaded_images"
                ? "No images uploaded yet."
                : activeTab === "uploaded_videos"
                  ? "No videos uploaded yet."
                  : activeTab === "private"
                    ? "No private images uploaded yet."
                    : "No AI Studio generations saved yet."}
            </div>
          )}
          {isPromptTab ? (
            <div className="prompt-grid">
              {filteredPrompts.map((promptItem) => (
                <div
                  className={`prompt-card ${selectedIds.includes(promptItem.id) ? "is-selected" : ""}`}
                  key={promptItem.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedIds.includes(promptItem.id)}
                  onClick={() => togglePromptSelect(promptItem.id)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    openPromptModal(promptItem);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      togglePromptSelect(promptItem.id);
                    }
                  }}
                >
                  {selectedIds.includes(promptItem.id) ? (
                    <span className="prompt-select-indicator" aria-hidden>
                      <CheckCircle size={16} weight="fill" />
                    </span>
                  ) : null}
                  <div className="prompt-card-header">
                    <div>
                      <p className="metric-label">{promptItem.title || "Saved prompt"}</p>
                      <p className="metric-value tiny">{formatDate(promptItem.created_at)}</p>
                    </div>
                    <span className="pill tiny">{promptItem.mode}</span>
                  </div>
                  <p className="prompt-card-body">{promptItem.prompt_text}</p>
                  <div className="prompt-card-footer">
                    <button
                      type="button"
                      className="btn-secondary prompt-delete-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deletePrompt(promptItem);
                      }}
                      aria-label={`Delete prompt: ${promptItem.title || "Saved prompt"}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="media-grid media-grid-fixed media-grid-shell media-grid-packed">
                {filteredMedia.map((file) => {
                  const aspectRatio =
                    aspectMap[file.id] || (isVideoFile(file.file_type) ? 9 / 16 : 4 / 5);
                  return (
                    <div
                      className={`media-card ${file.status === "uploading" ? "is-uploading" : ""} ${
                        selectedIds.includes(file.id) ? "is-selected" : ""
                      }`}
                      key={file.id}
                      ref={getMediaCardRef(file.id)}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSelect(file)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelect(file);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        openModal(file);
                      }}
                    >
                      {file.status === "uploading" ? (
                        <div className="media-thumb placeholder" style={{ aspectRatio }}>
                          <div className="loader-spin" />
                        </div>
                      ) : file.signedUrl ? (
                        isVideoFile(file.file_type) ? (
                          <video
                            className="media-thumb"
                            src={file.signedUrl}
                            muted
                            playsInline
                            loop
                            autoPlay
                            preload="metadata"
                            onLoadedMetadata={(e) => handleVideoMeta(file.id, e)}
                            onError={() => handleMediaPreviewError(file)}
                            style={{ aspectRatio }}
                          />
                        ) : (
                          <>
                            {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={file.signedUrl}
                              alt={file.filename}
                              className="media-thumb"
                              onLoad={(e) => handleImageLoad(file.id, e)}
                              onError={() => handleMediaPreviewError(file)}
                              style={{ aspectRatio }}
                            />
                          </>
                        )
                      ) : (
                        <div
                          className="media-thumb placeholder"
                          style={{ aspectRatio }}
                          aria-hidden
                        />
                      )}
                      {selectedIds.includes(file.id) ? (
                        <span className="media-select-indicator" aria-hidden>
                          <CheckCircle size={13} weight="fill" />
                        </span>
                      ) : null}
                      {file.status !== "uploading" ? (
                        <div className="media-card-actions">
                          <button
                            type="button"
                            className="media-download"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void downloadFile(file);
                            }}
                            aria-label={`Download file: ${file.filename || "media file"}`}
                          >
                            <DownloadSimple size={14} weight="bold" />
                          </button>
                          <button
                            type="button"
                            className="media-delete"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              requestDeleteFile(file);
                            }}
                            aria-label={`Delete file: ${file.filename || "media file"}`}
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {hasMoreMediaPages ? (
                <div className="media-load-more" ref={loadMoreSentinelRef}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (!activeMediaTab) return;
                      void fetchMediaTabPage(activeMediaTab, { query: activeMediaQuery });
                    }}
                    disabled={loadingMoreMedia}
                  >
                    {loadingMoreMedia ? "Loading more..." : "Load more"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </main>

      {deleteTarget ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-file-title"
        >
          <div className="modal-card media-delete-confirm-card">
            <h3 id="delete-file-title">Delete this file from your library?</h3>
            <p className="subdued tiny media-delete-confirm-copy">
              This will permanently remove <strong>{deleteTarget.filename}</strong> from your Media
              Library and private storage. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelDeleteFile}
                disabled={deletingSingle}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDeleteFile}
                disabled={deletingSingle}
              >
                {deletingSingle ? "Deleting..." : "Yes, delete file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteIds?.length ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-selected-title"
        >
          <div className="modal-card media-delete-confirm-card">
            <h3 id="delete-selected-title">Delete selected file(s) from your library?</h3>
            <p className="subdued tiny media-delete-confirm-copy">
              This will permanently remove{" "}
              <strong>{confirmDeleteIds.length} selected file(s)</strong> from your Media Library
              and private storage. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelDeleteSelected}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDeleteSelected}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting..." : "Yes, delete selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {focusedFile ? (
        <div className="media-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="media-modal-backdrop" onClick={closeModal} />
          <div className="media-modal-content">
            <div className="modal-body">
              <div
                className="modal-preview"
                ref={modalPreviewRef}
                style={
                  {
                    aspectRatio: focusedAspectRatio,
                    "--modal-preview-aspect": String(focusedAspectRatio),
                  } as React.CSSProperties
                }
                onWheel={handleModalPreviewWheel}
              >
                {focusedFile.signedUrl ? (
                  isVideoFile(focusedFile.file_type) ? (
                    <video
                      src={focusedFile.signedUrl}
                      controls
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (!video.videoWidth || !video.videoHeight) return;
                        cacheAspectRatio(focusedFile.id, video.videoWidth / video.videoHeight);
                      }}
                      onError={() => handleMediaPreviewError(focusedFile)}
                    />
                  ) : (
                    <>
                      {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={focusedFile.signedUrl}
                        alt={focusedFile.filename}
                        className={`modal-zoomable-image ${modalImageZoomActive ? "is-zoom-active" : ""} ${modalImageZoomScale > 1 ? "is-zoomed" : ""} ${isModalImagePanning ? "is-panning" : ""}`}
                        style={{
                          transform: `translate3d(${modalImagePan.x}px, ${modalImagePan.y}px, 0) scale(${modalImageZoomScale})`,
                          transformOrigin: "50% 50%",
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Toggle zoom mode for image preview"
                        onClick={handleModalImageClick}
                        onKeyDown={handleModalImageKeyDown}
                        onWheel={handleModalImageWheel}
                        onPointerDown={handleModalImagePointerDown}
                        onPointerMove={handleModalImagePointerMove}
                        onPointerUp={handleModalImagePointerUp}
                        onPointerCancel={handleModalImagePointerUp}
                        onLoad={(event) => {
                          const image = event.currentTarget;
                          if (!image.naturalWidth || !image.naturalHeight) return;
                          cacheAspectRatio(
                            focusedFile.id,
                            image.naturalWidth / image.naturalHeight
                          );
                          cacheModalImageNaturalSize(image.naturalWidth, image.naturalHeight);
                        }}
                        onError={() => handleMediaPreviewError(focusedFile)}
                      />
                    </>
                  )
                ) : (
                  <div className="placeholder" aria-hidden />
                )}
              </div>
              <div className="modal-meta">
                <div className="modal-top-actions">
                  <button
                    className="btn-secondary modal-pill-btn"
                    type="button"
                    onClick={() => void downloadFile(focusedFile)}
                  >
                    Download
                  </button>
                  <button
                    className="btn-danger modal-delete-btn modal-pill-btn"
                    type="button"
                    onClick={() => requestDeleteFile(focusedFile)}
                  >
                    Delete
                  </button>
                  <button
                    className="btn-secondary close-btn modal-pill-btn modal-close-pill"
                    type="button"
                    onClick={closeModal}
                    aria-label="Close preview"
                  >
                    ×
                  </button>
                </div>
                <label htmlFor="renameInput" id="modal-title" className="eyebrow">
                  File name
                </label>
                <input
                  id="renameInput"
                  type="text"
                  value={renameValue}
                  onChange={(e) => handleRenameInputChange(e.target.value)}
                  className="input"
                  aria-label="Enter new filename"
                />
                {modalError && (
                  <div className="auth-error" role="alert" aria-live="assertive">
                    {modalError}
                  </div>
                )}
                <button
                  className="btn-primary"
                  type="button"
                  onClick={saveRename}
                  disabled={savingRename || !renameValue.trim()}
                >
                  {savingRename ? "Renaming..." : "Rename"}
                </button>
                <div className="modal-move">
                  <button
                    className="btn-secondary modal-move-toggle"
                    type="button"
                    onClick={() => setMoveMenuOpen((prev) => !prev)}
                    disabled={movingFile || !canMoveToAnotherTab}
                    aria-haspopup="menu"
                    aria-expanded={moveMenuOpen}
                  >
                    <span>{movingFile ? "Moving..." : "Move"}</span>
                    <CaretDown
                      size={14}
                      weight="bold"
                      className={moveMenuOpen ? "is-open" : ""}
                      aria-hidden
                    />
                  </button>
                  {moveMenuOpen ? (
                    <div className="modal-move-menu" role="menu" aria-label="Move media to tab">
                      {modalMoveTabOptions.map((option) => {
                        return (
                          <button
                            key={option.tab}
                            type="button"
                            className="modal-move-option"
                            role="menuitem"
                            disabled={movingFile || option.disabled}
                            onClick={() => {
                              if (option.disabled) return;
                              void moveFocusedFile(option.tab);
                            }}
                            title={option.label}
                          >
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {moveError ? (
                  <div className="auth-error" role="alert" aria-live="assertive">
                    {moveError}
                  </div>
                ) : null}
                {renameSuccess && !modalError && !savingRename && (
                  <div className="rename-toast" role="status" aria-live="polite">
                    <CheckCircle size={16} weight="bold" />
                    <span>Saved</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {focusedPrompt ? (
        <div
          className="media-modal prompt-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-modal-title"
        >
          <div className="media-modal-backdrop" onClick={closePromptModal} />
          <div className="prompt-modal-content">
            <div className="prompt-modal-top-actions">
              <button
                className="btn-danger modal-pill-btn prompt-modal-delete-btn"
                type="button"
                onClick={() => {
                  void deletePrompt(focusedPrompt, { fromPromptModal: true });
                }}
                disabled={savingPromptEdit}
              >
                Delete
              </button>
              <button
                className="btn-secondary close-btn modal-pill-btn modal-close-pill prompt-modal-close-btn"
                type="button"
                onClick={closePromptModal}
                aria-label="Close prompt editor"
                disabled={savingPromptEdit}
              >
                ×
              </button>
            </div>

            <label htmlFor="promptEditInput" id="prompt-modal-title" className="eyebrow">
              Saved prompt
            </label>
            <textarea
              id="promptEditInput"
              className="prompt-modal-textarea"
              value={promptEditValue}
              onChange={(event) => {
                handlePromptEditChange(event.target.value);
              }}
              placeholder="Edit your prompt..."
            />

            {promptModalError ? (
              <div className="auth-error" role="alert" aria-live="assertive">
                {promptModalError}
              </div>
            ) : null}

            <div className="prompt-modal-footer">
              {promptSaveSuccess ? (
                <div className="rename-toast prompt-modal-toast" role="status" aria-live="polite">
                  <CheckCircle size={16} weight="bold" />
                  <span>Saved</span>
                </div>
              ) : (
                <span aria-hidden />
              )}
              <button
                className="btn-primary prompt-modal-save-btn"
                type="button"
                onClick={() => {
                  void savePromptEdits();
                }}
                disabled={savingPromptEdit || !promptEditValue.trim()}
              >
                {savingPromptEdit ? "Saving..." : "Save edits"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
