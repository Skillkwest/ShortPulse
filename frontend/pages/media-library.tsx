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
import { createMediaPerfTimer, logMediaPerf } from "../lib/mediaPerfTelemetry";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../lib/mediaPreviewPath";
import {
  getSignedMediaUrl,
  getSignedMediaUrlsBatch,
  invalidateSignedMediaUrl,
} from "../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../lib/supabaseClient";
import {
  buildBulkMoveTabOptions,
  buildMoveTabOptions,
  getMoveTabLabel,
  type MediaMoveDestination,
  type MediaTabOption,
} from "../features/media-library/logic/mediaMoveRouting";
import { buildBulkMoveFeedback } from "../features/media-library/logic/bulkMoveFeedback";

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

type MediaDataTab = Exclude<MediaTab, "saved_prompts">;

type MediaCursor = {
  createdAt: string;
  id: string;
};

type MediaTabCache = {
  rows: MediaRow[];
  nextCursor: MediaCursor | null;
  pagesLoaded: number;
  query: string;
  loadedAtMs: number | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

type MediaTabRequestState = Record<MediaDataTab, number>;
type MediaTabBooleanState = Record<MediaDataTab, boolean>;
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

type MoveMediaBatchResponse = {
  destinationTab: MediaDataTab;
  moved: Array<{
    fileId: string;
    file: MediaRow;
    fromTab: MediaDataTab;
    toTab: MediaDataTab;
    previousStoragePath: string;
    nextStoragePath: string;
  }>;
  failed: Array<{
    fileId: string;
    error: string;
    details?: string;
  }>;
  summary: {
    requested: number;
    moved: number;
    failed: number;
  };
};

type MoveFileResult = {
  nextFile: MediaRow;
  toTab: MediaDataTab;
  previousSignPaths: string[];
};

const BUCKET = "media_library";
const PRIVATE_MEDIA_SOURCE = "private_upload";
const PRIVATE_MEDIA_FOLDER = "private";
const MEDIA_LIBRARY_PAGE_SIZE = 60;
const MEDIA_LIBRARY_CACHE_TTL_MS = 30_000;
const STORAGE_DELETE_BATCH_SIZE = 100;
const MEDIA_ROUTE_SIGN_SMALL_SCREEN_QUERY = "(max-width: 900px)";

type MediaSignBudget = {
  initialSignLimit: number;
  prefetchWindow: number;
  signBatchSize: number;
};

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

const MEDIA_ROUTE_SIGN_BUDGET_DESKTOP: MediaSignBudget = {
  initialSignLimit: 12,
  prefetchWindow: 24,
  signBatchSize: 10,
};
const MEDIA_ROUTE_SIGN_BUDGET_SMALL_SCREEN: MediaSignBudget = {
  initialSignLimit: 8,
  prefetchWindow: 16,
  signBatchSize: 6,
};
const MEDIA_ROUTE_SIGN_BUDGET_CONSTRAINED: MediaSignBudget = {
  initialSignLimit: 5,
  prefetchWindow: 10,
  signBatchSize: 4,
};

const resolveRouteSignBudget = (): MediaSignBudget => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return MEDIA_ROUTE_SIGN_BUDGET_DESKTOP;
  }
  const nav = navigator as NavigatorWithConnection;
  const isSmallScreen = window.matchMedia(MEDIA_ROUTE_SIGN_SMALL_SCREEN_QUERY).matches;
  const saveData = nav.connection?.saveData === true;
  const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
  const isSlowNetwork = effectiveType.includes("2g");
  const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  if (saveData || isSlowNetwork || isLowMemory) {
    return MEDIA_ROUTE_SIGN_BUDGET_CONSTRAINED;
  }
  if (isSmallScreen) {
    return MEDIA_ROUTE_SIGN_BUDGET_SMALL_SCREEN;
  }
  return MEDIA_ROUTE_SIGN_BUDGET_DESKTOP;
};
const MEDIA_DATA_TABS: MediaDataTab[] = [
  "uploaded_images",
  "uploaded_videos",
  "private",
  "ai_generations",
];

const sanitizeFileName = (name: string) => name.replace(/[^\w.-]+/g, "_");

const fileTypeFromMime = (mime: string) => {
  if (mime.startsWith("video/")) return "video";
  return "image";
};

const isVideoFile = (fileType?: string | null) => (fileType || "").startsWith("video");
const isPrivateStoragePath = (storagePath?: string | null) =>
  (storagePath ?? "").split("/").filter(Boolean).includes(PRIVATE_MEDIA_FOLDER);
