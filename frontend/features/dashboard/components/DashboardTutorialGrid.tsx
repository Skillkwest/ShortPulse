/**
 * Shared dashboard tutorial grid.
 * Renders admin-managed tutorial cards for public and signed-in dashboard surfaces.
 */
import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardTutorialModal } from "./DashboardTutorialModal";

export type DashboardTutorial = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  thumbnailMediaType: "image" | "video";
  thumbnailPosterUrl?: string | null;
  thumbnailAlt: string;
  displayOrder: number;
};

type DashboardTutorialGridProps = {
  tutorials: DashboardTutorial[];
  launchHref: string;
  autoPlayBudget?: number;
  enablePlaybackRotation?: boolean;
  initialAutoPlayDelayMs?: number;
  maxSimultaneousVideos?: number;
  onModalOpenChange?: (isOpen: boolean) => void;
  pauseVideoPlayback?: boolean;
};

const DASHBOARD_TUTORIAL_GRID_SLOT_COUNT = 25;
const DASHBOARD_TUTORIAL_AUTO_PLAY_BUDGET = 15;
const DASHBOARD_TUTORIAL_IMAGE_EAGER_BUDGET = 5;
const DASHBOARD_TUTORIAL_POSTER_INITIAL_RENDER_BUDGET = 15;
const DASHBOARD_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS = 15;
const DASHBOARD_TUTORIAL_INITIAL_AUTOPLAY_DELAY_MS = 0;
const DASHBOARD_TUTORIAL_PLAYBACK_ROTATION_MS = 5200;
const DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_MS = 1600;
const DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_STAGGER_MS = 90;
const DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_STAGGER_SLOTS = 8;
const DASHBOARD_TUTORIAL_SCROLL_SETTLE_MS = 820;
const DASHBOARD_TUTORIAL_AUTOPLAY_STAGGER_MS = 0;
const DASHBOARD_TUTORIAL_VISIBLE_VIEWPORT_RATIO = 0.05;
const DASHBOARD_TUTORIAL_SCAN_VIEWPORT_RATIO = 0.5;

type DashboardTutorialVideoViewportState = {
  isNearViewport: boolean;
  viewportRatio: number;
  centerDistance: number;
  viewportTop: number;
};

type DashboardTutorialVideoViewportUpdate = {
  index: number;
  state: DashboardTutorialVideoViewportState;
};

type DashboardTutorialVideoThumbnailProps = {
  canAutoPlay: boolean;
  autoPlayStartDelayMs: number;
  hasVisiblePosterPixels: boolean;
  hasUserIntent: boolean;
  index: number;
  isDocumentVisible: boolean;
  isNearViewport: boolean;
  isPlaybackPaused: boolean;
  src: string;
  poster?: string | null;
};

/**
 * Returns whether animated tutorial thumbnails should run automatically for this browser.
 */
function canPlayDashboardTutorialMotion() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
    };
  };
  return connection.connection?.saveData !== true;
}

function getDashboardTutorialVideoViewportStateFromRect(
  rect: DOMRectReadOnly,
  rootMarginPx = 0
): DashboardTutorialVideoViewportState {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const viewportCenter = viewportHeight / 2;
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  const viewportRatio = rect.height > 0 ? Math.min(1, visibleHeight / rect.height) : 0;
  const centerDistance = Math.abs(rect.top + rect.height / 2 - viewportCenter);

  return {
    isNearViewport: rect.bottom >= -rootMarginPx && rect.top <= viewportHeight + rootMarginPx,
    viewportRatio,
    centerDistance,
    viewportTop: rect.top,
  };
}

function getDashboardTutorialVideoViewportState(
  entry: IntersectionObserverEntry
): DashboardTutorialVideoViewportState {
  const viewportState = getDashboardTutorialVideoViewportStateFromRect(entry.boundingClientRect);
  return {
    ...viewportState,
    isNearViewport: Boolean(entry.isIntersecting),
  };
}

