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

export type DashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type DashboardTutorial = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  thumbnailMediaType: "image" | "video";
  thumbnailAlt: string;
  displayOrder: number;
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
        <div className="hero-primary">
          <div className="hero-copy">
            <h1>
              Welcome back, <span>{firstName}</span>
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

          <div className="hero-quick-row">
            {hideLegacySections ? (
              <>
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
                  icon={
                    <FolderSimple size={30} weight="duotone" className="hero-open-projects-icon" />
                  }
                />
              </>
            ) : (
              <>
                <Link
                  href="/onboarding"
                  className="hero-onboarding"
                  aria-label="Onboarding Courses: Guided walkthroughs for Creator Studio workflows"
                >
                  <div>
                    <p className="eyebrow tiny">Quick start</p>
                    <h3>Onboarding Courses</h3>
                    <p className="subdued tiny">
                      Guided walkthroughs for Creator Studio workflows.
                    </p>
                  </div>
                  <span>Enter →</span>
                </Link>

                <Link
                  href="/onboarding?section=workflows"
                  className="hero-onboarding hero-workflow-card"
                  aria-label="AI Workflow Lessons: Deep dives on creation playbooks and applied prompts"
                >
                  <div>
                    <p className="eyebrow tiny">Workflows</p>
                    <h3>AI Workflow Lessons</h3>
                    <p className="subdued tiny">
                      Deep dives on creation playbooks and applied prompts.
                    </p>
                  </div>
                  <span>Explore →</span>
                </Link>
              </>
            )}
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
              <p className="eyebrow tiny">Tutorial hub</p>
              <h2 id="dashboard-tutorials-heading">Start with a guided walkthrough</h2>
            </div>
          </div>
          <div className="dashboard-tutorial-grid">
            {dashboardTutorials.map((tutorial) => (
              <a
                key={tutorial.id}
                className="dashboard-tutorial-card"
                href={tutorial.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${tutorial.title}: open tutorial on YouTube`}
              >
                <span className="dashboard-tutorial-thumbnail" aria-hidden="true">
                  {tutorial.thumbnailMediaType === "video" ? (
                    <video
                      src={tutorial.thumbnailUrl}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                    />
                  ) : (
                    <span
                      className="dashboard-tutorial-thumbnail-image"
                      style={{ backgroundImage: `url(${JSON.stringify(tutorial.thumbnailUrl)})` }}
                    />
                  )}
                </span>
                <span className="dashboard-tutorial-title">{tutorial.title}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

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
    </>
  );
}