const isPrivateMediaFile = (file: Pick<MediaRow, "source" | "storage_path">) =>
  (file.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(file.storage_path);

const isMediaDataTab = (tab: MediaTab): tab is MediaDataTab => tab !== "saved_prompts";
const isMoveDataTab = (tab: MediaMoveDestination): tab is MediaDataTab => tab !== "saved_prompts";
const isDataMoveOption = (
  option: MediaTabOption
): option is MediaTabOption & { tab: MediaDataTab } => isMoveDataTab(option.tab);
const isEnabledDataMoveOption = (
  option: MediaTabOption
): option is MediaTabOption & { tab: MediaDataTab; disabled: false } =>
  isDataMoveOption(option) && !option.disabled;
const VIDEO_MODAL_MOVE_TAB_ORDER: MediaDataTab[] = ["uploaded_videos", "ai_generations", "private"];

const getMediaDataTabForRow = (
  row: Pick<MediaRow, "source" | "storage_path" | "file_type">
): MediaDataTab => {
  if (isPrivateMediaFile(row)) return "private";
  if ((row.source ?? "upload") === "ai_studio") return "ai_generations";
  return isVideoFile(row.file_type) ? "uploaded_videos" : "uploaded_images";
};

const createEmptyMediaTabCache = (): MediaTabCache => ({
  rows: [],
  nextCursor: null,
  pagesLoaded: 0,
  query: "",
  loadedAtMs: null,
  hasMore: true,
  loading: false,
  loaded: false,
  error: null,
});

const createMediaTabCacheState = (): Record<MediaDataTab, MediaTabCache> => ({
  uploaded_images: createEmptyMediaTabCache(),
  uploaded_videos: createEmptyMediaTabCache(),
  private: createEmptyMediaTabCache(),
  ai_generations: createEmptyMediaTabCache(),
});

const createMediaTabRequestState = (): MediaTabRequestState => ({
  uploaded_images: 0,
  uploaded_videos: 0,
  private: 0,
  ai_generations: 0,
});

const createMediaTabBooleanState = (): MediaTabBooleanState => ({
  uploaded_images: false,
  uploaded_videos: false,
  private: false,
  ai_generations: false,
});

const withMediaTabFilter = <
  T extends {
    eq: (column: string, value: string) => T;
    ilike: (column: string, pattern: string) => T;
  },
>(
  query: T,
  tab: MediaDataTab
): T => {
  if (tab === "private") return query.eq("source", PRIVATE_MEDIA_SOURCE);
  if (tab === "ai_generations") return query.eq("source", "ai_studio");
  if (tab === "uploaded_videos") return query.eq("source", "upload").ilike("file_type", "video%");
  return query.eq("source", "upload").ilike("file_type", "image%");
};

const normalizeMediaSearchTerm = (value: string): string =>
  value
    .trim()
    .replace(/[,%*()]/g, " ")
    .replace(/\s+/g, " ");

const buildMediaSearchOrClause = (value: string): string | null => {
  const normalized = normalizeMediaSearchTerm(value);
  if (!normalized) return null;
  const wildcard = `*${normalized}*`;
  return `filename.ilike.${wildcard},storage_path.ilike.${wildcard}`;
};

const withMediaSearchFilter = <T extends { or: (clause: string) => T }>(
  query: T,
  rawSearchTerm: string
): T => {
  const clause = buildMediaSearchOrClause(rawSearchTerm);
  if (!clause) return query;
  return query.or(clause);
};

const buildCursorFromRows = <T extends { id?: string | null; created_at?: string | null }>(
  rows: T[]
): MediaCursor | null => {
  if (!rows.length) return null;
  const tail = rows[rows.length - 1];
  const id = tail.id ?? "";
  const createdAt = tail.created_at ?? "";
  if (!id || !createdAt) return null;
  return { id, createdAt };
};

const mergePageRows = (current: MediaRow[], incoming: MediaRow[]): MediaRow[] => {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return b.id.localeCompare(a.id);
  });
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

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const createdAtTime = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByCreatedAtDesc = <T extends { created_at?: string | null; id?: string | null }>(
  rows: T[]
): T[] =>
  [...rows].sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isMissingRelationError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: string }).code === "42P01";
};

