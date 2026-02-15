/**
 * Tab data/cache controller for Media Library.
 * Owns media-tab fetch orchestration, prompt loading, cache staleness policy, and load-more wiring.
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { MediaTab } from "../logic/mediaMoveRouting";
import {
  MEDIA_DATA_TABS,
  buildCursorFromRows,
  getMediaDataTabForRow,
  mergePageRows,
  normalizeMediaSearchTerm,
  withMediaSearchFilter,
  withMediaTabFilter,
  type MediaDataTab,
  type MediaTabCache,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";

type TabDataMediaRowBase = {
  id: string;
  filename: string;
  storage_path: string;
  source?: string | null;
  file_type?: string | null;
  created_at: string;
  signedUrl?: string;
  preview_storage_path?: string;
};

type TabDataPromptRowBase = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  source: string;
  created_at: string;
  updated_at: string;
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
  currentUserIdRef: MutableRefObject<string | null>;
  loadMoreSentinelRef: MutableRefObject<HTMLDivElement | null>;
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
  loadMoreSentinelRef,
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
}: UseMediaTabDataControllerArgs<TRow, TPrompt>) => {
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

        const fetchedRows: TRow[] = [];
        if (!cursor) {
          const firstPageResponse = await buildBaseQuery().limit(pageSize);
          if (firstPageResponse.error) throw firstPageResponse.error;
          fetchedRows.push(...((firstPageResponse.data ?? []) as TRow[]));
        } else {
          const sameTimestampResponse = await buildBaseQuery()
            .eq("created_at", cursor.createdAt)
            .lt("id", cursor.id)
            .limit(pageSize);
          if (sameTimestampResponse.error) throw sameTimestampResponse.error;
          const sameTimestampRows = (sameTimestampResponse.data ?? []) as TRow[];
          fetchedRows.push(...sameTimestampRows);

          const remaining = pageSize - sameTimestampRows.length;
          if (remaining > 0) {
            const olderRowsResponse = await buildBaseQuery()
              .lt("created_at", cursor.createdAt)
              .limit(remaining);
            if (olderRowsResponse.error) throw olderRowsResponse.error;
            fetchedRows.push(...((olderRowsResponse.data ?? []) as TRow[]));
          }
        }
        if (isStaleRequest()) return;

        const rows = mergePageRows([], fetchedRows).slice(0, pageSize);
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
          } as TRow;
        });

        const derivedCursor = buildCursorFromRows(rows);
        const hasMore = rows.length === pageSize && Boolean(derivedCursor);
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
      }
    },
    [
      activeTabRef,
      currentUserIdRef,
      mediaTabCache,
      mediaTabRequestRef,
      pageSize,
      setError,
      setFiles,
      setLoading,
      setMediaTabCache,
    ]
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
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (promptResponse.error) throw promptResponse.error;
      setPrompts((promptResponse.data ?? []) as TPrompt[]);
      setPromptsLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load prompts");
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setPrompts, setPromptsLoaded]);

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
    const isStale = cache.loadedAtMs == null || Date.now() - cache.loadedAtMs > cacheTtlMs;
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
    cacheTtlMs,
    fetchMediaTabPage,
    loadPrompts,
    mediaTabCache,
    promptsLoaded,
    setError,
    setFiles,
    setLoading,
  ]);

  useEffect(() => {
    if (!activeMediaTab) return;
    if (!activeMediaCache?.loaded || activeMediaCache.loading || !activeMediaCache.hasMore) return;
    if (typeof IntersectionObserver === "undefined") return;
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
    loadMoreSentinelRef,
  ]);

  return {
    fetchMediaTabPage,
    markInactiveMediaCachesStale,
    updateVisibleRows,
  };
};
