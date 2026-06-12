/**
 * Shared dashboard tutorial grid.
 * Renders admin-managed tutorial cards for public and signed-in dashboard surfaces.
 */
import Image from "next/image";
import { useState } from "react";
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

type DashboardTutorialVideoThumbnailProps = {
  src: string;
  poster?: string | null;
};

/**
 * Plays short tutorial thumbnail clips as native muted loops.
 */
function DashboardTutorialVideoThumbnail({ src, poster }: DashboardTutorialVideoThumbnailProps) {
  return (
    <video src={src} poster={poster ?? undefined} muted playsInline autoPlay loop preload="auto" />
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
                  <DashboardTutorialVideoThumbnail
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