const isMissingRoutineError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: string }).code === "42883";
};

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [mediaTabCache, setMediaTabCache] =
    useState<Record<MediaDataTab, MediaTabCache>>(createMediaTabCacheState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>("uploaded_images");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [aspectMap, setAspectMap] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
  const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
  const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaRow | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [focusedFile, setFocusedFile] = useState<MediaRow | null>(null);
  const [focusedPrompt, setFocusedPrompt] = useState<PromptRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [movingFile, setMovingFile] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const [promptEditValue, setPromptEditValue] = useState("");
  const [savingPromptEdit, setSavingPromptEdit] = useState(false);
  const [promptModalError, setPromptModalError] = useState<string | null>(null);
  const [promptSaveSuccess, setPromptSaveSuccess] = useState(false);
  const [storageUsageBytes, setStorageUsageBytes] = useState<number | null>(null);
  const [modalImageZoomScale, setModalImageZoomScale] = useState(1);
  const [modalImageZoomActive, setModalImageZoomActive] = useState(false);
  const [modalImagePan, setModalImagePan] = useState({ x: 0, y: 0 });
  const [modalImageNaturalSize, setModalImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isModalImagePanning, setIsModalImagePanning] = useState(false);
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
  const modalPreviewRef = useRef<HTMLDivElement | null>(null);
  const modalImagePanDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const modalImageDraggedRef = useRef(false);
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
  }, []);

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

  const syncActiveMediaCacheRows = useCallback(
    (rows: MediaRow[]) => {
      if (!activeMediaTab) return;
      const queryTerm = activeMediaQuery.toLowerCase();
      setMediaTabCache((prev) => ({
        ...prev,
        [activeMediaTab]: {
          ...prev[activeMediaTab],
          rows: rows.filter((row) => {
            if (getMediaDataTabForRow(row) !== activeMediaTab) return false;
            if (!queryTerm) return true;
            const name = row.filename?.toLowerCase() ?? "";
            const path = row.storage_path?.toLowerCase() ?? "";
            return name.includes(queryTerm) || path.includes(queryTerm);
          }),
          loadedAtMs: Date.now(),
          loaded: true,
        },
      }));
    },
    [activeMediaQuery, activeMediaTab]
  );

  const updateVisibleRows = useCallback(
    (updater: (prev: MediaRow[]) => MediaRow[]) => {
      setFiles((prev) => {
        const next = updater(prev);
        syncActiveMediaCacheRows(next);
        return next;
      });
    },
    [syncActiveMediaCacheRows]
  );

  const markInactiveMediaCachesStale = useCallback((currentTab: MediaDataTab | null) => {
    setMediaTabCache((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const tab of MEDIA_DATA_TABS) {
        if (tab === currentTab) continue;
        if (next[tab].loadedAtMs == null) continue;
        next[tab] = {
          ...next[tab],
          loadedAtMs: null,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const fetchMediaTabPage = useCallback(
    async (tab: MediaDataTab, options?: { reset?: boolean; query?: string }) => {
      const cache = mediaTabCache[tab];
      const normalizedQuery = normalizeMediaSearchTerm(options?.query ?? cache.query);
      const shouldReset = (options?.reset ?? false) || cache.query !== normalizedQuery;
      if (cache.loading) return;
      if (!shouldReset && !cache.hasMore) return;
      const requestId = mediaTabRequestRef.current[tab] + 1;
      mediaTabRequestRef.current[tab] = requestId;
      const isStaleRequest = () => mediaTabRequestRef.current[tab] !== requestId;

      const pageToLoad = shouldReset ? 0 : cache.pagesLoaded;
      const cursor = shouldReset ? null : cache.nextCursor;
      setError(null);
      setMediaTabCache((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          rows: shouldReset ? [] : prev[tab].rows,
          nextCursor: shouldReset ? null : prev[tab].nextCursor,
          pagesLoaded: shouldReset ? 0 : prev[tab].pagesLoaded,
          query: normalizedQuery,
          hasMore: shouldReset ? true : prev[tab].hasMore,
          loading: true,
          error: null,
        },
      }));
      if (activeTabRef.current === tab && (shouldReset || !cache.loaded)) {
        setLoading(true);
      }

      try {
        const supabase = ensureSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) throw new Error("Not signed in");
        currentUserIdRef.current = userId;

        const selectColumns =
          "id, filename, storage_path, file_type, file_size, source, source_ref, prompt_id, metadata, thumb_variant_path, poster_variant_path, preview_variant_path, created_at, updated_at";
        const buildBaseQuery = () => {
          let query = supabase.from("media_files").select(selectColumns).eq("user_id", userId);
          query = withMediaTabFilter(query, tab);
          query = withMediaSearchFilter(query, normalizedQuery);
          return query.order("created_at", { ascending: false }).order("id", { ascending: false });
        };

        const fetchedRows: MediaRow[] = [];
        if (!cursor) {
          const firstPageResponse = await buildBaseQuery().limit(MEDIA_LIBRARY_PAGE_SIZE);
          if (firstPageResponse.error) throw firstPageResponse.error;
          fetchedRows.push(...((firstPageResponse.data ?? []) as MediaRow[]));
        } else {
          const sameTimestampResponse = await buildBaseQuery()
            .eq("created_at", cursor.createdAt)
            .lt("id", cursor.id)
            .limit(MEDIA_LIBRARY_PAGE_SIZE);
          if (sameTimestampResponse.error) throw sameTimestampResponse.error;
          const sameTimestampRows = (sameTimestampResponse.data ?? []) as MediaRow[];
          fetchedRows.push(...sameTimestampRows);

          const remaining = MEDIA_LIBRARY_PAGE_SIZE - sameTimestampRows.length;
          if (remaining > 0) {
            const olderRowsResponse = await buildBaseQuery()
              .lt("created_at", cursor.createdAt)
              .limit(remaining);
            if (olderRowsResponse.error) throw olderRowsResponse.error;
            fetchedRows.push(...((olderRowsResponse.data ?? []) as MediaRow[]));
          }
        }
        if (isStaleRequest()) return;

        const rows = mergePageRows([], fetchedRows).slice(0, MEDIA_LIBRARY_PAGE_SIZE);
        const existingById = new Map(cache.rows.map((row) => [row.id, row]));
        const normalizedRows = rows.map((row) => {
          const signingCandidates = resolveMediaSigningStoragePaths(row, userId);
          const previewStoragePath = signingCandidates[0] ?? row.storage_path;
          const cachedRow = existingById.get(row.id);
          return {
            ...row,
            source: row.source ?? "upload",
            preview_storage_path: previewStoragePath,
            signedUrl: cachedRow?.signedUrl,
          } as MediaRow;
        });

        const derivedCursor = buildCursorFromRows(rows);
        const hasMore = rows.length === MEDIA_LIBRARY_PAGE_SIZE && Boolean(derivedCursor);
        const nextRows = shouldReset ? normalizedRows : mergePageRows(cache.rows, normalizedRows);
        setMediaTabCache((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            rows: nextRows,
            nextCursor: hasMore ? derivedCursor : null,
            pagesLoaded: pageToLoad + 1,
            query: normalizedQuery,
            loadedAtMs: Date.now(),
            hasMore,
            loading: false,
            loaded: true,
            error: null,
          },
        }));
        if (activeTabRef.current === tab) {
          setFiles(nextRows);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isStaleRequest()) return;
        const message = getErrorMessage(err, "Unable to load media");
        setMediaTabCache((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            loading: false,
            loaded: true,
            query: normalizedQuery,
            error: message,
          },
        }));
        if (activeTabRef.current === tab) {
          setError(message);
          setLoading(false);
        }
      }
    },
    [mediaTabCache]
  );

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("Not signed in");
      const promptResponse = await supabase
        .from("media_prompts")
        .select("id, title, prompt_text, mode, source, created_at, updated_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (promptResponse.error) throw promptResponse.error;
      setPrompts((promptResponse.data ?? []) as PromptRow[]);
      setPromptsLoaded(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load prompts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "saved_prompts") {
      if (!promptsLoaded) {
        void loadPrompts();
      } else {
        setLoading(false);
      }
      return;
    }
    const cache = mediaTabCache[activeTab];
    const queryChanged = cache.query !== activeMediaQuery;
    const isStale =
      cache.loadedAtMs == null || Date.now() - cache.loadedAtMs > MEDIA_LIBRARY_CACHE_TTL_MS;
    if (cache.loaded && !queryChanged && !isStale) {
      setFiles(cache.rows);
      setError(cache.error);
      setLoading(cache.loading);
      return;
    }
    if (cache.loaded && !queryChanged && isStale) {
      setFiles(cache.rows);
      setLoading(true);
    }
    void fetchMediaTabPage(activeTab, { reset: true, query: activeMediaQuery });
  }, [activeMediaQuery, activeTab, fetchMediaTabPage, loadPrompts, mediaTabCache, promptsLoaded]);

  useEffect(() => {
    if (!activeMediaTab) return;
    if (!activeMediaCache?.loaded || activeMediaCache.loading || !activeMediaCache.hasMore) return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        void fetchMediaTabPage(activeMediaTab, { query: activeMediaQuery });
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    activeMediaCache?.hasMore,
    activeMediaCache?.loaded,
    activeMediaCache?.loading,
    activeMediaQuery,
    activeMediaTab,
    fetchMediaTabPage,
  ]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list) return;
    const filesToUpload = Array.from(list);
    setSelectedFiles(filesToUpload);
    void uploadSelected(filesToUpload);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files;
    if (!dropped?.length) return;
    const filesToUpload = Array.from(dropped);
    setSelectedFiles(filesToUpload);
    void uploadSelected(filesToUpload);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadSelected = async (incoming?: File[]) => {
    setError(null);
    setUploading(true);
    let placeholderIds: string[] = [];
    try {
      const supabase = ensureSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setError("Not signed in");
        return;
      }

      const filesToProcess = incoming ?? selectedFiles;
      const isPrivateUpload = activeTab === "private";
      if (isPrivateUpload) {
        const hasUnsupportedFile = filesToProcess.some(
          (file) => !file.type.toLowerCase().startsWith("image/")
        );
        if (hasUnsupportedFile) {
          setError("Private uploads only support images.");
          return;
        }
      }
      const uploads: MediaRow[] = [];
      // create optimistic placeholders so users see upload activity in the grid
      const placeholders: MediaRow[] = filesToProcess.map((file) => ({
        id: crypto.randomUUID(),
        filename: file.name,
        storage_path: "",
        preview_storage_path: "",
        file_type: fileTypeFromMime(file.type || "application/octet-stream"),
        file_size: file.size,
        source: isPrivateUpload ? PRIVATE_MEDIA_SOURCE : "upload",
        created_at: new Date().toISOString(),
        status: "uploading",
      }));
      placeholderIds = placeholders.map((item) => item.id);
      updateVisibleRows((prev) => [...placeholders, ...prev]);
      setUploadCount(filesToProcess.length);
      for (let idx = 0; idx < filesToProcess.length; idx += 1) {
        const file = filesToProcess[idx];
        const placeholderId = placeholders[idx]?.id;
        const mimeType = file.type || "application/octet-stream";
        const typeFolder = fileTypeFromMime(mimeType) === "video" ? "videos" : "images";
        const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
        const storedName = `${crypto.randomUUID()}-${sanitizeFileName(file.name.replace(extension, ""))}${extension}`;
        const path = isPrivateUpload
          ? `${userId}/${PRIVATE_MEDIA_FOLDER}/images/${storedName}`
          : `${userId}/${typeFolder}/${storedName}`;

        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: false,
          contentType: mimeType,
        });
        if (uploadError) {
          throw uploadError;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("media_files")
          .insert({
            user_id: userId,
            filename: file.name,
            storage_path: path,
            file_type: fileTypeFromMime(mimeType),
            file_size: file.size,
            source: isPrivateUpload ? PRIVATE_MEDIA_SOURCE : "upload",
          })
          .select("*")
          .single();
        if (insertError) {
          throw insertError;
        }

        const previewStoragePath =
          resolveMediaSigningStoragePaths(inserted ?? { storage_path: path }, userId)[0] ?? path;
        const signedUrl = await signStoragePath(previewStoragePath, { forceRefresh: true });

        if (inserted?.id) {
          void logMediaEvent("upload", "media_file", inserted.id, {
            storage_path: path,
            file_type: fileTypeFromMime(mimeType),
            file_size: file.size,
            visibility: isPrivateUpload ? "private" : "standard",
          });
        }

        uploads.push({
          ...inserted,
          preview_storage_path: previewStoragePath,
          signedUrl: signedUrl ?? undefined,
          status: "ready",
        });

        // swap placeholder with real row
        updateVisibleRows((prev) =>
          prev.map((f) =>
            placeholderId && f.id === placeholderId ? { ...uploads[uploads.length - 1] } : f
          )
        );
      }

      if (uploads.length) {
        updateVisibleRows((prev) => {
          // filter out any placeholders not replaced
          const withoutDangling = prev.filter(
            (f) => f.status !== "uploading" || uploads.some((u) => u.id === f.id)
          );
          // ensure new uploads are present (already inserted via swap above)
          return withoutDangling;
        });
        markInactiveMediaCachesStale(activeMediaTab);
        void refreshStorageUsageBytes();
      }
      setSelectedFiles([]);
      setUploadCount(0);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Upload failed"));
      if (placeholderIds.length) {
        updateVisibleRows((prev) =>
          prev.filter((file) => !(file.status === "uploading" && placeholderIds.includes(file.id)))
        );
      }
    } finally {
      setUploading(false);
      setUploadCount(0);
    }
  };

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

  useEffect(() => {
    if (!activeMediaTab) return;
    if (activeMediaCache?.loading) return;
    if (mediaSignInFlightRef.current[activeMediaTab]) return;

    const readyRows = filteredMedia.filter((row) => row.status !== "uploading");
    if (!readyRows.length) return;

    const prioritizedRows: MediaRow[] = [];
    const seen = new Set<string>();
    const enqueue = (row?: MediaRow) => {
      if (!row) return;
      if (
        !resolveMediaSigningStoragePaths(row, currentUserIdRef.current).length ||
        row.signedUrl ||
        seen.has(row.id)
      )
        return;
      seen.add(row.id);
      prioritizedRows.push(row);
    };

    for (const row of readyRows.slice(0, signBudget.initialSignLimit)) {
      enqueue(row);
    }

    const visibleIndexes: number[] = [];
    for (let idx = 0; idx < readyRows.length; idx += 1) {
      if (visibleMediaIdsRef.current.has(readyRows[idx].id)) {
        visibleIndexes.push(idx);
      }
    }

    if (visibleIndexes.length) {
      const firstVisible = Math.min(...visibleIndexes);
      const lastVisible = Math.max(...visibleIndexes);
      const before = Math.floor(signBudget.prefetchWindow / 3);
      const start = Math.max(0, firstVisible - before);
      const end = Math.min(readyRows.length, lastVisible + 1 + signBudget.prefetchWindow);
      for (let idx = start; idx < end; idx += 1) {
        enqueue(readyRows[idx]);
      }
    } else {
      const fallbackEnd = Math.min(
        readyRows.length,
        signBudget.initialSignLimit + signBudget.prefetchWindow
      );
      for (let idx = signBudget.initialSignLimit; idx < fallbackEnd; idx += 1) {
        enqueue(readyRows[idx]);
      }
    }

    const signBatch = prioritizedRows.slice(0, signBudget.signBatchSize);
    if (!signBatch.length) return;

    const tabForBatch = activeMediaTab;
    const queryForBatch = activeMediaQueryRef.current;
    mediaSignInFlightRef.current[tabForBatch] = true;
    const finishSignBatch = createMediaPerfTimer({
      surface: "media-library-route",
      tab: tabForBatch,
      batch_size: signBatch.length,
      page_index: activeMediaCache?.pagesLoaded ?? 0,
      query_mode: queryForBatch ? "search" : "default",
    });

    const signCandidatesByRow = signBatch.map((row) => {
      const candidates = resolveMediaSigningStoragePaths(row, currentUserIdRef.current);
      return {
        id: row.id,
        primaryPath: candidates[0] ?? null,
        candidates,
        directUrls: resolveMediaDirectPreviewUrls(row),
      };
    });
    const signPaths = Array.from(new Set(signCandidatesByRow.flatMap((entry) => entry.candidates)));
    if (!signPaths.length) {
      mediaSignInFlightRef.current[tabForBatch] = false;
      return;
    }

    void getSignedMediaUrlsBatch({
      bucket: BUCKET,
      storagePaths: signPaths,
      expiresInSeconds: 3600,
    })
      .then((signedByPath) =>
        signCandidatesByRow.map((entry) => {
          const matchedPath =
            entry.candidates.find((path) => Boolean(signedByPath.get(path))) ?? null;
          const signedFromPath = matchedPath ? (signedByPath.get(matchedPath) ?? null) : null;
          const directUrl = signedFromPath ? null : (entry.directUrls[0] ?? null);
          const signedUrl = signedFromPath ?? directUrl;
          const usedFallback = Boolean(
            matchedPath && entry.primaryPath && matchedPath !== entry.primaryPath
          );
          return {
            id: entry.id,
            signedUrl,
            usedFallback,
            attemptedPaths: entry.candidates.slice(0, 4),
          };
        })
      )
      .then(async (results) => {
        if (activeTabRef.current !== tabForBatch) return;
        if (activeMediaQueryRef.current !== queryForBatch) return;
        const signedById = new Map<string, string>();
        for (const result of results) {
          if (result.signedUrl) {
            signAttemptRef.current[result.id] = 0;
            signedById.set(result.id, result.signedUrl);
          } else {
            signAttemptRef.current[result.id] = (signAttemptRef.current[result.id] ?? 0) + 1;
          }
        }
        applySignedUrlsToTab(tabForBatch, signedById);
        const unresolvedRows = signBatch.filter((row) => !signedById.has(row.id));
        const unresolvedAfterResolver = unresolvedRows.length
          ? await resolveSignedUrlsByMediaIds(tabForBatch, unresolvedRows)
          : new Set<string>();
        for (const unresolvedRow of unresolvedRows.slice(0, 4)) {
          if (!unresolvedAfterResolver.has(unresolvedRow.id)) continue;
          void hydrateViaStorageDownload(unresolvedRow);
        }
        const failedCount = results.length - signedById.size;
        const fallbackCount = results.reduce(
          (count, result) => (result.usedFallback ? count + 1 : count),
          0
        );
        finishSignBatch("media.sign.batch.completed", {
          signed_count: signedById.size,
          failed_count: failedCount,
          fallback_count: fallbackCount,
        });
        if (failedCount > 0) {
          if (process.env.NODE_ENV !== "production") {
            const unresolved = results
              .filter((result) => !result.signedUrl)
              .map((result) => ({
                id: result.id,
                paths: result.attemptedPaths,
              }))
              .slice(0, 8);
            if (unresolved.length) {
              console.warn("[media-library] unresolved preview rows", unresolved);
            }
          }
          logMediaPerf("media.sign.batch.failed", {
            surface: "media-library-route",
            tab: tabForBatch,
            batch_size: results.length,
            failed_count: failedCount,
            fallback_count: fallbackCount,
            page_index: activeMediaCache?.pagesLoaded ?? 0,
            query_mode: queryForBatch ? "search" : "default",
          });
        }
      })
      .finally(() => {
        mediaSignInFlightRef.current[tabForBatch] = false;
        if (isMountedRef.current) {
          setSignPassNonce((prev) => prev + 1);
        }
      });
  }, [
    activeMediaCache?.loading,
    activeMediaCache?.pagesLoaded,
    activeMediaTab,
    activeMediaQuery,
    applySignedUrlsToTab,
    filteredMedia,
    hydrateViaStorageDownload,
    resolveSignedUrlsByMediaIds,
    signBudget.initialSignLimit,
    signBudget.prefetchWindow,
    signBudget.signBatchSize,
    signPassNonce,
    signStoragePath,
    visibleMediaVersion,
  ]);

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

  const deletePrompt = async (
    row: PromptRow,
    options: {
      fromPromptModal?: boolean;
    } = {}
  ): Promise<boolean> => {
    setError(null);
    if (options.fromPromptModal) {
      setPromptModalError(null);
    }
    try {
      const supabase = ensureSupabaseClient();
      const { error: deleteError } = await supabase.from("media_prompts").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setPrompts((prev) => prev.filter((p) => p.id !== row.id));
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      setFocusedPrompt((prev) => (prev && prev.id === row.id ? null : prev));
      void logMediaEvent("delete", "media_prompt", row.id);
      return true;
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Unable to delete prompt");
      if (options.fromPromptModal) {
        setPromptModalError(message);
      } else {
        setError(message);
      }
      return false;
    }
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

  const focusedAspectRatio = useMemo(() => {
    if (!focusedFile) return 4 / 5;
    const ratio = aspectMap[focusedFile.id];
    if (Number.isFinite(ratio) && ratio > 0) return ratio;
    return isVideoFile(focusedFile.file_type) ? 9 / 16 : 4 / 5;
  }, [aspectMap, focusedFile]);
  const isFocusedImage = Boolean(focusedFile && !isVideoFile(focusedFile.file_type));

  const clampModalImagePan = useCallback(
    (nextX: number, nextY: number, scale: number) => {
      const vessel = modalPreviewRef.current;
      if (!vessel || !modalImageNaturalSize || scale <= 1) {
        return { x: 0, y: 0 };
      }
      const vesselWidth = vessel.clientWidth;
      const vesselHeight = vessel.clientHeight;
      if (!vesselWidth || !vesselHeight) return { x: 0, y: 0 };

      const naturalRatio = modalImageNaturalSize.width / modalImageNaturalSize.height;
      const vesselRatio = vesselWidth / vesselHeight;
      const fittedWidth = naturalRatio > vesselRatio ? vesselWidth : vesselHeight * naturalRatio;
      const fittedHeight = naturalRatio > vesselRatio ? vesselWidth / naturalRatio : vesselHeight;

      const zoomedWidth = fittedWidth * scale;
      const zoomedHeight = fittedHeight * scale;
      const maxPanX = Math.max(0, (zoomedWidth - vesselWidth) / 2);
      const maxPanY = Math.max(0, (zoomedHeight - vesselHeight) / 2);

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
      };
    },
    [modalImageNaturalSize]
  );

  const resetModalImageTransform = useCallback(() => {
    setModalImageZoomScale(1);
    setModalImageZoomActive(false);
    setModalImagePan({ x: 0, y: 0 });
    setIsModalImagePanning(false);
    modalImagePanDragRef.current = null;
    modalImageDraggedRef.current = false;
  }, []);

  const resetModalImageZoom = useCallback(() => {
    resetModalImageTransform();
    setModalImageNaturalSize(null);
  }, [resetModalImageTransform]);

  const applyModalZoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const vessel = modalPreviewRef.current;
      if (!vessel) return;
      const rect = vessel.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const clampedScale = Math.min(6, Math.max(1, nextScale));

      setModalImagePan((prev) => {
        if (clampedScale <= 1) return { x: 0, y: 0 };
        const currentScale = Math.max(0.0001, modalImageZoomScale);
        const localX = pointerX - centerX;
        const localY = pointerY - centerY;
        const sourceX = (localX - prev.x) / currentScale;
        const sourceY = (localY - prev.y) / currentScale;
        const nextX = localX - sourceX * clampedScale;
        const nextY = localY - sourceY * clampedScale;
        return clampModalImagePan(nextX, nextY, clampedScale);
      });
      setModalImageZoomScale(clampedScale);
    },
    [clampModalImagePan, modalImageZoomScale]
  );

  const handleModalImageClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (!isFocusedImage) return;
      if (modalImageDraggedRef.current) {
        modalImageDraggedRef.current = false;
        return;
      }
      if (modalImageZoomActive) {
        resetModalImageTransform();
        return;
      }
      setModalImageZoomActive(true);
      applyModalZoomAtPoint(event.clientX, event.clientY, 2);
    },
    [applyModalZoomAtPoint, isFocusedImage, modalImageZoomActive, resetModalImageTransform]
  );

  const handleModalImageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLImageElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (modalImageZoomActive) {
          resetModalImageTransform();
          return;
        }
        setModalImageZoomActive(true);
        const vessel = modalPreviewRef.current;
        if (!vessel) {
          setModalImageZoomScale(2);
          return;
        }
        const rect = vessel.getBoundingClientRect();
        applyModalZoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 2);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        resetModalImageTransform();
      }
    },
    [applyModalZoomAtPoint, modalImageZoomActive, resetModalImageTransform]
  );

  const handleModalImageWheel = useCallback(
    (event: React.WheelEvent<HTMLImageElement>) => {
      if (!isFocusedImage || !modalImageZoomActive) return;
      event.preventDefault();
      event.stopPropagation();

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = Math.min(6, Math.max(1, modalImageZoomScale * zoomFactor));
      if (Math.abs(nextScale - modalImageZoomScale) < 0.0001) return;
      applyModalZoomAtPoint(event.clientX, event.clientY, nextScale);
    },
    [applyModalZoomAtPoint, isFocusedImage, modalImageZoomActive, modalImageZoomScale]
  );

  const handleModalPreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isFocusedImage || !modalImageZoomActive) return;
      event.preventDefault();
      event.stopPropagation();
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = Math.min(6, Math.max(1, modalImageZoomScale * zoomFactor));
      if (Math.abs(nextScale - modalImageZoomScale) < 0.0001) return;
      applyModalZoomAtPoint(event.clientX, event.clientY, nextScale);
    },
    [applyModalZoomAtPoint, isFocusedImage, modalImageZoomActive, modalImageZoomScale]
  );

  const handleModalImagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (!isFocusedImage || !modalImageZoomActive || modalImageZoomScale <= 1) return;
      if (event.button !== 0) return;
      modalImagePanDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: modalImagePan.x,
        startPanY: modalImagePan.y,
      };
      modalImageDraggedRef.current = false;
      setIsModalImagePanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [isFocusedImage, modalImagePan.x, modalImagePan.y, modalImageZoomActive, modalImageZoomScale]
  );

  const handleModalImagePointerMove = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      const dragState = modalImagePanDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        modalImageDraggedRef.current = true;
      }
      setModalImagePan(
        clampModalImagePan(
          dragState.startPanX + deltaX,
          dragState.startPanY + deltaY,
          modalImageZoomScale
        )
      );
    },
    [clampModalImagePan, modalImageZoomScale]
  );

  const handleModalImagePointerUp = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    const dragState = modalImagePanDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    modalImagePanDragRef.current = null;
    setIsModalImagePanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

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

  const requestDeleteFile = (file: MediaRow) => {
    if (file.status === "uploading") return;
    setDeleteTarget(file);
    setError(null);
  };

  const cancelDeleteFile = () => {
    if (deletingSingle) return;
    setDeleteTarget(null);
  };

  const confirmDeleteFile = async () => {
    if (!deleteTarget) return;
    setDeletingSingle(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const deletePaths = await collectMediaStoragePathsForDelete([deleteTarget]);
      await removeStoragePaths(deletePaths);
      const { error: deleteError } = await supabase
        .from("media_files")
        .delete()
        .eq("id", deleteTarget.id);
      if (deleteError) throw deleteError;
      updateVisibleRows((prev) => prev.filter((file) => file.id !== deleteTarget.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      setFocusedFile((prev) => (prev && prev.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      markInactiveMediaCachesStale(activeMediaTab);
      void refreshStorageUsageBytes();
      void logMediaEvent("delete", "media_file", deleteTarget.id, {
        storage_path: deleteTarget.storage_path,
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete file"));
    } finally {
      setDeletingSingle(false);
    }
  };

  const applyMovedFilesToCaches = useCallback(
    (movedFiles: MediaRow[], destinationTab: MediaDataTab) => {
      if (!movedFiles.length) return;
      const movedById = new Map(movedFiles.map((file) => [file.id, file]));
      setMediaTabCache((prev) => {
        const next = { ...prev };
        for (const tab of MEDIA_DATA_TABS) {
          const cache = prev[tab];
          const rowsWithoutMoved = cache.rows.filter((row) => !movedById.has(row.id));
          let nextRows = rowsWithoutMoved;
          if (tab === destinationTab) {
            const query = normalizeMediaSearchTerm(cache.query).toLowerCase();
            const queryMatchedRows = movedFiles.filter((file) => {
              const filename = file.filename?.toLowerCase() ?? "";
              const path = file.storage_path?.toLowerCase() ?? "";
              return !query || filename.includes(query) || path.includes(query);
            });
            if (queryMatchedRows.length) {
              nextRows = mergePageRows(rowsWithoutMoved, queryMatchedRows);
            }
          }
          next[tab] = {
            ...cache,
            rows: nextRows,
            loadedAtMs: tab === destinationTab ? Date.now() : null,
          };
        }
        return next;
      });
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
    [applyMovedFileToCaches, focusedFile, movingFile, requestMoveFileToTab]
  );

  const moveTabOptions = useMemo(
    () => (focusedFile ? buildMoveTabOptions(focusedFile) : []),
    [focusedFile]
  );
  const modalMoveTabOptions = useMemo(() => {
    if (!focusedFile) return [];
    const dataOptions = moveTabOptions.filter(isDataMoveOption);
    if (!isVideoFile(focusedFile.file_type)) {
      return dataOptions.filter(isEnabledDataMoveOption);
    }

    const currentTab = getMediaDataTabForRow(focusedFile);
    const optionByTab = new Map(dataOptions.map((option) => [option.tab, option]));

    return VIDEO_MODAL_MOVE_TAB_ORDER.map((tab) => {
      if (tab === currentTab) {
        return {
          tab,
          label: getMoveTabLabel(tab),
          disabled: true,
          reason: "Current tab",
        };
      }
      return (
        optionByTab.get(tab) ?? {
          tab,
          label: getMoveTabLabel(tab),
          disabled: true,
          reason: "Unavailable",
        }
      );
    });
  }, [focusedFile, moveTabOptions]);
  const canMoveToAnotherTab = useMemo(
    () => modalMoveTabOptions.some((option) => !option.disabled),
    [modalMoveTabOptions]
  );

  const selectedMediaRows = useMemo(() => {
    if (activeMediaTab == null || !selectedIds.length) return [];
    const selectedIdSet = new Set(selectedIds);
    return files.filter(
      (file) =>
        selectedIdSet.has(file.id) &&
        file.status !== "uploading" &&
        getMediaDataTabForRow(file) === activeMediaTab
    );
  }, [activeMediaTab, files, selectedIds]);

  const bulkMoveTabOptions = useMemo(
    () => buildBulkMoveTabOptions(selectedMediaRows),
    [selectedMediaRows]
  );

  const canBulkMove = useMemo(
    () => bulkMoveTabOptions.some((option) => !option.disabled),
    [bulkMoveTabOptions]
  );

  const moveSelectedFiles = useCallback(
    async (destinationTab: MediaDataTab) => {
      if (!selectedMediaRows.length || bulkMoving || bulkDeleting) return;
      const selectedCount = selectedMediaRows.length;
      const destinationOption = bulkMoveTabOptions.find((option) => option.tab === destinationTab);
      if (!destinationOption || destinationOption.disabled) return;
      const finishBulkMove = createMediaPerfTimer({
        surface: "media-library-route",
        tab: activeTabRef.current,
        destination_tab: destinationTab,
        selected_count: selectedCount,
      });

      setBulkMoving(true);
      setBulkMoveError(null);
      setBulkMoveNotice(null);
      setBulkMoveMenuOpen(false);
      setError(null);
      try {
        const selectedById = new Map(selectedMediaRows.map((row) => [row.id, row]));
        const response = await fetchWithAuth("/api/media/move-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileIds: selectedMediaRows.map((row) => row.id),
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
            payload?.details ??
              payload?.error ??
              `Unable to move selected files (${response.status})`
          );
        }
        const payload = (await response.json()) as MoveMediaBatchResponse;

        for (const movedItem of payload.moved) {
          const previousRow = selectedById.get(movedItem.fileId);
          const previousSignPaths = previousRow
            ? resolveMediaSigningStoragePaths(previousRow, currentUserIdRef.current)
            : [];
          const pathsToInvalidate = new Set([...previousSignPaths, movedItem.previousStoragePath]);
          for (const path of pathsToInvalidate) {
            if (!path) continue;
            invalidateSignedMediaUrl(BUCKET, path);
          }
        }

        const movedRowsRaw = payload.moved.map((item) => item.file);
        const previewPathById = new Map<string, string>();
        const previewPaths: string[] = [];
        for (const row of movedRowsRaw) {
          const previewPath =
            resolveMediaSigningStoragePaths(row, currentUserIdRef.current)[0] ?? row.storage_path;
          previewPathById.set(row.id, previewPath);
          previewPaths.push(previewPath);
        }

        const signedByPath = await getSignedMediaUrlsBatch({
          bucket: BUCKET,
          storagePaths: previewPaths,
          expiresInSeconds: 3600,
          forceRefresh: true,
        });

        const movedRows: MediaRow[] = movedRowsRaw.map((row) => {
          const previewPath = previewPathById.get(row.id) ?? row.storage_path;
          const signedUrl = signedByPath.get(previewPath);
          return {
            ...row,
            preview_storage_path: previewPath,
            signedUrl: signedUrl ?? undefined,
            status: "ready",
          };
        });

        const moveFailures = payload.failed.map((failure) => {
          const filename = selectedById.get(failure.fileId)?.filename?.trim() || "Unnamed file";
          return `${filename}: ${failure.details ?? failure.error}`;
        });

        const movedIdSet = new Set(movedRows.map((row) => row.id));
        if (movedRows.length) {
          applyMovedFilesToCaches(movedRows, destinationTab);
          setFiles((prev) => {
            const rowsWithoutMoved = prev.filter((row) => !movedIdSet.has(row.id));
            if (activeTabRef.current !== destinationTab) return rowsWithoutMoved;
            return mergePageRows(rowsWithoutMoved, movedRows).filter(
              (row) => getMediaDataTabForRow(row) === destinationTab
            );
          });
          setSelectedIds((prev) => prev.filter((id) => !movedIdSet.has(id)));
          setFocusedFile((prev) => {
            if (!prev || !movedIdSet.has(prev.id)) return prev;
            return movedRows.find((row) => row.id === prev.id) ?? prev;
          });
        }

        const destinationLabel = getMoveTabLabel(destinationTab);
        const feedback = buildBulkMoveFeedback({
          movedCount: movedRows.length,
          requestedCount: selectedCount,
          failedCount: moveFailures.length,
          destinationLabel,
          firstFailureMessage: moveFailures[0] ?? null,
        });

        setBulkMoveNotice(feedback.notice);
        setBulkMoveError(feedback.error);
        if (
          movedRows.length &&
          feedback.shouldSwitchTab &&
          activeTabRef.current !== destinationTab
        ) {
          setActiveTab(destinationTab);
        }

        finishBulkMove("media.move.bulk.completed", {
          moved_count: movedRows.length,
          failed_count: moveFailures.length,
        });
        if (moveFailures.length) {
          logMediaPerf("media.move.bulk.failed", {
            surface: "media-library-route",
            tab: activeTabRef.current,
            destination_tab: destinationTab,
            selected_count: selectedCount,
            moved_count: movedRows.length,
            failed_count: moveFailures.length,
          });
        }
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Unable to move selected files");
        setBulkMoveError(message);
        setBulkMoveNotice(null);
        finishBulkMove("media.move.bulk.failed", {
          moved_count: 0,
          failed_count: selectedCount,
          error_kind: "request_failed",
        });
        logMediaPerf("media.move.bulk.failed", {
          surface: "media-library-route",
          tab: activeTabRef.current,
          destination_tab: destinationTab,
          selected_count: selectedCount,
          moved_count: 0,
          failed_count: selectedCount,
        });
      } finally {
        setBulkMoving(false);
      }
    },
    [applyMovedFilesToCaches, bulkDeleting, bulkMoveTabOptions, bulkMoving, selectedMediaRows]
  );

  const openModal = (file: MediaRow) => {
    setFocusedFile(file);
    setRenameValue(file.filename);
    setModalError(null);
    setMoveError(null);
    setMoveMenuOpen(false);
    resetModalImageZoom();
  };

  const closeModal = () => {
    setFocusedFile(null);
    setRenameValue("");
    setModalError(null);
    setMoveError(null);
    setMoveMenuOpen(false);
    setRenameSuccess(false);
    resetModalImageZoom();
  };

  const saveRename = async () => {
    if (!focusedFile) return;
    setSavingRename(true);
    setModalError(null);
    setRenameSuccess(false);
    try {
      const previousName = focusedFile.filename;
      const supabase = ensureSupabaseClient();
      const { error } = await supabase
        .from("media_files")
        .update({ filename: renameValue.trim() })
        .eq("id", focusedFile.id);
      if (error) throw error;
      updateVisibleRows((prev) =>
        prev.map((f) => (f.id === focusedFile.id ? { ...f, filename: renameValue.trim() } : f))
      );
      setFocusedFile((prev) => (prev ? { ...prev, filename: renameValue.trim() } : prev));
      markInactiveMediaCachesStale(activeMediaTab);
      setRenameSuccess(true);
      setTimeout(() => setRenameSuccess(false), 1800);
      void logMediaEvent("rename", "media_file", focusedFile.id, {
        from: previousName,
        to: renameValue.trim(),
      });
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Unable to rename file"));
    } finally {
      setSavingRename(false);
    }
  };

  const openPromptModal = (prompt: PromptRow) => {
    setFocusedPrompt(prompt);
    setPromptEditValue(prompt.prompt_text ?? "");
    setPromptModalError(null);
    setPromptSaveSuccess(false);
  };

  const closePromptModal = () => {
    if (savingPromptEdit) return;
    setFocusedPrompt(null);
    setPromptEditValue("");
    setPromptModalError(null);
    setPromptSaveSuccess(false);
  };

  const savePromptEdits = async () => {
    if (!focusedPrompt || !promptEditValue.trim()) return;
    setSavingPromptEdit(true);
    setPromptModalError(null);
    setPromptSaveSuccess(false);
    try {
      const supabase = ensureSupabaseClient();
      const nextPromptText = promptEditValue;
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from("media_prompts")
        .update({ prompt_text: nextPromptText })
        .eq("id", focusedPrompt.id);
      if (error) throw error;
      setPrompts((prev) =>
        prev.map((prompt) =>
          prompt.id === focusedPrompt.id
            ? {
                ...prompt,
                prompt_text: nextPromptText,
                updated_at: updatedAt,
              }
            : prompt
        )
      );
      setFocusedPrompt((prev) =>
        prev
          ? {
              ...prev,
              prompt_text: nextPromptText,
              updated_at: updatedAt,
            }
          : prev
      );
      setPromptSaveSuccess(true);
      window.setTimeout(() => {
        setPromptSaveSuccess(false);
      }, 1600);
      void logMediaEvent("edit", "media_prompt", focusedPrompt.id, {
        updated_fields: ["prompt_text"],
      });
    } catch (err: unknown) {
      setPromptModalError(getErrorMessage(err, "Unable to save prompt edits"));
    } finally {
      setSavingPromptEdit(false);
    }
  };

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
                            disabled={option.disabled || !isMoveDataTab(option.tab) || bulkMoving}
                            onClick={() => {
                              if (option.disabled || !isMoveDataTab(option.tab)) return;
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
                          setModalImageNaturalSize({
                            width: image.naturalWidth,
                            height: image.naturalHeight,
                          });
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
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setRenameSuccess(false);
                  }}
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
                setPromptEditValue(event.target.value);
                setPromptSaveSuccess(false);
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