function areDashboardTutorialVideoViewportStatesEqual(
  firstState: DashboardTutorialVideoViewportState | undefined,
  secondState: DashboardTutorialVideoViewportState
) {
  return (
    firstState?.isNearViewport === secondState.isNearViewport &&
    firstState.viewportRatio === secondState.viewportRatio &&
    firstState.centerDistance === secondState.centerDistance &&
    firstState.viewportTop === secondState.viewportTop
  );
}

function isDashboardTutorialVideoAlreadyPlaying(videoElement: HTMLVideoElement) {
  return !videoElement.paused && !videoElement.ended && videoElement.readyState >= 2;
}

/**
 * Plays tutorial thumbnail clips only after first-paint poster display or explicit user intent.
 */
const DashboardTutorialVideoThumbnail = memo(function DashboardTutorialVideoThumbnail({
  canAutoPlay,
  autoPlayStartDelayMs,
  hasVisiblePosterPixels,
  hasUserIntent,
  index,
  isDocumentVisible,
  isNearViewport,
  isPlaybackPaused,
  src,
  poster,
}: DashboardTutorialVideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceReleaseTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const playbackAttemptIdRef = useRef(0);
  const [hasLoadedSource, setHasLoadedSource] = useState(false);
  const [hasPlaybackFailed, setHasPlaybackFailed] = useState(false);
  const [autoPlayReadyKey, setAutoPlayReadyKey] = useState<string | null>(null);

  const autoPlayStartKey = canAutoPlay ? `${src}:${autoPlayStartDelayMs}` : null;
  const isAutoPlayStartReady = autoPlayStartKey !== null && autoPlayReadyKey === autoPlayStartKey;

  useEffect(() => {
    if (!autoPlayStartKey || autoPlayReadyKey === autoPlayStartKey) return;
    const timeoutId = globalThis.setTimeout(
      () => {
        setAutoPlayReadyKey(autoPlayStartKey);
      },
      Math.max(0, autoPlayStartDelayMs)
    );
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [autoPlayReadyKey, autoPlayStartDelayMs, autoPlayStartKey]);

  const shouldPlay =
    !isPlaybackPaused &&
    isDocumentVisible &&
    ((canAutoPlay && isAutoPlayStartReady && isNearViewport) || hasUserIntent);
  const shouldLoadSource = hasLoadedSource || shouldPlay;
  const shouldShowVideoLayer = shouldPlay && hasLoadedSource && !hasPlaybackFailed;
  const shouldShowVideoElement = shouldLoadSource && !hasPlaybackFailed;
  const shouldRenderPoster =
    Boolean(poster) &&
    (!shouldLoadSource || hasPlaybackFailed) &&
    (index < DASHBOARD_TUTORIAL_POSTER_INITIAL_RENDER_BUDGET ||
      hasVisiblePosterPixels ||
      shouldLoadSource ||
      (typeof window !== "undefined" && !canPlayDashboardTutorialMotion()));

  const clearSourceReleaseTimeout = useCallback(() => {
    if (!sourceReleaseTimeoutRef.current) return;
    globalThis.clearTimeout(sourceReleaseTimeoutRef.current);
    sourceReleaseTimeoutRef.current = null;
  }, []);

  const playThumbnail = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !shouldPlay) return;

    playbackAttemptIdRef.current += 1;
    const playbackAttemptId = playbackAttemptIdRef.current;
    videoElement.dataset.dashboardPlaybackAttemptId = String(playbackAttemptId);
    if (isDashboardTutorialVideoAlreadyPlaying(videoElement)) {
      return;
    }

    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      void playPromise.catch((error: unknown) => {
        if (playbackAttemptIdRef.current !== playbackAttemptId) return;
        if (videoElement.dataset.dashboardPlaybackAttemptId !== String(playbackAttemptId)) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHasPlaybackFailed(true);
        // Autoplay can still be denied in some environments; keep the poster visible.
      });
    }
  }, [shouldPlay]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (shouldPlay) {
      playThumbnail();
      return;
    }

    playbackAttemptIdRef.current += 1;
    videoElement.dataset.dashboardPlaybackAttemptId = String(playbackAttemptIdRef.current);
    videoElement.pause();
  }, [playThumbnail, shouldPlay]);

  useEffect(() => {
    if (!hasLoadedSource) return;
    if (shouldPlay) {
      clearSourceReleaseTimeout();
      return;
    }

    clearSourceReleaseTimeout();
    const sourceReleaseDelayMs =
      DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_MS +
      (index % DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_STAGGER_SLOTS) *
        DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_STAGGER_MS;
    sourceReleaseTimeoutRef.current = globalThis.setTimeout(() => {
      sourceReleaseTimeoutRef.current = null;
      setHasLoadedSource(false);
    }, sourceReleaseDelayMs);

    return clearSourceReleaseTimeout;
  }, [clearSourceReleaseTimeout, hasLoadedSource, index, shouldPlay]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || shouldLoadSource) return;

    videoElement.removeAttribute("src");
    videoElement.load();
  }, [shouldLoadSource]);

  useEffect(
    () => () => {
      clearSourceReleaseTimeout();
    },
    [clearSourceReleaseTimeout]
  );

  const markSourceLoaded = useCallback(() => {
    setHasLoadedSource(true);
    setHasPlaybackFailed(false);
  }, []);

  const markPlaybackAllowed = useCallback(() => {
    setHasPlaybackFailed(false);
  }, []);

  return (
    <span className="dashboard-tutorial-video-frame">
      {shouldRenderPoster ? (
        <Image
          className="dashboard-tutorial-thumbnail-image"
          src={poster ?? ""}
          alt=""
          width={640}
          height={640}
          loading={isNearViewport || shouldLoadSource ? "eager" : "lazy"}
          unoptimized
        />
      ) : null}
      <video
        ref={videoRef}
        data-dashboard-tutorial-index={index}
        src={shouldLoadSource ? src : undefined}
        poster={shouldLoadSource ? (poster ?? undefined) : undefined}
        muted
        playsInline
        autoPlay={shouldPlay}
        loop={shouldPlay}
        data-playing={shouldShowVideoLayer ? "true" : undefined}
        style={{ opacity: shouldShowVideoElement ? 1 : 0 }}
        preload={shouldPlay ? "auto" : "none"}
        onCanPlay={playThumbnail}
        onLoadedData={markSourceLoaded}
        onPlay={markPlaybackAllowed}
      />
    </span>
  );
});

