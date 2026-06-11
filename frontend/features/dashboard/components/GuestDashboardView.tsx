/**
 * Guest-mode dashboard content.
 * Presents the public dashboard hero and guest CTA card.
 */
import { Plus } from "phosphor-react";
import { DashboardQuickActionCard } from "./DashboardQuickActionCard";
import { DashboardTutorialGrid, type DashboardTutorial } from "./DashboardTutorialGrid";
import { buildPricingPath } from "../../pricing/paths";

type GuestDashboardViewProps = {
  createProjectHref: string;
  dashboardTutorials: DashboardTutorial[];
};

/**
 * Renders the public guest dashboard mode.
 */
export function GuestDashboardView({
  createProjectHref,
  dashboardTutorials,
}: GuestDashboardViewProps) {
  const tutorialLaunchHref = buildPricingPath({ intent: "tutorial" });

  return (
    <>
      <section className="dashboard-hero minimal-hero">
        <div className="hero-primary">
          <div className="hero-copy">
            <h1>
              The creative studio for <span>AI creators</span>
            </h1>
            <p className="hero-subtext">
              Watch a quick walkthrough, then build the image, video, character, or edit workflow
              you need in one focused workspace.
            </p>
          </div>

          <div className="hero-quick-row">
            <DashboardQuickActionCard
              ariaLabel="New Project: Compare plans and unlock your first project"
              className="hero-onboarding hero-new-project-card"
              title="New Project"
              helperText="Compare plans to unlock your first project"
              href={createProjectHref}
              icon={<Plus size={30} weight="bold" className="hero-new-project-icon" />}
            />
          </div>
        </div>
      </section>

      {dashboardTutorials.length > 0 ? (
        <section
          className="dashboard-tutorials-section"
          aria-labelledby="dashboard-tutorials-heading"
        >
          <div className="dashboard-section-header">
            <div>
              <p className="eyebrow tiny">Quick-start tutorials</p>
              <h2 id="dashboard-tutorials-heading">Pick a workflow and start creating</h2>
            </div>
          </div>
          <DashboardTutorialGrid tutorials={dashboardTutorials} launchHref={tutorialLaunchHref} />
        </section>
      ) : null}
    </>
  );
}
