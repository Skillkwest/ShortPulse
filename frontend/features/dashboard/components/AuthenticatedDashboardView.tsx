/**
 * Authenticated dashboard content.
 * Preserves the current workspace-focused hero, announcement slot, and project actions.
 */
import Image from "next/image";
import Link from "next/link";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { IconProps } from "phosphor-react";
import { FolderSimple, Plus } from "phosphor-react";
import { AppMessage } from "../../../components/AppMessage";
import { DashboardQuickActionCard } from "./DashboardQuickActionCard";
import { type DashboardTutorial } from "./DashboardTutorialGrid";
import { PublicHomeCommunitySection } from "./PublicHomeCommunitySection";
import { PublicHomeFooter } from "./PublicHomeFooter";
import { PublicHomeTutorialShowcase } from "./PublicHomeTutorialShowcase";
import { PublicHomeVideoGallery } from "./PublicHomeVideoGallery";
import { SHORTPULSE_COMMUNITY_URL } from "../communityLinks";

export type DashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

export type DashboardToolCard = {
  title: string;
  eyebrow?: string;
  description: string;
  href: string;
  cta: string;
  variant: string;
  image?: string;
  icon?: IconComponent;
  disabled?: boolean;
};

type AuthenticatedDashboardViewProps = {
  dashboardAnnouncement: DashboardAnnouncement | null;
  dashboardFallbackHelperCopy: string;
  dashboardTutorials: DashboardTutorial[];
  firstName: string;
  hideLegacySections: boolean;
  isCreatingProject: boolean;
  projectCreateError: string | null;
  toolCards: readonly DashboardToolCard[];
  onCreateProject: () => void;
  onOpenProjects: () => void;
};

/**
 * Renders the authenticated dashboard mode.
 */
export function AuthenticatedDashboardView({
  dashboardAnnouncement,
  dashboardFallbackHelperCopy,
  dashboardTutorials,
  firstName,
  hideLegacySections,
  isCreatingProject,
  projectCreateError,
  toolCards,
  onCreateProject,
  onOpenProjects,
}: AuthenticatedDashboardViewProps) {
  return (
    <>
      <section className="dashboard-hero minimal-hero">
        <div className="hero-primary authenticated-home-hero-primary">
          <div className="authenticated-home-hero-bg" aria-hidden="true" />
          <div className="hero-copy authenticated-home-hero-copy">
            <p className="eyebrow tiny authenticated-home-kicker">ShortPulse dashboard</p>
            <h1>
              Welcome back, <span>{firstName}</span>.
            </h1>
            {dashboardAnnouncement ? (
              <AppMessage
                className="hero-announcement"
                tone="info"
                mode="banner"
                title={dashboardAnnouncement.title}
                message={dashboardAnnouncement.message}
              />
            ) : (
              <p className="hero-subtext">{dashboardFallbackHelperCopy}</p>
            )}
          </div>

          <div className="hero-visual">
            <Image
              src="/dashboard/welcome-art.png"
              alt="Dashboard visual"
              className="hero-graphic"
              width={960}
              height={540}
            />
          </div>

          <div className="hero-quick-row authenticated-home-quick-row">
            <DashboardQuickActionCard
              ariaLabel="New Project: Name and create a new project"
              className="hero-onboarding hero-new-project-card"
              title="New Project"
              helperText={
                isCreatingProject
                  ? "Creating your project..."
                  : projectCreateError
                    ? projectCreateError
                    : "Name your project and open AI Studio"
              }
              onClick={onCreateProject}
              disabled={isCreatingProject}
              busy={isCreatingProject}
              icon={<Plus size={30} weight="bold" className="hero-new-project-icon" />}
            />

            <DashboardQuickActionCard
              ariaLabel="Open Projects: Open saved projects"
              className="hero-sessions-group hero-sessions-group-button hero-open-projects-card"
              title="Open Projects"
              helperText="Open the project library"
              onClick={onOpenProjects}
              icon={<FolderSimple size={30} weight="duotone" className="hero-open-projects-icon" />}
            />
          </div>
        </div>
      </section>

      <PublicHomeTutorialShowcase tutorials={dashboardTutorials} launchHref="/ai-studio" />

      <PublicHomeCommunitySection communityHref={SHORTPULSE_COMMUNITY_URL} />

      <PublicHomeVideoGallery loginHref="/profile?section=account" signupHref="/ai-studio" />

      {!hideLegacySections ? (
        <section className="tools-section" aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="eyebrow">
            Tools
          </h2>
          <div className="tool-card-grid">
            {toolCards.map((tool) => (
              <Link
                href={tool.href}
                key={tool.title}
                className={`tool-card ${tool.variant ?? ""} ${tool.disabled ? "is-disabled" : ""}`}
                aria-disabled={tool.disabled}
                tabIndex={tool.disabled ? -1 : undefined}
                role="article"
                aria-label={`${tool.title}: ${tool.description}`}
                prefetch={false}
              >
                {tool.image ? (
                  <div className="tool-card-hero">
                    <Image
                      src={tool.image}
                      alt={`${tool.title} visual`}
                      width={1200}
                      height={300}
                      unoptimized
                    />
                  </div>
                ) : null}
                <div className="tool-card-body">
                  {tool.eyebrow ? <p className="tool-card-eyebrow">{tool.eyebrow}</p> : null}
                  <div className="tool-card-title-row">
                    <h3>{tool.title}</h3>
                    {tool.icon ? (
                      <span className="tool-card-title-icon" aria-hidden="true">
                        <tool.icon size={19} weight="duotone" />
                      </span>
                    ) : null}
                  </div>
                  <p>{tool.description}</p>
                </div>
                <div className="tool-card-footer">{tool.cta}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!hideLegacySections ? (
        <div className="footer">
          ShortPulse keeps your performance data and media private to your account.
        </div>
      ) : null}

      <PublicHomeFooter
        createProjectHref="/ai-studio"
        communityHref={SHORTPULSE_COMMUNITY_URL}
        footerLoginHref="/profile?section=account"
        footerPricingHref="/profile?section=subscription"
        launchAppLabel="Open AI Studio"
        footerPricingLabel="Subscription"
        footerLoginLabel="Account"
      />
    </>
  );
}