/**
 * Renders dashboard tutorial cards in the shared 25-slot tutorial grid.
 */
export const DashboardTutorialGrid = memo(function DashboardTutorialGrid({
  tutorials,
  launchHref,
  autoPlayBudget = DASHBOARD_TUTORIAL_AUTO_PLAY_BUDGET,
  enablePlaybackRotation = true,
  initialAutoPlayDelayMs = DASHBOARD_TUTORIAL_INITIAL_AUTOPLAY_DELAY_MS,
  maxSimultaneousVideos = DASHBOARD_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS,
  onModalOpenChange,
  pauseVideoPlayback = false,
}: DashboardTutorialGridProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<DashboardTutorial | null>(null);
  const [hasInitialAutoPlayDelayElapsed, setHasInitialAutoPlayDelayElapsed] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [playbackRotation, setPlaybackRotation] = useState({ candidateKey: "", step: 0 });
  const [engagedVideoIndex, setEngagedVideoIndex] = useState<number | null>(null);
  const tutorialGridRef = useRef<HTMLDivElement | null>(null);
  const isPageScrollingRef = useRef(false);
  const pauseVideoPlaybackRef = useRef(pauseVideoPlayback);
  const scheduledVideoIndexesRef = useRef<Set<number>>(new Set());
  const scrollSettleTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const viewportMeasureFrameRef = useRef<number | null>(null);
  const [nearViewportVideoStateByIndex, setNearViewportVideoStateByIndex] = useState<
    Map<number, DashboardTutorialVideoViewportState>
  >(() => new Map());
  const isTutorialModalOpen = selectedTutorial !== null;
  const shouldPauseVideoPlayback = pauseVideoPlayback || isTutorialModalOpen;
  const tutorialGridSlots = useMemo(
    () =>
      Array.from(
        { length: Math.max(DASHBOARD_TUTORIAL_GRID_SLOT_COUNT, tutorials.length) },
        (_, index) => tutorials[index] ?? null
      ),
    [tutorials]
  );
  const sortedVideoIndexCandidates = useMemo(
    () =>
      Array.from(nearViewportVideoStateByIndex.entries())
        .filter(([, state]) => state.isNearViewport)
        .sort((a, b) => {
          const aHasVisiblePixels = a[1].viewportRatio > DASHBOARD_TUTORIAL_VISIBLE_VIEWPORT_RATIO;
          const bHasVisiblePixels = b[1].viewportRatio > DASHBOARD_TUTORIAL_VISIBLE_VIEWPORT_RATIO;
          if (aHasVisiblePixels !== bHasVisiblePixels) return aHasVisiblePixels ? -1 : 1;
          const aIsPrimaryScanCandidate =
            a[1].viewportRatio >= DASHBOARD_TUTORIAL_SCAN_VIEWPORT_RATIO;
          const bIsPrimaryScanCandidate =
            b[1].viewportRatio >= DASHBOARD_TUTORIAL_SCAN_VIEWPORT_RATIO;
          if (aIsPrimaryScanCandidate !== bIsPrimaryScanCandidate) {
            return aIsPrimaryScanCandidate ? -1 : 1;
          }
          const viewportTopDifference = a[1].viewportTop - b[1].viewportTop;
          if (Math.abs(viewportTopDifference) > 1) return viewportTopDifference;
          const viewportRatioDifference = b[1].viewportRatio - a[1].viewportRatio;
          if (Math.abs(viewportRatioDifference) > 0.01) return viewportRatioDifference;
          const centerDistanceDifference = a[1].centerDistance - b[1].centerDistance;
          if (Math.abs(centerDistanceDifference) > 1) return centerDistanceDifference;
          return a[0] - b[0];
        })
        .slice(0, autoPlayBudget)
        .map(([index]) => index),
    [autoPlayBudget, nearViewportVideoStateByIndex]
  );
  const playableVideoIndexCandidates = useMemo(() => {
    const visibleCandidates = sortedVideoIndexCandidates.filter((index) => {
      const viewportState = nearViewportVideoStateByIndex.get(index);
      return viewportState
        ? viewportState.viewportRatio > DASHBOARD_TUTORIAL_VISIBLE_VIEWPORT_RATIO
        : false;
    });

    return visibleCandidates.length > 0 ? visibleCandidates : sortedVideoIndexCandidates;
  }, [nearViewportVideoStateByIndex, sortedVideoIndexCandidates]);
  const playableVideoIndexCandidateKey = useMemo(
    () => playableVideoIndexCandidates.join(","),
    [playableVideoIndexCandidates]
  );
  const playbackRotationStep =
    playbackRotation.candidateKey === playableVideoIndexCandidateKey ? playbackRotation.step : 0;
  const playableVideoIndexes = useMemo(() => {
    if (shouldPauseVideoPlayback) return new Set<number>();
    if (playableVideoIndexCandidates.length <= maxSimultaneousVideos) {
      return new Set(playableVideoIndexCandidates);
    }

    const rotationStart =
      (playbackRotationStep * maxSimultaneousVideos) % playableVideoIndexCandidates.length;
    return new Set(
      Array.from({ length: maxSimultaneousVideos }, (_, offset) => {
        const candidateIndex = (rotationStart + offset) % playableVideoIndexCandidates.length;
        return playableVideoIndexCandidates[candidateIndex];
      })
    );
  }, [
    maxSimultaneousVideos,
    playbackRotationStep,
    playableVideoIndexCandidates,
    shouldPauseVideoPlayback,
  ]);
  const scheduledVideoIndexes = useMemo(() => {
    const nextIndexes = new Set(playableVideoIndexes);
    if (
      engagedVideoIndex === null ||
      nextIndexes.has(engagedVideoIndex) ||
      nextIndexes.size < maxSimultaneousVideos
    ) {
      return nextIndexes;
    }

    const replacementIndex = Array.from(nextIndexes)
      .reverse()
      .find((index) => index !== engagedVideoIndex);
    if (replacementIndex !== undefined) {
      nextIndexes.delete(replacementIndex);
    }
    return nextIndexes;
  }, [engagedVideoIndex, maxSimultaneousVideos, playableVideoIndexes]);
  const scheduledVideoStartDelayByIndex = useMemo(() => {
    const nextStartDelayByIndex = new Map<number, number>();
    Array.from(scheduledVideoIndexes).forEach((index, scheduledPosition) => {
      nextStartDelayByIndex.set(index, scheduledPosition * DASHBOARD_TUTORIAL_AUTOPLAY_STAGGER_MS);
    });
    return nextStartDelayByIndex;
  }, [scheduledVideoIndexes]);

  useEffect(() => {
    if (!canPlayDashboardTutorialMotion()) return;
    const timeoutId = globalThis.setTimeout(
      () => {
        setHasInitialAutoPlayDelayElapsed(true);
      },
      Math.max(0, initialAutoPlayDelayMs)
    );
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [initialAutoPlayDelayMs]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateDocumentVisibility = () => {
      setIsDocumentVisible(!document.hidden);
    };

    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    };
  }, []);

  useEffect(() => {
    if (
      !enablePlaybackRotation ||
      shouldPauseVideoPlayback ||
      !hasInitialAutoPlayDelayElapsed ||
      playableVideoIndexCandidates.length <= maxSimultaneousVideos
    ) {
      return;
    }

    const rotationInterval = globalThis.setInterval(() => {
      if (isPageScrollingRef.current) return;
      setPlaybackRotation((currentRotation) =>
        currentRotation.candidateKey === playableVideoIndexCandidateKey
          ? {
              candidateKey: playableVideoIndexCandidateKey,
              step: currentRotation.step + 1,
            }
          : {
              candidateKey: playableVideoIndexCandidateKey,
              step: 1,
            }
      );
    }, DASHBOARD_TUTORIAL_PLAYBACK_ROTATION_MS);
    return () => {
      globalThis.clearInterval(rotationInterval);
    };
  }, [
    enablePlaybackRotation,
    hasInitialAutoPlayDelayElapsed,
    maxSimultaneousVideos,
    playableVideoIndexCandidateKey,
    playableVideoIndexCandidates.length,
    shouldPauseVideoPlayback,
  ]);

  useEffect(() => {
    pauseVideoPlaybackRef.current = shouldPauseVideoPlayback;
  }, [shouldPauseVideoPlayback]);

  useEffect(() => {
    scheduledVideoIndexesRef.current = scheduledVideoIndexes;
  }, [scheduledVideoIndexes]);

  useEffect(() => {
    onModalOpenChange?.(isTutorialModalOpen);
  }, [isTutorialModalOpen, onModalOpenChange]);

  const applyVideoViewportStates = useCallback(
    (updates: DashboardTutorialVideoViewportUpdate[]) => {
      if (updates.length === 0) return;
      setNearViewportVideoStateByIndex((currentStateByIndex) => {
        const nextStateByIndex = new Map(currentStateByIndex);
        let hasChanged = false;

        updates.forEach(({ index, state }) => {
          const currentViewportState = nextStateByIndex.get(index);
          if (state.isNearViewport) {
            if (!areDashboardTutorialVideoViewportStatesEqual(currentViewportState, state)) {
              nextStateByIndex.set(index, state);
              hasChanged = true;
            }
            return;
          }

          if (isPageScrollingRef.current && currentViewportState?.isNearViewport) {
            return;
          }

          if (nextStateByIndex.delete(index)) {
            hasChanged = true;
          }
        });

        return hasChanged ? nextStateByIndex : currentStateByIndex;
      });
    },
    []
  );

  const updateVideoEngagement = useCallback((index: number, isEngaged: boolean) => {
    if (!canPlayDashboardTutorialMotion()) return;
    setEngagedVideoIndex((currentIndex) => {
      if (isEngaged) return index;
      return currentIndex === index ? null : currentIndex;
    });
  }, []);
  const refreshVideoViewportStates = useCallback(() => {
    if (typeof window === "undefined" || !canPlayDashboardTutorialMotion()) return;
    const gridElement = tutorialGridRef.current;
    if (!gridElement) return;

    const videoElements = Array.from(
      gridElement.querySelectorAll<HTMLVideoElement>("video[data-dashboard-tutorial-index]")
    );
    if (videoElements.length === 0) return;

    const updates: DashboardTutorialVideoViewportUpdate[] = [];
    videoElements.forEach((videoElement) => {
      const rawIndex = videoElement.dataset.dashboardTutorialIndex;
      const index = Number(rawIndex);
      if (!Number.isSafeInteger(index)) return;

      const videoRect = videoElement.getBoundingClientRect();
      if (videoRect.width <= 0 && videoRect.height <= 0) return;

      const viewportState = getDashboardTutorialVideoViewportStateFromRect(videoRect, 120);
      updates.push({ index, state: viewportState });
    });
    applyVideoViewportStates(updates);
  }, [applyVideoViewportStates]);

  const scheduleVideoViewportRefresh = useCallback(() => {
    if (viewportMeasureFrameRef.current !== null) return;
    viewportMeasureFrameRef.current = globalThis.requestAnimationFrame(() => {
      viewportMeasureFrameRef.current = null;
      refreshVideoViewportStates();
    });
  }, [refreshVideoViewportStates]);

  useEffect(() => {
    if (typeof window === "undefined" || !canPlayDashboardTutorialMotion()) return;
    const gridElement = tutorialGridRef.current;
    if (!gridElement) return;

    const videoElements = Array.from(
      gridElement.querySelectorAll<HTMLVideoElement>("video[data-dashboard-tutorial-index]")
    );
    if (videoElements.length === 0) return;

    if (!("IntersectionObserver" in window)) {
      const frameId = globalThis.requestAnimationFrame(() => {
        applyVideoViewportStates(
          videoElements
            .map((videoElement) => Number(videoElement.dataset.dashboardTutorialIndex))
            .filter(Number.isSafeInteger)
            .map((index) => ({
              index,
              state: {
                isNearViewport: true,
                viewportRatio: 1,
                centerDistance: 0,
                viewportTop: 0,
              },
            }))
        );
      });
      return () => {
        globalThis.cancelAnimationFrame(frameId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        applyVideoViewportStates(
          entries
            .map((entry, entryIndex) => {
              const rawIndex =
                (entry.target as HTMLElement | undefined)?.dataset.dashboardTutorialIndex ??
                videoElements[entryIndex]?.dataset.dashboardTutorialIndex;
              const index = Number(rawIndex);
              if (!Number.isSafeInteger(index)) return null;
              return {
                index,
                state: getDashboardTutorialVideoViewportState(entry),
              };
            })
            .filter((update): update is DashboardTutorialVideoViewportUpdate => update !== null)
        );
      },
      {
        rootMargin: "120px 0px",
        threshold: [0, 0.1, 0.35, 0.7, 1],
      }
    );

    videoElements.forEach((videoElement) => observer.observe(videoElement));
    return () => {
      observer.disconnect();
    };
  }, [applyVideoViewportStates, tutorialGridSlots]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (!isPageScrollingRef.current) {
        isPageScrollingRef.current = true;
      }
      scheduleVideoViewportRefresh();
      if (scrollSettleTimeoutRef.current) {
        globalThis.clearTimeout(scrollSettleTimeoutRef.current);
      }
      scrollSettleTimeoutRef.current = globalThis.setTimeout(() => {
        isPageScrollingRef.current = false;
        refreshVideoViewportStates();
        scrollSettleTimeoutRef.current = null;
      }, DASHBOARD_TUTORIAL_SCROLL_SETTLE_MS);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", scheduleVideoViewportRefresh);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", scheduleVideoViewportRefresh);
      isPageScrollingRef.current = false;
      if (scrollSettleTimeoutRef.current) {
        globalThis.clearTimeout(scrollSettleTimeoutRef.current);
      }
      if (viewportMeasureFrameRef.current !== null) {
        globalThis.cancelAnimationFrame(viewportMeasureFrameRef.current);
      }
    };
  }, [refreshVideoViewportStates, scheduleVideoViewportRefresh]);

  return (
    <>
      <div ref={tutorialGridRef} className="dashboard-tutorial-grid">
        {tutorialGridSlots.map((tutorial, index) => {
          if (!tutorial) {
            return (
              <span
                key={`dashboard-tutorial-slot-${index + 1}`}
                className="dashboard-tutorial-empty-slot"
                aria-hidden="true"
              />
            );
          }

          const isVideoThumbnail = tutorial.thumbnailMediaType === "video";
          return (
            <button
              key={tutorial.id}
              type="button"
              className="dashboard-tutorial-card"
              aria-label={`${tutorial.title}: open tutorial`}
              onClick={() => setSelectedTutorial(tutorial)}
              onBlur={() => updateVideoEngagement(index, false)}
              onFocus={() => updateVideoEngagement(index, isVideoThumbnail)}
              onPointerEnter={() => updateVideoEngagement(index, isVideoThumbnail)}
              onPointerLeave={() => updateVideoEngagement(index, false)}
              onTouchStart={() => updateVideoEngagement(index, isVideoThumbnail)}
            >
              <span className="dashboard-tutorial-title">{tutorial.title}</span>
              <span className="dashboard-tutorial-thumbnail" aria-hidden="true">
                {isVideoThumbnail ? (
                  <DashboardTutorialVideoThumbnail
                    autoPlayStartDelayMs={scheduledVideoStartDelayByIndex.get(index) ?? 0}
                    canAutoPlay={hasInitialAutoPlayDelayElapsed && scheduledVideoIndexes.has(index)}
                    hasUserIntent={engagedVideoIndex === index}
                    hasVisiblePosterPixels={
                      (nearViewportVideoStateByIndex.get(index)?.viewportRatio ?? 0) > 0.01
                    }
                    index={index}
                    isDocumentVisible={isDocumentVisible}
                    isNearViewport={
                      nearViewportVideoStateByIndex.get(index)?.isNearViewport === true
                    }
                    isPlaybackPaused={shouldPauseVideoPlayback}
                    src={tutorial.thumbnailUrl}
                    poster={tutorial.thumbnailPosterUrl}
                  />
                ) : (
                  <Image
                    className="dashboard-tutorial-thumbnail-image"
                    src={tutorial.thumbnailUrl}
                    alt=""
                    width={640}
                    height={640}
                    loading={index < DASHBOARD_TUTORIAL_IMAGE_EAGER_BUDGET ? "eager" : "lazy"}
                    unoptimized
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedTutorial ? (
        <DashboardTutorialModal
          tutorial={selectedTutorial}
          launchHref={launchHref}
          onClose={() => setSelectedTutorial(null)}
        />
      ) : null}
    </>
  );
});
