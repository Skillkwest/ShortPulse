import { type Ref } from "react";
import { DashboardTutorialGrid, type DashboardTutorial } from "./DashboardTutorialGrid";

type PublicHomeTutorialShowcaseProps = {
  tutorials: DashboardTutorial[];
  launchHref: string;
  sectionRef?: Ref<HTMLElement>;
  hasActivatedTutorialShowcase?: boolean;
  autoPlayBudget?: number;
  enablePlaybackRotation?: boolean;
  maxSimultaneousVideos?: number;
  onModalOpenChange?: (isOpen: boolean) => void;
  pauseVideoPlayback?: boolean;
};

export function PublicHomeTutorialShowcase({
  tutorials,
  launchHref,
  sectionRef,
  hasActivatedTutorialShowcase = true,
  autoPlayBudget,
  enablePlaybackRotation,
  maxSimultaneousVideos,
  onModalOpenChange,
  pauseVideoPlayback,
}: PublicHomeTutorialShowcaseProps) {
  if (tutorials.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      className="public-home-showcase"
      aria-labelledby="public-home-showcase-heading"
    >
      <h2 id="public-home-showcase-heading" className="sr-only">
        Quick-start tutorial workflows
      </h2>
      {hasActivatedTutorialShowcase ? (
        <DashboardTutorialGrid
          tutorials={tutorials}
          launchHref={launchHref}
          autoPlayBudget={autoPlayBudget}
          enablePlaybackRotation={enablePlaybackRotation}
          maxSimultaneousVideos={maxSimultaneousVideos}
          onModalOpenChange={onModalOpenChange}
          pauseVideoPlayback={pauseVideoPlayback}
        />
      ) : (
        <div className="dashboard-tutorial-grid-placeholder" aria-hidden="true" />
      )}
    </section>
  );
}
