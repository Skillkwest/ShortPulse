import { useEffect, type MutableRefObject } from "react";
import {
  shouldAutoLoadFromObserver,
  shouldEnableObserverLoadMore,
} from "../logic/mediaLoadMoreGating";
import {
  type MediaDataTab,
  type MediaTabBooleanState,
  type MediaTabCache,
  type MediaTabRequestState,
} from "../logic/mediaLibraryPageHelpers";

const LOAD_MORE_SCROLL_INTENT_DELTA_PX = 36;
const LOAD_MORE_COOLDOWN_MS = 450;

export type MediaTabNullableNumberState = Record<MediaDataTab, number | null>;
export type MediaTabLoadMoreNoProgressState = Record<
  MediaDataTab,
  {
    query: string;
    streak: number;
  }
>;

export const createMediaTabNullableNumberState = (): MediaTabNullableNumberState => ({
  uploaded_images: null,
  uploaded_videos: null,
  private: null,
  ai_generations: null,
});

export const createMediaTabNoProgressState = (): MediaTabLoadMoreNoProgressState => ({
  uploaded_images: { query: "", streak: 0 },
  uploaded_videos: { query: "", streak: 0 },
  private: { query: "", streak: 0 },
  ai_generations: { query: "", streak: 0 },
});

type UseMediaTabLoadMoreControllerArgs<TRow extends { id: string }> = {
  activeMediaCache: MediaTabCache<TRow> | null;
  activeMediaQuery: string;
  activeMediaTab: MediaDataTab | null;
  fetchEnabled: boolean;
  loadMoreSentinelRef: MutableRefObject<HTMLDivElement | null>;
  loadMoreObserverRootRef?: MutableRefObject<HTMLElement | null>;
  loadMoreRootMargin: string;
  tabLoadMoreAwaitExitRef: MutableRefObject<MediaTabBooleanState>;
  tabLoadMoreScrollIntentArmedRef: MutableRefObject<MediaTabBooleanState>;
  tabLoadMoreLastScrollTopRef: MutableRefObject<MediaTabNullableNumberState>;
  tabLoadMoreLastAutoLoadAtMsRef: MutableRefObject<MediaTabRequestState>;
  tabNoProgressStateRef: MutableRefObject<MediaTabLoadMoreNoProgressState>;
  fetchMediaTabPage: (
    tab: MediaDataTab,
    options?: {
      query?: string;
      reason?: "load_more";
      autoTriggered?: boolean;
    }
  ) => Promise<void> | void;
};

type UseMediaTabLoadMoreControllerResult = {
  tabLoadMoreAwaitExitRef: MutableRefObject<MediaTabBooleanState>;
  tabLoadMoreScrollIntentArmedRef: MutableRefObject<MediaTabBooleanState>;
  tabLoadMoreLastScrollTopRef: MutableRefObject<MediaTabNullableNumberState>;
  tabLoadMoreLastAutoLoadAtMsRef: MutableRefObject<MediaTabRequestState>;
  tabNoProgressStateRef: MutableRefObject<MediaTabLoadMoreNoProgressState>;
};

export const useMediaTabLoadMoreController = <TRow extends { id: string }>({
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
  fetchMediaTabPage,
}: UseMediaTabLoadMoreControllerArgs<TRow>): UseMediaTabLoadMoreControllerResult => {
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
  }, [
    activeMediaQuery,
    activeMediaTab,
    tabLoadMoreAwaitExitRef,
    tabLoadMoreLastAutoLoadAtMsRef,
    tabLoadMoreLastScrollTopRef,
    tabLoadMoreScrollIntentArmedRef,
    tabNoProgressStateRef,
  ]);

  useEffect(() => {
    if (!activeMediaTab) return;
    if (
      !shouldEnableObserverLoadMore({
        fetchEnabled,
        hasMore: activeMediaCache?.hasMore === true,
        loaded: activeMediaCache?.loaded === true,
        loading: activeMediaCache?.loading === true,
      })
    ) {
      return;
    }
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
        const now = Date.now();
        const lastAutoLoadAtMs = tabLoadMoreLastAutoLoadAtMsRef.current[activeMediaTab];
        if (
          !shouldAutoLoadFromObserver({
            awaitExit: tabLoadMoreAwaitExitRef.current[activeMediaTab],
            cooldownMs: LOAD_MORE_COOLDOWN_MS,
            fetchEnabled,
            hasMore: activeMediaCache?.hasMore === true,
            lastAutoLoadAtMs,
            loaded: activeMediaCache?.loaded === true,
            loading: activeMediaCache?.loading === true,
            now,
            scrollIntentArmed: tabLoadMoreScrollIntentArmedRef.current[activeMediaTab],
          })
        ) {
          return;
        }
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
    tabLoadMoreAwaitExitRef,
    tabLoadMoreScrollIntentArmedRef,
    tabLoadMoreLastScrollTopRef,
    tabLoadMoreLastAutoLoadAtMsRef,
    tabNoProgressStateRef,
  };
};
