/**
 * Shared dashboard tutorial grid.
 * Renders admin-managed tutorial cards for public and signed-in dashboard surfaces.
 */
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
};

const DASHBOARD_TUTORIAL_GRID_SLOT_COUNT = 25;
const DASHBOARD_TUTORIAL_AUTO_PLAY_BUDGET = 5;
const DASHBOARD_TUTORIAL_DEFERRED_AUTO_PLAY_STAGGER_MS = 180;

type DashboardTutorialVideoThumbnailProps = {
  autoActivateDelayMs: number;
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

/**
 * Plays tutorial thumbnail clips only after first-paint poster display or explicit user intent.
 */
function DashboardTutorialVideoThumbnail({
  autoActivateDelayMs,
  src,
  poster,
}: DashboardTutorialVideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [motionAllowed] = useState(canPlayDashboardTutorialMotion);
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof window === "undefined" || typeof IntersectionObserver === "undefined"
  );
  const [isPlaybackRequested, setIsPlaybackRequested] = useState(false);
  const shouldRenderActiveVideo = motionAllowed && isNearViewport && isPlaybackRequested;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(Boolean(entry?.isIntersecting));
      },
      {
        rootMargin: "160px 0px",
        threshold: 0.1,
      }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!motionAllowed || !isNearViewport) return;

    const activationTimer = window.setTimeout(() => {
      setIsPlaybackRequested(true);
    }, autoActivateDelayMs);
    return () => window.clearTimeout(activationTimer);
  }, [autoActivateDelayMs, isNearViewport, motionAllowed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!shouldRenderActiveVideo) {
      try {
        video.pause();
      } catch {
        // Test DOMs and some constrained browsers can omit media controls.
      }
      return;
    }

    try {
      const playResult = video.play();
      if (playResult && typeof playResult.catch === "function") {
        void playResult.catch(() => {
          window.setTimeout(() => setIsPlaybackRequested(false), 0);
        });
      }
    } catch {
      window.setTimeout(() => setIsPlaybackRequested(false), 0);
    }
  }, [shouldRenderActiveVideo, src]);

  const activateThumbnail = useCallback(() => {
    if (motionAllowed) {
      setIsNearViewport(true);
      setIsPlaybackRequested(true);
    }
  }, [motionAllowed]);

  return (
    <video
      ref={videoRef}
      src={shouldRenderActiveVideo ? src : undefined}
      poster={poster ?? undefined}
      muted
      playsInline
      autoPlay={shouldRenderActiveVideo}
      loop={shouldRenderActiveVideo}
      preload={shouldRenderActiveVideo ? "metadata" : "none"}
      onPointerEnter={activateThumbnail}
      onFocus={activateThumbnail}
      onTouchStart={activateThumbnail}
    />
  );
}

/**
 * Renders dashboard tutorial cards in the shared 25-slot tutorial grid.
 */
export function DashboardTutorialGrid({ tutorials, launchHref }: DashboardTutorialGridProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<DashboardTutorial | null>(null);
  const tutorialGridSlots = useMemo(
    () =>
      Array.from(
        { length: Math.max(DASHBOARD_TUTORIAL_GRID_SLOT_COUNT, tutorials.length) },
        (_, index) => tutorials[index] ?? null
      ),
    [tutorials]
  );

  return (
    <>
      <div className="dashboard-tutorial-grid">
        {tutorialGridSlots.map((tutorial, index) =>
          tutorial ? (
            <button
              key={tutorial.id}
              type="button"
              className="dashboard-tutorial-card"
              aria-label={`${tutorial.title}: open tutorial`}
              onClick={() => setSelectedTutorial(tutorial)}
            >
              <span className="dashboard-tutorial-title">{tutorial.title}</span>
              <span className="dashboard-tutorial-thumbnail" aria-hidden="true">
                {tutorial.thumbnailMediaType === "video" ? (
                  <DashboardTutorialVideoThumbnail
                    autoActivateDelayMs={
                      index < DASHBOARD_TUTORIAL_AUTO_PLAY_BUDGET
                        ? 0
                        : (index - DASHBOARD_TUTORIAL_AUTO_PLAY_BUDGET + 1) *
                          DASHBOARD_TUTORIAL_DEFERRED_AUTO_PLAY_STAGGER_MS
                    }
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
                    loading={index < DASHBOARD_TUTORIAL_AUTO_PLAY_BUDGET ? "eager" : "lazy"}
                    unoptimized
                  />
                )}
              </span>
            </button>
          ) : (
            <span
              key={`dashboard-tutorial-slot-${index + 1}`}
              className="dashboard-tutorial-empty-slot"
              aria-hidden="true"
            />
          )
        )}
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
}
