import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { MediaFetchReason } from "../logic/mediaFetchTransition";
import type { MediaDataTab, MediaTabCache } from "../logic/mediaLibraryPageHelpers";
import type { MediaTab } from "../logic/mediaMoveRouting";

type UseMediaTabActiveViewSyncArgs<TRow> = {
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
  mediaTabCache: Record<MediaDataTab, MediaTabCache<TRow>>;
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
}: UseMediaTabActiveViewSyncArgs<TRow>) => {
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
    fetchEnabled,
    fetchMediaTabPage,
    loadPrompts,
    mediaTabCache,
    promptsLoaded,
    setError,
    setFiles,
    setLoading,
  ]);
};
