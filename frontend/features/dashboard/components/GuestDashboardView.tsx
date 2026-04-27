/**
 * Guest-mode dashboard content.
 * Presents the public dashboard hero and guest CTA card.
 */
import Link from "next/link";
import { Plus } from "phosphor-react";
import { DashboardQuickActionCard } from "./DashboardQuickActionCard";

type GuestDashboardViewProps = {
  createProjectHref: string;
};

/**
 * Renders the public guest dashboard mode.
 */
export function GuestDashboardView({ createProjectHref }: GuestDashboardViewProps) {
  return (
    <>
      <section className="dashboard-hero minimal-hero">
        <div className="hero-primary">
          <div className="hero-copy">
            <h1>
              Build faster with <span>ShortPulse</span>
            </h1>
            <p className="hero-subtext">
              Start from the dashboard, compare live plans, and unlock the AI Studio when you are
              ready to create your first saved project.
            </p>

            <div className="dashboard-guest-strip">
              <div className="dashboard-guest-strip-copy">
                <p className="eyebrow">Public dashboard</p>
                <p className="dashboard-guest-strip-title">
                  Your home, landing page, and workspace entry are now one surface.
                </p>
              </div>
              <Link href="/pricing" className="ghost-btn small">
                Explore pricing
              </Link>
            </div>
          </div>

          <div className="hero-quick-row">
            <DashboardQuickActionCard
              ariaLabel="New Project: Open the AI Studio"
              className="hero-onboarding hero-new-project-card"
              title="New Project"
              helperText="Open the AI Studio"
              href={createProjectHref}
              icon={<Plus size={30} weight="bold" className="hero-new-project-icon" />}
            />
          </div>
        </div>
      </section>
    </>
  );
}
