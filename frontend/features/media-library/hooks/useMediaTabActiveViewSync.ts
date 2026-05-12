import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { MediaFetchReason } from "../logic/mediaFetchTransition";
import type { MediaDataTab, MediaTabCache } from "../logic/mediaLibraryPageHelpers";
import type { MediaTab } from "../logic/mediaMoveRouting";

type UseMediaTabActiveViewSyncArgs<TRow> = {
  activeMediaCache: MediaTabCache<TRow> | null;
  activeMediaQuery: string;
  activeTab: MediaTab;
  cacheTtlMs: number;
  fetchEnabled: boolean;
  fetchMediaTabPage: (
    tab: MediaDataTab,
    options?: {
      query?: string;
      reason?: MediaFetchReason;
    }
  ) => Promise<void> | void;
  loadPrompts: () => Promise<void> | void;
  promptsLoaded: boolean;
  setError: Dispatch<SetStateAction<string | null>>;
  setFiles: Dispatch<SetStateAction<TRow[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

/**
 * Keeps the visible media-library surface in sync with the active tab/query.
 * Handles saved-prompts loading and media-tab cache-vs-fetch routing.
 */
export const useMediaTabActiveViewSync = <TRow>({
  activeMediaCache,
  activeMediaQuery,
  activeTab,
  cacheTtlMs,
  fetchEnabled,
  fetchMediaTabPage,
  loadPrompts,
  promptsLoaded,
  setError,
  setFiles,
  setLoading,
}: UseMediaTabActiveViewSyncArgs<TRow>) => {
  useEffect(() => {
    if (!fetchEnabled) return;
    if (activeTab !== "saved_prompts") return;
    if (!promptsLoaded) {
      void loadPrompts();
    } else {
      setLoading(false);
    }
  }, [activeTab, fetchEnabled, loadPrompts, promptsLoaded, setLoading]);

  useEffect(() => {
    if (!fetchEnabled) return;
    if (activeTab === "saved_prompts") return;
    if (!activeMediaCache) return;
    const cache = activeMediaCache;
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
    fetchEnabled,
    fetchMediaTabPage,
    activeMediaCache,
    setError,
    setFiles,
    setLoading,
  ]);
};
