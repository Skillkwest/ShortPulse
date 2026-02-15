/**
 * Media Library preview runtime hook.
 * Owns tab/query refs, preview signing fallbacks, and viewport visibility tracking for media cards.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { MediaTab } from "../logic/mediaMoveRouting";
import {
  BUCKET,
  createMediaTabBooleanState,
  createMediaTabRequestState,
  getMediaDataTabForRow,
  resolveRouteSignBudget,
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
  type MediaTabCache,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";

type PreviewRuntimeRowBase = {
  id: string;
  storage_path: string;
  file_type: "image" | "video" | string;
  source?: "upload" | "ai_studio" | string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  signedUrl?: string;
};

type MediaCardRefCallback = (node: HTMLDivElement | null) => void;

type UseMediaPreviewRuntimeArgs<TRow extends PreviewRuntimeRowBase> = {
  activeMediaQuery: string;
  activeTab: MediaTab;
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
    options?: { forceRefresh?: boolean }
  ) => Promise<string | null>;
  signedUrlRetryRef: MutableRefObject<Record<string, number>>;
  visibleMediaIdsRef: MutableRefObject<Set<string>>;
  visibleMediaVersion: number;
};

type NavigatorWithConnection = Navigator & {
  connection?: {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

/**
 * Provides preview runtime refs and handlers for Media Library page orchestration.
 * Inputs: active tab/query + state setters for files/focus/cache.
 * Output: refs and callbacks used by tab data, signing pass, and gallery rendering.
 * Side effects: manages IntersectionObserver lifecycle, object URL cleanup, and preview signing retries.
 */
export const useMediaPreviewRuntime = <TRow extends PreviewRuntimeRowBase>({
  activeMediaQuery,
  activeTab,
  setFiles,
  setFocusedFile,
  setMediaTabCache,
}: UseMediaPreviewRuntimeArgs<TRow>): UseMediaPreviewRuntimeResult<TRow> => {
  const activeTabRef = useRef<MediaTab>(activeTab);
  const activeMediaQueryRef = useRef(activeMediaQuery);
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const mediaTabRequestRef = useRef<MediaTabRequestState>(createMediaTabRequestState());
  const mediaSignInFlightRef = useRef<MediaTabBooleanState>(createMediaTabBooleanState());
  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const signAttemptRef = useRef<Record<string, number>>({});
  const downloadFallbackInFlightRef = useRef<Record<string, boolean>>({});
  const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
  const firstMediaPaintLoggedRef = useRef(false);
  const mediaCardNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const mediaCardRefCallbacksRef = useRef<Record<string, MediaCardRefCallback>>({});
  const mediaCardObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleMediaIdsRef = useRef<Set<string>>(new Set());
  const [visibleMediaVersion, setVisibleMediaVersion] = useState(0);
  const [signPassNonce, setSignPassNonce] = useState(0);
  const [signBudget, setSignBudget] = useState<MediaSignBudget>(resolveRouteSignBudget);

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
  }, [activeMediaQuery, activeTab]);

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
    if (typeof IntersectionObserver === "undefined") return;
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
    [setFiles, setFocusedFile, setMediaTabCache]
  );

  const setObjectUrlForMediaRow = useCallback(
    (row: TRow, objectUrl: string) => {
      const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
      if (previousObjectUrl && previousObjectUrl !== objectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }
      objectUrlByMediaIdRef.current[row.id] = objectUrl;
      applySignedUrlsToTab(getMediaDataTabForRow(row), new Map([[row.id, objectUrl]]));
    },
    [applySignedUrlsToTab]
  );

  const hydrateViaStorageDownload = useCallback(
    async (row: TRow): Promise<string | null> => {
      if (downloadFallbackInFlightRef.current[row.id]) return null;
      downloadFallbackInFlightRef.current[row.id] = true;
      try {
        const supabase = ensureSupabaseClient();
        const storageCandidates = resolveMediaSigningStoragePaths(row, currentUserIdRef.current);
        for (const storagePath of storageCandidates) {
          const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
          if (error || !data) continue;
          const blob = data as Blob;
          if (!blob.size) continue;
          const objectUrl = URL.createObjectURL(blob);
          setObjectUrlForMediaRow(row, objectUrl);
          return objectUrl;
        }
        return null;
      } catch {
        return null;
      } finally {
        downloadFallbackInFlightRef.current[row.id] = false;
      }
    },
    [setObjectUrlForMediaRow]
  );

  const resolveSignedUrlsByMediaIds = useCallback(
    async (tab: MediaDataTab, rows: TRow[]): Promise<Set<string>> => {
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
    async (row: TRow): Promise<string | null> => {
      const signingCandidates = resolveMediaSigningStoragePaths(row, currentUserIdRef.current);
      if (!signingCandidates.length) return null;
      try {
        for (const storagePath of signingCandidates) {
          const nextSignedUrl = await signStoragePath(storagePath, { forceRefresh: true });
          if (!nextSignedUrl) continue;
          const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
          if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            delete objectUrlByMediaIdRef.current[row.id];
          }
          applySignedUrlsToTab(getMediaDataTabForRow(row), new Map([[row.id, nextSignedUrl]]));
          return nextSignedUrl;
        }
        const directUrl = resolveMediaDirectPreviewUrls(row, currentUserIdRef.current)[0] ?? null;
        if (directUrl) {
          const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
          if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            delete objectUrlByMediaIdRef.current[row.id];
          }
          applySignedUrlsToTab(getMediaDataTabForRow(row), new Map([[row.id, directUrl]]));
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
    (row: TRow) => {
      const attempts = signedUrlRetryRef.current[row.id] ?? 0;
      if (attempts >= 3) return;
      signedUrlRetryRef.current[row.id] = attempts + 1;
      void refreshSignedUrl(row).then(async (nextUrl) => {
        const returnedSameUrl = Boolean(nextUrl && row.signedUrl && nextUrl === row.signedUrl);
        if (nextUrl && !returnedSameUrl) return;
        const stillUnresolved = await resolveSignedUrlsByMediaIds(getMediaDataTabForRow(row), [
          row,
        ]);
        if (!stillUnresolved.has(row.id)) return;
        void hydrateViaStorageDownload(row);
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

  return {
    activeMediaQueryRef,
    activeTabRef,
    applySignedUrlsToTab,
    currentUserIdRef,
    getMediaCardRef,
    handleMediaPreviewError,
    hydrateViaStorageDownload,
    isMountedRef,
    markFirstMediaPaint,
    mediaSignInFlightRef,
    mediaTabRequestRef,
    resolveSignedUrlsByMediaIds,
    setSignPassNonce,
    signAttemptRef,
    signBudget,
    signPassNonce,
    signStoragePath,
    signedUrlRetryRef,
    visibleMediaIdsRef,
    visibleMediaVersion,
  };
};
