/**
 * Tab data/cache controller for Media Library.
 * Owns media-tab fetch orchestration, prompt loading, cache staleness policy, and load-more wiring.
 */
import { type MediaListProfile } from "../../../lib/mediaListProfile";
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import type { MediaTab } from "../logic/mediaMoveRouting";
import { fetchMediaListPage } from "../logic/mediaListApi";
import { resolveMediaFetchTransition, type MediaFetchReason } from "../logic/mediaFetchTransition";
import { resolveMediaPreviewStoragePath } from "../logic/mediaPreviewStoragePath";
import { useMediaTabActiveViewSync } from "./useMediaTabActiveViewSync";
import {
  createMediaTabNoProgressState,
  createMediaTabNullableNumberState,
  useMediaTabLoadMoreController,
} from "./useMediaTabLoadMoreController";
import {
  MEDIA_DATA_TABS,
  createMediaTabBooleanState,
  createMediaTabRequestState,
  mergePageRows,
  normalizeMediaSearchTerm,
  withUserScopedPromptQuery,
  type MediaDataTab,
  type MediaTabCache,
  type MediaTabBooleanState,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";

const LOAD_MORE_NO_PROGRESS_CLAMP_THRESHOLD = 2;

type TabDataMediaRowBase = {
  id: string;
  filename: string;
  storage_path: string;
  source?: string | null;
  file_type?: string | null;
  created_at?: string | null;
  signedUrl?: string | null;
  preview_storage_path?: string;
};

type TabDataPromptRowBase = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UseMediaTabDataControllerArgs<
  TRow extends TabDataMediaRowBase,
  TPrompt extends TabDataPromptRowBase,
> = {
  activeMediaCache: MediaTabCache<TRow> | null;
  activeMediaQuery: string;
  activeMediaTab: MediaDataTab | null;
  activeTab: MediaTab;
  activeTabRef: MutableRefObject<MediaTab>;
  cacheTtlMs: number;
  surface: "media-library-route" | "media-library-modal";
  currentUserIdRef: MutableRefObject<string | null>;
  fetchEnabled?: boolean;
  fetchTimeoutMs?: number;
  loadMoreSentinelRef: MutableRefObject<HTMLDivElement | null>;
  loadMoreObserverRootRef?: MutableRefObject<HTMLElement | null>;
  loadMoreRootMargin?: string;
  mediaTabCache: Record<MediaDataTab, MediaTabCache<TRow>>;
  mediaTabRequestRef: MutableRefObject<MediaTabRequestState>;
  pageSize: number;
  promptsLoaded: boolean;
  setError: Dispatch<SetStateAction<string | null>>;
  setFiles: Dispatch<SetStateAction<TRow[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMediaTabCache: Dispatch<SetStateAction<Record<MediaDataTab, MediaTabCache<TRow>>>>;
  setPrompts: Dispatch<SetStateAction<TPrompt[]>>;
  setPromptsLoaded: Dispatch<SetStateAction<boolean>>;
};

const resolveProfileForSurface = (
  surface: "media-library-route" | "media-library-modal"
): MediaListProfile => {
  return surface === "media-library-route" ? "minimal" : "expanded";
};

/**
 * Creates media-tab data/cache orchestration handlers for the Media Library page.
 * Inputs: active tab/query state, cache refs, and page-level state setters.
 * Output: media fetch action plus cache reconciliation helpers for local row mutations.
 * Side effects: reads Supabase media/prompts tables and runs load-more observers.
 */
export const useMediaTabDataController = <
  TRow extends TabDataMediaRowBase,
  TPrompt extends TabDataPromptRowBase,
>({
  activeMediaCache,
  activeMediaQuery,
  activeMediaTab,
  activeTab,
  activeTabRef,
  cacheTtlMs,
  currentUserIdRef,
  fetchEnabled = true,
  fetchTimeoutMs = 12_000,
  loadMoreSentinelRef,
  loadMoreObserverRootRef,
  loadMoreRootMargin = "600px 0px",
  mediaTabCache,
  mediaTabRequestRef,
  pageSize,
  promptsLoaded,
  setError,
  setFiles,
  setLoading,
  setMediaTabCache,
  setPrompts,
  setPromptsLoaded,
  surface,
}: UseMediaTabDataControllerArgs<TRow, TPrompt>) => {
  const tabFetchInFlightRef = useRef<MediaTabBooleanState>(createMediaTabBooleanState());
  const tabLoadMoreAwaitExitRef = useRef<MediaTabBooleanState>(createMediaTabBooleanState());
  const tabLoadMoreScrollIntentArmedRef = useRef<MediaTabBooleanState>(
    createMediaTabBooleanState()
  );
  const tabLoadMoreLastScrollTopRef = useRef(createMediaTabNullableNumberState());
  const tabLoadMoreLastAutoLoadAtMsRef = useRef<MediaTabRequestState>(createMediaTabRequestState());
  const tabNoProgressStateRef = useRef(createMediaTabNoProgressState());
  const fetchMediaTabPageRef = useRef<
    (
      tab: MediaDataTab,
      options?: {
        reset?: boolean;
        query?: string;
        reason?: MediaFetchReason;
        autoTriggered?: boolean;
      }
    ) => Promise<void> | void
  >(async () => {});

  const syncActiveMediaCacheRows = useCallback(
    (rows: TRow[]) => {
      if (!activeMediaTab) return;
      setMediaTabCache((prev) => ({
        ...prev,
        [activeMediaTab]: {
          ...prev[activeMediaTab],
          rows,
          loadedAtMs: Date.now(),
          loaded: true,
        },
      }));
    },
    [activeMediaTab, setMediaTabCache]
  );

  const updateVisibleRows = useCallback(
    (updater: (prev: TRow[]) => TRow[]) => {
      setFiles((prev) => {
        const next = updater(prev);
        syncActiveMediaCacheRows(next);
        return next;
      });
    },
    [setFiles, syncActiveMediaCacheRows]
  );

  const markInactiveMediaCachesStale = useCallback(
    (currentTab: MediaDataTab | null) => {
      for (const tab of MEDIA_DATA_TABS) {
        if (tab === currentTab) continue;
        tabNoProgressStateRef.current[tab] = { query: "", streak: 0 };
      }
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
    },
    [setMediaTabCache, tabNoProgressStateRef]
  );

  const requestLoadMorePage = useCallback(
    (
      tab: MediaDataTab,
      options?: {
        query?: string;
        reason?: "load_more";
        autoTriggered?: boolean;
      }
    ) => fetchMediaTabPageRef.current(tab, options),
    []
  );

  const fetchMediaTabPage = useCallback(
    async (
      tab: MediaDataTab,
      options?: {
        reset?: boolean;
        query?: string;
        reason?: MediaFetchReason;
        autoTriggered?: boolean;
      }
    ) => {
      if (!fetchEnabled) return;
      if (tabFetchInFlightRef.current[tab]) return;
      const cache = mediaTabCache[tab];
      const normalizedQuery = normalizeMediaSearchTerm(options?.query ?? cache.query);
      const transition = resolveMediaFetchTransition({
        reason: options?.reason,
        explicitReset: options?.reset ?? false,
        queryChanged: cache.query !== normalizedQuery,
        cacheLoaded: cache.loaded,
        hasRows: cache.rows.length > 0,
      });
      const { preserveRowsDuringFetch, shouldReset, shouldShowBlockingLoading } = transition;
      if (cache.loading) return;
      if (!shouldReset && !cache.hasMore) return;
      if (options?.reason === "load_more") {
        // Prevent repeated auto-pagination while sentinel remains intersecting.
        tabLoadMoreAwaitExitRef.current[tab] = true;
        tabLoadMoreScrollIntentArmedRef.current[tab] = false;
        if (options.autoTriggered) {
          tabLoadMoreLastAutoLoadAtMsRef.current[tab] = Date.now();
        }
      }
      tabFetchInFlightRef.current[tab] = true;
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
          rows: shouldReset && !preserveRowsDuringFetch ? [] : prev[tab].rows,
          nextCursor: shouldReset ? null : prev[tab].nextCursor,
          pagesLoaded: shouldReset ? 0 : prev[tab].pagesLoaded,
          query: normalizedQuery,
          hasMore: shouldReset ? true : prev[tab].hasMore,
          loading: true,
          error: null,
        },
      }));
      if (activeTabRef.current === tab && shouldShowBlockingLoading) {
        setLoading(true);
      }
      let didTimeout = false;
      const timeoutId =
        typeof window !== "undefined"
          ? window.setTimeout(
              () => {
                if (isStaleRequest()) return;
                didTimeout = true;
                const timeoutMessage = "Media refresh timed out. Showing cached media.";
                setMediaTabCache((prev) => ({
                  ...prev,
                  [tab]: {
                    ...prev[tab],
                    loading: false,
                    loaded: true,
                    loadedAtMs: Date.now(),
                    query: normalizedQuery,
                    error: timeoutMessage,
                  },
                }));
                if (activeTabRef.current === tab) {
                  setError(timeoutMessage);
                  setLoading(false);
                }
              },
              Math.max(1000, fetchTimeoutMs)
            )
          : null;

      try {
        const userId = await readSupabaseUserId();
        if (!userId) throw new Error("Not signed in");
        currentUserIdRef.current = userId;

        const profile = resolveProfileForSurface(surface);
        const apiResult = await fetchMediaListPage<TRow>({
          tab,
          query: normalizedQuery,
          cursor,
          limit: pageSize,
          surface,
          profile,
        });
        if (!apiResult) {
          throw new Error("Unable to load media.");
        }

        const fetchedRows = mergePageRows([], apiResult.rows).slice(0, pageSize);
        const derivedCursor = apiResult.nextCursor;
        const hasMore = apiResult.hasMore;
        const apiSignedById = apiResult.signedById;

        if (isStaleRequest()) return;
        const existingById = new Map(cache.rows.map((row) => [row.id, row]));
        const normalizedRows = fetchedRows.map((row) => {
          const previewStoragePath = resolveMediaPreviewStoragePath(row, userId);
          const cachedRow = existingById.get(row.id);
          const signedFromApi = apiSignedById.get(row.id);
          return {
            ...row,
            source: row.source ?? "upload",
            preview_storage_path: previewStoragePath,
            signedUrl: cachedRow?.signedUrl ?? signedFromApi,
          } as TRow;
        });

        const nextRows = shouldReset ? normalizedRows : mergePageRows(cache.rows, normalizedRows);
        const noProgressState = tabNoProgressStateRef.current[tab];
        const isLoadMore = options?.reason === "load_more";
        if (!isLoadMore || shouldReset || noProgressState.query !== normalizedQuery) {
          noProgressState.query = normalizedQuery;
          noProgressState.streak = 0;
        }
        if (isLoadMore) {
          const netNewCount = Math.max(0, nextRows.length - cache.rows.length);
          noProgressState.streak = netNewCount > 0 ? 0 : noProgressState.streak + 1;
        }
        const noProgressClampActive =
          isLoadMore && noProgressState.streak >= LOAD_MORE_NO_PROGRESS_CLAMP_THRESHOLD;
        const hasMoreAfterClamp = noProgressClampActive ? false : hasMore;
        setMediaTabCache((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            rows: nextRows,
            nextCursor: hasMoreAfterClamp && derivedCursor ? derivedCursor : null,
            pagesLoaded: pageToLoad + 1,
            query: normalizedQuery,
            loadedAtMs: Date.now(),
            hasMore: hasMoreAfterClamp,
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
        const message = err instanceof Error ? err.message : "Unable to load media";
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
      } finally {
        tabFetchInFlightRef.current[tab] = false;
        if (timeoutId != null && typeof window !== "undefined") {
          window.clearTimeout(timeoutId);
        }
        if (didTimeout && activeTabRef.current === tab) {
          // Keep controller state coherent after timeout fallback already unblocked UI.
          setLoading(false);
        }
      }
    },
    [
      activeTabRef,
      currentUserIdRef,
      fetchEnabled,
      fetchTimeoutMs,
      mediaTabCache,
      mediaTabRequestRef,
      pageSize,
      setError,
      setFiles,
      setLoading,
      setMediaTabCache,
      surface,
      tabLoadMoreAwaitExitRef,
      tabLoadMoreLastAutoLoadAtMsRef,
      tabLoadMoreScrollIntentArmedRef,
      tabNoProgressStateRef,
      tabFetchInFlightRef,
    ]
  );

  fetchMediaTabPageRef.current = fetchMediaTabPage;

  const loadPrompts = useCallback(async () => {
    if (!fetchEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = ensureSupabaseQueryClient();
      const userId = await readSupabaseUserId();
      if (!userId) throw new Error("Not signed in");
      const promptQuery = supabase
        .from("media_prompts")
        .select("id, title, prompt_text, mode, source, created_at, updated_at");
      const promptResponse = await withUserScopedPromptQuery(promptQuery, userId);
      if (promptResponse.error) throw promptResponse.error;
      setPrompts((promptResponse.data ?? []) as TPrompt[]);
      setPromptsLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load prompts");
    } finally {
      setLoading(false);
    }
  }, [fetchEnabled, setError, setLoading, setPrompts, setPromptsLoaded]);

  useMediaTabLoadMoreController({
    activeMediaCache,
    activeMediaQuery,
    activeMediaTab,
    fetchEnabled,
    loadMoreSentinelRef,
    loadMoreObserverRootRef,
    loadMoreRootMargin,
    tabLoadMoreAwaitExitRef,
    tabLoadMoreScrollIntentArmedRef,
    tabLoadMoreLastScrollTopRef,
    tabLoadMoreLastAutoLoadAtMsRef,
    tabNoProgressStateRef,
    fetchMediaTabPage: requestLoadMorePage,
  });

  useEffect(() => {
    if (fetchEnabled) return;
    for (const tab of MEDIA_DATA_TABS) {
      mediaTabRequestRef.current[tab] += 1;
      tabFetchInFlightRef.current[tab] = false;
      tabLoadMoreAwaitExitRef.current[tab] = false;
      tabLoadMoreScrollIntentArmedRef.current[tab] = false;
      tabLoadMoreLastScrollTopRef.current[tab] = null;
      tabLoadMoreLastAutoLoadAtMsRef.current[tab] = 0;
      tabNoProgressStateRef.current[tab] = { query: "", streak: 0 };
    }
    setLoading(false);
    setMediaTabCache((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const tab of MEDIA_DATA_TABS) {
        if (!next[tab].loading) continue;
        next[tab] = {
          ...next[tab],
          loading: false,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    fetchEnabled,
    mediaTabRequestRef,
    setLoading,
    setMediaTabCache,
    tabLoadMoreAwaitExitRef,
    tabLoadMoreLastAutoLoadAtMsRef,
    tabLoadMoreLastScrollTopRef,
    tabLoadMoreScrollIntentArmedRef,
    tabNoProgressStateRef,
  ]);

  useMediaTabActiveViewSync({
    activeMediaQuery,
    activeTab,
    cacheTtlMs,
    fetchEnabled,
    fetchMediaTabPage,
    loadPrompts,
    mediaTabCache,
    promptsLoaded,
    setError,
    setFiles,
    setLoading,
  });

  return {
    fetchMediaTabPage,
    markInactiveMediaCachesStale,
    updateVisibleRows,
  };
};
