/**
 * Shared dashboard tutorial grid.
 * Renders admin-managed tutorial cards for public and signed-in dashboard surfaces.
 */
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardTutorialModal } from "./DashboardTutorialModal";

export type DashboardTutorial = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  thumbnailMediaType: "image" | "video";
  thumbnailAlt: string;
  displayOrder: number;
};

type DashboardTutorialGridProps = {
  tutorials: DashboardTutorial[];
  launchHref: string;
};

const DASHBOARD_TUTORIAL_GRID_SLOT_COUNT = 25;
const VIDEO_LOOP_START_SECONDS = 0.001;

const getVideoLoopRestartOffsetSeconds = (duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0.12;
  return Math.min(0.22, Math.max(0.08, duration * 0.05));
};

type DashboardTutorialVideoThumbnailProps = {
  src: string;
};

/**
 * Plays short tutorial thumbnail clips without showing encoded black tail frames on loop.
 */
function DashboardTutorialVideoThumbnail({ src }: DashboardTutorialVideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopFrameLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const restartNearTail = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const restartOffset = getVideoLoopRestartOffsetSeconds(video.duration);
    if (video.duration - video.currentTime <= restartOffset) {
      video.currentTime = VIDEO_LOOP_START_SECONDS;
      void video.play().catch(() => undefined);
    }
  }, []);

  const runFrameLoop = useCallback(() => {
    stopFrameLoop();
    const tick = () => {
      restartNearTail();
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };
    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [restartNearTail, stopFrameLoop]);

  const playFromCleanStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime === 0) {
      video.currentTime = VIDEO_LOOP_START_SECONDS;
    }
    void video.play().catch(() => undefined);
  }, []);

  useEffect(() => stopFrameLoop, [stopFrameLoop]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      autoPlay
      preload="auto"
      onLoadedData={playFromCleanStart}
      onPlay={runFrameLoop}
      onPause={stopFrameLoop}
      onEnded={playFromCleanStart}
    />
  );
}

/**
 * Renders dashboard tutorial cards in the shared 25-slot tutorial grid.
 */
export function DashboardTutorialGrid({ tutorials, launchHref }: DashboardTutorialGridProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<DashboardTutorial | null>(null);
  const tutorialGridSlots = Array.from(
    { length: Math.max(DASHBOARD_TUTORIAL_GRID_SLOT_COUNT, tutorials.length) },
    (_, index) => tutorials[index] ?? null
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
                  <DashboardTutorialVideoThumbnail src={tutorial.thumbnailUrl} />
                ) : (
                  <Image
                    className="dashboard-tutorial-thumbnail-image"
                    src={tutorial.thumbnailUrl}
                    alt=""
                    width={640}
                    height={640}
                    loading="eager"
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
