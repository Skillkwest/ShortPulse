/**
 * Shared Media Library surface preview runtime.
 * Centralizes visibility tracking, sign-budget refresh, preview recovery, and signed-url application across surfaces.
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
import { logMediaPerf, type MediaPerfEventName } from "../../../lib/mediaPerfTelemetry";
import { type MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  hydrateMediaPreviewViaStorageDownload,
  resolveAndApplySignedPreviewUrlsByRows,
  signMediaStoragePath,
} from "../logic/mediaPreviewRuntimeShared";
import {
  BUCKET,
  createMediaTabBooleanState,
  createMediaTabRequestState,
  getMediaDataTabForRow,
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
  type MediaTabCache,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";
import { useMediaPreviewRecoveryController } from "./useMediaPreviewRecoveryController";

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

type UseMediaSurfacePreviewRuntimeArgs<TRow extends PreviewRuntimeRowBase, TTab extends string> = {
  activeMediaQuery: string;
  activeTab: TTab;
  firstMediaPaintEventName: MediaPerfEventName;
  previewProfile: MediaPreviewTransformProfile;
  signBudgetResolver: () => MediaSignBudget;
  surface: "media-library-route" | "media-library-modal" | "media-library-panel";
  visibilityRootMargin: string;
  applySignedUrlsToSurface?: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  beforeRetry?: (params: { row: TRow; failedUrl?: string | null }) => void;
  setFiles: Dispatch<SetStateAction<TRow[]>>;
  setFocusedFile?: Dispatch<SetStateAction<TRow | null>>;
  setMediaTabCache?: Dispatch<SetStateAction<Record<MediaDataTab, MediaTabCache<TRow>>>>;
  shouldApplySignedUrlsToActiveRows?: (tab: MediaDataTab) => boolean;
  visibilityRootRef?: MutableRefObject<HTMLElement | null>;
};

export type UseMediaSurfacePreviewRuntimeResult<
  TRow extends PreviewRuntimeRowBase,
  TTab extends string,
  TElement extends HTMLElement = HTMLDivElement,
> = {
  activeMediaQueryRef: MutableRefObject<string>;
  activeTabRef: MutableRefObject<TTab>;
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  currentUserIdRef: MutableRefObject<string | null>;
  getMediaCardRef: (fileId: string) => (node: TElement | null) => void;
  handleMediaPreviewError: (row: TRow) => void;
  hydrateViaStorageDownload: (row: TRow) => Promise<string | null>;
  isMountedRef: MutableRefObject<boolean>;
  markFirstMediaPaint: (assetKind: "image" | "video") => void;
  mediaSignInFlightRef: MutableRefObject<MediaTabBooleanState>;
  mediaTabRequestRef: MutableRefObject<MediaTabRequestState>;
  refreshSignedUrl: (row: TRow) => Promise<string | null>;
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

type NavigatorWithConnection = Navigator & {
  connection?: {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

export const useMediaSurfacePreviewRuntime = <
  TRow extends PreviewRuntimeRowBase,
  TTab extends string,
  TElement extends HTMLElement = HTMLDivElement,
>({
  activeMediaQuery,
  activeTab,
  firstMediaPaintEventName,
  previewProfile,
  signBudgetResolver,
  surface,
  visibilityRootMargin,
  applySignedUrlsToSurface,
  beforeRetry,
  setFiles,
  setFocusedFile,
  setMediaTabCache,
  shouldApplySignedUrlsToActiveRows,
  visibilityRootRef,
}: UseMediaSurfacePreviewRuntimeArgs<TRow, TTab>): UseMediaSurfacePreviewRuntimeResult<
  TRow,
  TTab,
  TElement
> => {
  const activeTabRef = useRef<TTab>(activeTab);
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
  const mediaCardNodesRef = useRef<Map<string, TElement>>(new Map());
  const mediaCardRefCallbacksRef = useRef<Record<string, (node: TElement | null) => void>>({});
  const mediaCardObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleMediaIdsRef = useRef<Set<string>>(new Set());
  const [visibleMediaVersion, setVisibleMediaVersion] = useState(0);
  const [signPassNonce, setSignPassNonce] = useState(0);
  const [signBudget, setSignBudget] = useState<MediaSignBudget>(signBudgetResolver);

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
        const next = signBudgetResolver();
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
  }, [signBudgetResolver]);

  useEffect(() => {
    signAttemptRef.current = {};
  }, [activeMediaQuery, activeTab]);

  useEffect(() => {
    firstMediaPaintLoggedRef.current = false;
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

  const getMediaCardRef = useCallback((fileId: string) => {
    const existing = mediaCardRefCallbacksRef.current[fileId];
    if (existing) return existing;
    const callback = (node: TElement | null) => {
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
        root: visibilityRootRef?.current ?? null,
        rootMargin: visibilityRootMargin,
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
  }, [visibilityRootMargin, visibilityRootRef]);

  const signStoragePath = useCallback(
    (
      storagePath: string,
      options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
    ): Promise<string | null> => signMediaStoragePath(storagePath, options),
    []
  );

  const applySignedUrlsToTab = useCallback(
    (tab: MediaDataTab, signedById: Map<string, string>) => {
      if (!signedById.size) return;
      if (applySignedUrlsToSurface) {
        applySignedUrlsToSurface(tab, signedById);
      } else if (setMediaTabCache) {
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
        if (shouldApplySignedUrlsToActiveRows?.(tab) ?? true) {
          setFiles((prev) =>
            prev.map((file) => {
              const signedUrl = signedById.get(file.id);
              return signedUrl ? { ...file, signedUrl } : file;
            })
          );
        }
      }
      if (setFocusedFile) {
        setFocusedFile((prev) => {
          if (!prev) return prev;
          const signedUrl = signedById.get(prev.id);
          return signedUrl ? { ...prev, signedUrl } : prev;
        });
      }
    },
    [
      applySignedUrlsToSurface,
      setFiles,
      setFocusedFile,
      setMediaTabCache,
      shouldApplySignedUrlsToActiveRows,
    ]
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
        const supabase = ensureSupabaseQueryClient();
        return await hydrateMediaPreviewViaStorageDownload({
          row,
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
        downloadFallbackInFlightRef.current[row.id] = false;
      }
    },
    [setObjectUrlForMediaRow]
  );

  const resolveSignedUrlsByMediaIds = useCallback(
    (tab: MediaDataTab, rows: TRow[]): Promise<Set<string>> =>
      resolveAndApplySignedPreviewUrlsByRows({
        tab,
        rows,
        applySignedUrlsToTab,
        currentUserId: currentUserIdRef.current,
        surface,
      }),
    [applySignedUrlsToTab, surface]
  );

  const { handleMediaPreviewError, refreshSignedUrl } = useMediaPreviewRecoveryController<TRow>({
    applySignedUrlsToTab,
    beforeRetry,
    currentUserIdRef,
    resolveSignedUrlsByMediaIds,
    hydrateViaStorageDownload,
    signStoragePath,
    signedUrlRetryRef,
    objectUrlByMediaIdRef,
    resolveTabForRow: getMediaDataTabForRow,
    previewProfile,
  });

  const markFirstMediaPaint = useCallback(
    (assetKind: "image" | "video") => {
      if (firstMediaPaintLoggedRef.current) return;
      firstMediaPaintLoggedRef.current = true;
      logMediaPerf(firstMediaPaintEventName, {
        surface,
        tab: activeTab,
        asset_kind: assetKind,
      });
    },
    [activeTab, firstMediaPaintEventName, surface]
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
    refreshSignedUrl,
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
