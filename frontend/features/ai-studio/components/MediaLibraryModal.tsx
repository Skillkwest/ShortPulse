/**
 * Media library selector modal for AI Studio.
 * Loads user media/prompts and lets creators add them to the reference grid.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  CloudArrowDown,
  ImageSquare,
  LockSimple,
  MagnifyingGlass,
  VideoCamera,
  X,
} from "phosphor-react";
import { createMediaPerfTimer, logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import { getSignedMediaUrl, getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

type MediaFileRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: string;
  source?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  signedUrl?: string | null;
};

type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode?: string | null;
  model_id?: string | null;
  source?: string | null;
  created_at?: string | null;
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
  rows: MediaFileRow[];
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
type MediaCardRefCallback = (node: HTMLButtonElement | null) => void;
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

type MediaLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    filename?: string | null;
    source?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
};

const BUCKET = "media_library";
const PRIVATE_MEDIA_SOURCE = "private_upload";
const PRIVATE_MEDIA_FOLDER = "private";
const MEDIA_MODAL_PAGE_SIZE = 36;
const MEDIA_MODAL_CACHE_TTL_MS = 20_000;
const MEDIA_MODAL_SIGN_SMALL_SCREEN_QUERY = "(max-width: 900px)";
const MEDIA_MODAL_SIGN_BUDGET_DESKTOP: MediaSignBudget = {
  initialSignLimit: 10,
  prefetchWindow: 18,
  signBatchSize: 8,
};
const MEDIA_MODAL_SIGN_BUDGET_SMALL_SCREEN: MediaSignBudget = {
  initialSignLimit: 6,
  prefetchWindow: 12,
  signBatchSize: 5,
};
const MEDIA_MODAL_SIGN_BUDGET_CONSTRAINED: MediaSignBudget = {
  initialSignLimit: 4,
  prefetchWindow: 8,
  signBatchSize: 3,
};

const resolveModalSignBudget = (): MediaSignBudget => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return MEDIA_MODAL_SIGN_BUDGET_DESKTOP;
  }
  const nav = navigator as NavigatorWithConnection;
  const isSmallScreen = window.matchMedia(MEDIA_MODAL_SIGN_SMALL_SCREEN_QUERY).matches;
  const saveData = nav.connection?.saveData === true;
  const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
  const isSlowNetwork = effectiveType.includes("2g");
  const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  if (saveData || isSlowNetwork || isLowMemory) {
    return MEDIA_MODAL_SIGN_BUDGET_CONSTRAINED;
  }
  if (isSmallScreen) {
    return MEDIA_MODAL_SIGN_BUDGET_SMALL_SCREEN;
  }
  return MEDIA_MODAL_SIGN_BUDGET_DESKTOP;
};

const isVideoFile = (fileType?: string | null) =>
  (fileType ?? "").toLowerCase().startsWith("video");
const isPrivateStoragePath = (storagePath?: string | null) =>
  (storagePath ?? "").split("/").filter(Boolean).includes(PRIVATE_MEDIA_FOLDER);
const isPrivateMediaFile = (file: Pick<MediaFileRow, "source" | "storage_path">) =>
  (file.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(file.storage_path);

const isMediaDataTab = (tab: MediaTab): tab is MediaDataTab => tab !== "saved_prompts";

const getMediaDataTabForRow = (
  row: Pick<MediaFileRow, "source" | "storage_path" | "file_type">
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
    or: (clause: string) => T;
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

const mergePageRows = (current: MediaFileRow[], incoming: MediaFileRow[]): MediaFileRow[] => {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
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
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
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
    async (tab: MediaDataTab, rows: MediaFileRow[]): Promise<Set<string>> => {
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
    async (file: MediaFileRow): Promise<string | null> => {
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
    (file: MediaFileRow) => {
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
      logMediaPerf("media.modal.first_media_paint", {
        surface: "media-library-modal",
        tab: activeTab,
        asset_kind: assetKind,
      });
    },
    [activeTab]
  );

  const fetchMediaTabPage = useCallback(
    async (tab: MediaDataTab, options?: { reset?: boolean; query?: string }) => {
      if (!isOpen) return;
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
        if (!userId) throw new Error("Not signed in.");
        currentUserIdRef.current = userId;

        const selectColumns =
          "id, filename, storage_path, file_type, source, created_at, metadata, thumb_variant_path, poster_variant_path, preview_variant_path";
        const buildBaseQuery = () => {
          let query = supabase.from("media_files").select(selectColumns).eq("user_id", userId);
          query = withMediaTabFilter(query, tab);
          query = withMediaSearchFilter(query, normalizedQuery);
          return query.order("created_at", { ascending: false }).order("id", { ascending: false });
        };

        const fetchedRows: MediaFileRow[] = [];
        if (!cursor) {
          const firstPageResponse = await buildBaseQuery().limit(MEDIA_MODAL_PAGE_SIZE);
          if (firstPageResponse.error) throw firstPageResponse.error;
          fetchedRows.push(...((firstPageResponse.data ?? []) as MediaFileRow[]));
        } else {
          const sameTimestampResponse = await buildBaseQuery()
            .eq("created_at", cursor.createdAt)
            .lt("id", cursor.id)
            .limit(MEDIA_MODAL_PAGE_SIZE);
          if (sameTimestampResponse.error) throw sameTimestampResponse.error;
          const sameTimestampRows = (sameTimestampResponse.data ?? []) as MediaFileRow[];
          fetchedRows.push(...sameTimestampRows);

          const remaining = MEDIA_MODAL_PAGE_SIZE - sameTimestampRows.length;
          if (remaining > 0) {
            const olderRowsResponse = await buildBaseQuery()
              .lt("created_at", cursor.createdAt)
              .limit(remaining);
            if (olderRowsResponse.error) throw olderRowsResponse.error;
            fetchedRows.push(...((olderRowsResponse.data ?? []) as MediaFileRow[]));
          }
        }
        if (isStaleRequest()) return;

        const rows = mergePageRows([], fetchedRows).slice(0, MEDIA_MODAL_PAGE_SIZE);
        const existingById = new Map(cache.rows.map((row) => [row.id, row]));
        const normalizedRows = rows.map((row) => {
          const previewStoragePath =
            resolveMediaSigningStoragePaths(row, userId)[0] ?? row.storage_path;
          const cachedRow = existingById.get(row.id);
          return {
            ...row,
            source: row.source ?? "upload",
            preview_storage_path: previewStoragePath,
            signedUrl: cachedRow?.signedUrl ?? null,
          } as MediaFileRow;
        });

        const derivedCursor = buildCursorFromRows(rows);
        const hasMore = rows.length === MEDIA_MODAL_PAGE_SIZE && Boolean(derivedCursor);
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
        if (isOpenRef.current && activeTabRef.current === tab) {
          setFiles(nextRows);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isStaleRequest()) return;
        const message = getErrorMessage(err, "Unable to load media library.");
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
        if (isOpenRef.current && activeTabRef.current === tab) {
          setError(message);
          setLoading(false);
        }
      }
    },
    [isOpen, mediaTabCache]
  );

  const loadPrompts = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("Not signed in.");
      const promptResponse = await supabase
        .from("media_prompts")
        .select("id, title, prompt_text, mode, model_id, source, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (promptResponse.error) throw promptResponse.error;
      setPrompts((promptResponse.data ?? []) as PromptRow[]);
      setPromptsLoaded(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load media library."));
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
      cache.loadedAtMs == null || Date.now() - cache.loadedAtMs > MEDIA_MODAL_CACHE_TTL_MS;
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
  }, [
    activeMediaQuery,
    activeTab,
    fetchMediaTabPage,
    isOpen,
    loadPrompts,
    mediaTabCache,
    promptsLoaded,
  ]);

  useEffect(() => {
    if (!isOpen || !activeMediaTab) return;
    if (!activeMediaCache?.loaded || activeMediaCache.loading || !activeMediaCache.hasMore) return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        void fetchMediaTabPage(activeMediaTab, { query: activeMediaQuery });
      },
      { rootMargin: "500px 0px" }
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
    isOpen,
  ]);

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
    if (!isOpen || !activeMediaTab) return;
    if (!activeMediaCache?.loaded) return;
    setMediaTabCache((prev) => ({
      ...prev,
      [activeMediaTab]: {
        ...prev[activeMediaTab],
        rows: files.filter((row) => getMediaDataTabForRow(row) === activeMediaTab),
      },
    }));
  }, [activeMediaCache?.loaded, activeMediaTab, files, isOpen]);

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

  useEffect(() => {
    if (!isOpen || !activeMediaTab) return;
    if (activeMediaCache?.loading) return;
    if (mediaSignInFlightRef.current[activeMediaTab]) return;

    const prioritizedRows: MediaFileRow[] = [];
    const seen = new Set<string>();
    const enqueue = (row?: MediaFileRow) => {
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

    for (const row of activeMedia.slice(0, signBudget.initialSignLimit)) {
      enqueue(row);
    }

    const visibleIndexes: number[] = [];
    for (let idx = 0; idx < activeMedia.length; idx += 1) {
      if (visibleMediaIdsRef.current.has(activeMedia[idx].id)) {
        visibleIndexes.push(idx);
      }
    }

    if (visibleIndexes.length) {
      const firstVisible = Math.min(...visibleIndexes);
      const lastVisible = Math.max(...visibleIndexes);
      const before = Math.floor(signBudget.prefetchWindow / 3);
      const start = Math.max(0, firstVisible - before);
      const end = Math.min(activeMedia.length, lastVisible + 1 + signBudget.prefetchWindow);
      for (let idx = start; idx < end; idx += 1) {
        enqueue(activeMedia[idx]);
      }
    } else {
      const fallbackEnd = Math.min(
        activeMedia.length,
        signBudget.initialSignLimit + signBudget.prefetchWindow
      );
      for (let idx = signBudget.initialSignLimit; idx < fallbackEnd; idx += 1) {
        enqueue(activeMedia[idx]);
      }
    }

    const signBatch = prioritizedRows.slice(0, signBudget.signBatchSize);
    if (!signBatch.length) return;

    const tabForBatch = activeMediaTab;
    const queryForBatch = activeMediaQueryRef.current;
    mediaSignInFlightRef.current[tabForBatch] = true;
    const finishSignBatch = createMediaPerfTimer({
      surface: "media-library-modal",
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
        if (!isOpenRef.current || activeTabRef.current !== tabForBatch) return;
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
              console.warn("[media-library-modal] unresolved preview rows", unresolved);
            }
          }
          logMediaPerf("media.sign.batch.failed", {
            surface: "media-library-modal",
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
    activeMedia,
    activeMediaCache?.loading,
    activeMediaCache?.pagesLoaded,
    activeMediaTab,
    applySignedUrlsToTab,
    hydrateViaStorageDownload,
    isOpen,
    resolveSignedUrlsByMediaIds,
    signBudget.initialSignLimit,
    signBudget.prefetchWindow,
    signBudget.signBatchSize,
    signPassNonce,
    signStoragePath,
    visibleMediaVersion,
  ]);

  const loadingMoreMedia = Boolean(activeMediaCache?.loaded && activeMediaCache?.loading);
  const hasMoreMediaPages = Boolean(activeMediaCache?.hasMore);
  const isMediaTab = activeTab !== "saved_prompts";

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
        <div className="media-library-modal-header">
          <div>
            <p className="eyebrow">Media Library</p>
            <p className="tiny subdued helper-text">
              Select media or prompts to add to the reference grid.
            </p>
          </div>
          <button
            type="button"
            className="art-close-btn"
            onClick={onClose}
            aria-label="Close media library"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="media-library-modal-tabs" role="tablist" aria-label="Media library tabs">
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "uploaded_images" ? "is-active" : ""}`}
            aria-selected={activeTab === "uploaded_images"}
            onClick={() => setActiveTab("uploaded_images")}
          >
            <ImageSquare size={14} weight="bold" aria-hidden />
            Uploaded Images
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "uploaded_videos" ? "is-active" : ""}`}
            aria-selected={activeTab === "uploaded_videos"}
            onClick={() => setActiveTab("uploaded_videos")}
          >
            <VideoCamera size={14} weight="bold" aria-hidden />
            Uploaded Videos
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "saved_prompts" ? "is-active" : ""}`}
            aria-selected={activeTab === "saved_prompts"}
            onClick={() => setActiveTab("saved_prompts")}
          >
            <CloudArrowDown size={14} weight="bold" aria-hidden />
            Saved Prompts
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "ai_generations" ? "is-active" : ""}`}
            aria-selected={activeTab === "ai_generations"}
            onClick={() => setActiveTab("ai_generations")}
          >
            <CloudArrowDown size={14} weight="bold" aria-hidden />
            AI Studio Generations
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "private" ? "is-active" : ""}`}
            aria-selected={activeTab === "private"}
            onClick={() => setActiveTab("private")}
          >
            <LockSimple size={14} weight="bold" aria-hidden />
            Private
          </button>
        </div>

        <div className="media-library-modal-search">
          <div className="search-input">
            <MagnifyingGlass size={15} weight="bold" aria-hidden />
            <input
              type="text"
              placeholder={isMediaTab ? "Search media by name or file" : "Search saved prompts"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="media-library-modal-body">
          {loading ? <p className="tiny subdued">Loading media library…</p> : null}
          {error ? <p className="tiny subdued">{error}</p> : null}

          {!loading && !error && activeTab === "saved_prompts" ? (
            <div className="prompt-grid media-library-prompt-grid">
              {prompts.length === 0 ? (
                <p className="tiny subdued">No saved prompts yet.</p>
              ) : (
                sortedPrompts.map((prompt) => {
                  const isSelected = selectedIds.has(prompt.id);
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      className={`prompt-card media-library-prompt-card${isSelected ? " is-selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => {
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
                      }}
                    >
                      {isSelected ? (
                        <span className="media-library-select-indicator" aria-hidden>
                          <CheckCircle size={16} weight="fill" />
                        </span>
                      ) : null}
                      <div className="prompt-card-header">
                        <div>
                          <p className="metric-label">{prompt.title || "Saved prompt"}</p>
                          <p className="metric-value tiny">{formatDate(prompt.created_at)}</p>
                        </div>
                        <span className="pill tiny">Prompt</span>
                      </div>
                      <p className="prompt-card-body">{prompt.prompt_text}</p>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          {!loading && !error && isMediaTab ? (
            <>
              <div className="media-grid media-library-modal-grid media-library-modal-grid-packed">
                {activeMedia.length === 0 ? (
                  <p className="tiny subdued">No media found for this tab.</p>
                ) : (
                  activeMedia.map((file) => {
                    const isSelected = selectedIds.has(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        className={`media-card media-library-modal-card${isSelected ? " is-selected" : ""}`}
                        ref={getMediaCardRef(file.id)}
                        aria-pressed={isSelected}
                        onClick={async () => {
                          const nextUrl = (await refreshSignedUrl(file)) ?? file.signedUrl;
                          if (!nextUrl) return;
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
                            source: file.source ?? "upload",
                          });
                        }}
                      >
                        {isSelected ? (
                          <span className="media-library-select-indicator" aria-hidden>
                            <CheckCircle size={16} weight="fill" />
                          </span>
                        ) : null}
                        {file.signedUrl ? (
                          isVideoFile(file.file_type) ? (
                            <video
                              className="media-thumb"
                              src={file.signedUrl}
                              muted
                              playsInline
                              loop
                              autoPlay
                              preload="metadata"
                              onLoadedData={() => {
                                signedUrlRetryRef.current[file.id] = 0;
                                markFirstMediaPaint("video");
                              }}
                              onError={() => handleMediaPreviewError(file)}
                            />
                          ) : (
                            <>
                              {/* Signed URLs are generated dynamically at runtime. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                className="media-thumb"
                                src={file.signedUrl}
                                alt={file.filename}
                                onLoad={() => {
                                  signedUrlRetryRef.current[file.id] = 0;
                                  markFirstMediaPaint("image");
                                }}
                                onError={() => handleMediaPreviewError(file)}
                              />
                            </>
                          )
                        ) : (
                          <div className="media-thumb placeholder" aria-hidden />
                        )}
                      </button>
                    );
                  })
                )}
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
