/**
 * Tab data/cache controller for Media Library.
 * Owns media-tab fetch orchestration, prompt loading, cache staleness policy, and load-more wiring.
 */
import {
  resolveMediaListSelectColumns,
  type MediaListProfile,
} from "../../../lib/mediaListProfile";
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { MediaTab } from "../logic/mediaMoveRouting";
import { MEDIA_LIST_API_ENABLED } from "../logic/mediaLibraryFeatureFlags";
import { fetchMediaListPage } from "../logic/mediaListApi";
import { resolveMediaFetchTransition, type MediaFetchReason } from "../logic/mediaFetchTransition";
import {
  MEDIA_DATA_TABS,
  buildCursorFromRows,
  createMediaTabBooleanState,
  createMediaTabRequestState,
  getMediaDataTabForRow,
  mergePageRows,
  normalizeMediaSearchTerm,
  withMediaSearchFilter,
  withUserScopedPromptQuery,
  withMediaTabFilter,
  type MediaDataTab,
  type MediaTabCache,
  type MediaTabBooleanState,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";

const LOAD_MORE_SCROLL_INTENT_DELTA_PX = 36;
const LOAD_MORE_COOLDOWN_MS = 450;
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

type MediaTabNullableNumberState = Record<MediaDataTab, number | null>;
type MediaTabLoadMoreNoProgressState = Record<
  MediaDataTab,
  {
    query: string;
    streak: number;
  }
>;

const createMediaTabNullableNumberState = (): MediaTabNullableNumberState => ({
  uploaded_images: null,
  uploaded_videos: null,
  private: null,
  ai_generations: null,
});

const createMediaTabNoProgressState = (): MediaTabLoadMoreNoProgressState => ({
  uploaded_images: { query: "", streak: 0 },
  uploaded_videos: { query: "", streak: 0 },
  private: { query: "", streak: 0 },
  ai_generations: { query: "", streak: 0 },
});

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
  const tabLoadMoreLastScrollTopRef = useRef<MediaTabNullableNumberState>(
    createMediaTabNullableNumberState()
  );
  const tabLoadMoreLastAutoLoadAtMsRef = useRef<MediaTabRequestState>(createMediaTabRequestState());
  const tabNoProgressStateRef = useRef<MediaTabLoadMoreNoProgressState>(
    createMediaTabNoProgressState()
  );

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
  }, [fetchEnabled, mediaTabRequestRef, setLoading, setMediaTabCache]);

  const syncActiveMediaCacheRows = useCallback(
    (rows: TRow[]) => {
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
    [activeMediaQuery, activeMediaTab, setMediaTabCache]
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
    [setMediaTabCache]
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
        const supabase = ensureSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) throw new Error("Not signed in");
        currentUserIdRef.current = userId;

        let fetchedRows: TRow[] = [];
        let derivedCursor = cursor;
        let hasMore = false;
        let apiSignedById = new Map<string, string>();
        let usedListApi = false;

        if (MEDIA_LIST_API_ENABLED) {
          const profile = resolveProfileForSurface(surface);
          const apiResult = await fetchMediaListPage<TRow>({
            tab,
            query: normalizedQuery,
            cursor,
            limit: pageSize,
            surface,
            profile,
          });
          if (apiResult) {
            usedListApi = true;
            fetchedRows = mergePageRows([], apiResult.rows).slice(0, pageSize);
            derivedCursor = apiResult.nextCursor;
            hasMore = apiResult.hasMore;
            apiSignedById = apiResult.signedById;
          }
        }

        if (!usedListApi) {
          const selectColumns = resolveMediaListSelectColumns(resolveProfileForSurface(surface));
          const buildBaseQuery = () => {
            let query = supabase.from("media_files").select(selectColumns).eq("user_id", userId);
            query = withMediaTabFilter(query, tab);
            query = withMediaSearchFilter(query, normalizedQuery);
            return query
              .order("created_at", { ascending: false })
              .order("id", { ascending: false });
          };

          if (!cursor) {
            const firstPageResponse = await buildBaseQuery().limit(pageSize);
            if (firstPageResponse.error) throw firstPageResponse.error;
            fetchedRows = (firstPageResponse.data ?? []) as unknown as TRow[];
          } else {
            const sameTimestampResponse = await buildBaseQuery()
              .eq("created_at", cursor.createdAt)
              .lt("id", cursor.id)
              .limit(pageSize);
            if (sameTimestampResponse.error) throw sameTimestampResponse.error;
            const sameTimestampRows = (sameTimestampResponse.data ?? []) as unknown as TRow[];
            fetchedRows = [...sameTimestampRows];

            const remaining = pageSize - sameTimestampRows.length;
            if (remaining > 0) {
              const olderRowsResponse = await buildBaseQuery()
                .lt("created_at", cursor.createdAt)
                .limit(remaining);
              if (olderRowsResponse.error) throw olderRowsResponse.error;
              fetchedRows.push(...((olderRowsResponse.data ?? []) as unknown as TRow[]));
            }
          }
          fetchedRows = mergePageRows([], fetchedRows).slice(0, pageSize);
          derivedCursor = buildCursorFromRows(fetchedRows);
          hasMore = fetchedRows.length === pageSize && Boolean(derivedCursor);
        }

        if (isStaleRequest()) return;
        const existingById = new Map(cache.rows.map((row) => [row.id, row]));
        const normalizedRows = fetchedRows.map((row) => {
          const signingCandidates = resolveMediaSigningStoragePaths(row, userId);
          const previewStoragePath = signingCandidates[0] ?? row.storage_path;
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
      tabFetchInFlightRef,
    ]
  );

  const loadPrompts = useCallback(async () => {
    if (!fetchEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
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

  useEffect(() => {
    if (!activeMediaTab) return;
    tabLoadMoreAwaitExitRef.current[activeMediaTab] = false;
    tabLoadMoreScrollIntentArmedRef.current[activeMediaTab] = false;
    tabLoadMoreLastAutoLoadAtMsRef.current[activeMediaTab] = 0;
    tabLoadMoreLastScrollTopRef.current[activeMediaTab] = null;
    tabNoProgressStateRef.current[activeMediaTab] = {
      query: activeMediaQuery,
      streak: 0,
    };
  }, [activeMediaQuery, activeMediaTab]);

  useEffect(() => {
    if (!fetchEnabled) return;
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
    const isStale = cache.loadedAtMs == null || Date.now() - cache.loadedAtMs > cacheTtlMs;
    if (cache.loaded && !queryChanged && !isStale) {
      setFiles(cache.rows);
      setError(cache.error);
      setLoading(cache.loading);
      return;
    }
    if (cache.loaded && !queryChanged && isStale) {
      setFiles(cache.rows);
      setLoading(cache.rows.length === 0);
    }
    const fetchReason: MediaFetchReason =
      cache.loaded && !queryChanged && isStale
        ? "stale_refresh"
        : cache.loaded
          ? "tab_or_query_reset"
          : "initial";
    void fetchMediaTabPage(activeTab, { query: activeMediaQuery, reason: fetchReason });
  }, [
    activeMediaQuery,
    activeTab,
    cacheTtlMs,
    fetchMediaTabPage,
    loadPrompts,
    mediaTabCache,
    promptsLoaded,
    setError,
    setFiles,
    setLoading,
    fetchEnabled,
  ]);

  useEffect(() => {
    if (!fetchEnabled) return;
    if (!activeMediaTab) return;
    if (!activeMediaCache?.loaded || activeMediaCache.loading || !activeMediaCache.hasMore) return;
    if (typeof IntersectionObserver === "undefined") return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    const rootNode = loadMoreObserverRootRef?.current ?? null;
    const readCurrentScrollTop = (): number => {
      if (rootNode) return rootNode.scrollTop ?? 0;
      if (typeof window === "undefined") return 0;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };
    tabLoadMoreLastScrollTopRef.current[activeMediaTab] = readCurrentScrollTop();
    const scrollTarget = rootNode ?? window;
    const handleScroll = () => {
      const previousTop = tabLoadMoreLastScrollTopRef.current[activeMediaTab];
      const nextTop = readCurrentScrollTop();
      tabLoadMoreLastScrollTopRef.current[activeMediaTab] = nextTop;
      if (previousTop == null) return;
      const scrollDelta = nextTop - previousTop;
      if (scrollDelta >= LOAD_MORE_SCROLL_INTENT_DELTA_PX) {
        tabLoadMoreScrollIntentArmedRef.current[activeMediaTab] = true;
      }
    };
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          tabLoadMoreAwaitExitRef.current[activeMediaTab] = false;
          return;
        }
        if (tabLoadMoreAwaitExitRef.current[activeMediaTab]) return;
        if (!tabLoadMoreScrollIntentArmedRef.current[activeMediaTab]) return;
        const now = Date.now();
        const lastAutoLoadAtMs = tabLoadMoreLastAutoLoadAtMsRef.current[activeMediaTab];
        if (now - lastAutoLoadAtMs < LOAD_MORE_COOLDOWN_MS) return;
        tabLoadMoreLastAutoLoadAtMsRef.current[activeMediaTab] = now;
        tabLoadMoreScrollIntentArmedRef.current[activeMediaTab] = false;
        void fetchMediaTabPage(activeMediaTab, {
          query: activeMediaQuery,
          reason: "load_more",
          autoTriggered: true,
        });
      },
      {
        root: rootNode,
        rootMargin: loadMoreRootMargin,
      }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", handleScroll);
    };
  }, [
    activeMediaCache?.hasMore,
    activeMediaCache?.loaded,
    activeMediaCache?.loading,
    activeMediaQuery,
    activeMediaTab,
    fetchEnabled,
    fetchMediaTabPage,
    loadMoreObserverRootRef,
    loadMoreRootMargin,
    loadMoreSentinelRef,
    tabLoadMoreAwaitExitRef,
    tabLoadMoreLastAutoLoadAtMsRef,
    tabLoadMoreLastScrollTopRef,
    tabLoadMoreScrollIntentArmedRef,
  ]);

  return {
    fetchMediaTabPage,
    markInactiveMediaCachesStale,
    updateVisibleRows,
  };
};
