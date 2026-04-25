/**
 * Shared settings workspace shell for the profile route.
 * Aligns account settings chrome with the rest of the authenticated workspace surfaces.
 */
import Link from "next/link";
import { SignOut } from "phosphor-react";
import type { ReactNode } from "react";
import type { NoticeState, ProfileSection, ProfileSectionItem } from "../profilePageModel";

type ProfileWorkspaceShellProps = {
  displayName: string;
  displayInitials: string;
  planLabel: string;
  planClass: string;
  subscriptionStatusLabel: string;
  workspaceEmail: string;
  section: ProfileSection;
  sections: readonly ProfileSectionItem[];
  title: string;
  body: string;
  notice: NoticeState | null;
  onRequestLogout: () => void;
  children: ReactNode;
};

/**
 * Renders the shared profile-page shell, section navigation, and status notice.
 */
export function ProfileWorkspaceShell({
  displayName,
  displayInitials,
  planLabel,
  planClass,
  subscriptionStatusLabel,
  workspaceEmail,
  section,
  sections,
  title,
  body,
  notice,
  onRequestLogout,
  children,
}: ProfileWorkspaceShellProps) {
  return (
    <section className="profile-workspace">
      <header className="app-bar profile-app-bar">
        <div className="profile-app-bar-main">
          <Link href="/dashboard" className="ghost-btn profile-app-bar-back">
            Back to dashboard
          </Link>
          <div className="profile-identity">
            <div className="profile-avatar-chip profile-avatar-chip-lg">{displayInitials}</div>
            <div className="profile-identity-copy">
              <p className="eyebrow">Settings workspace</p>
              <h1>{title}</h1>
              <p className="subdued">{body}</p>
            </div>
          </div>
        </div>

        <div className="app-bar-right profile-app-bar-right">
          <div className="header-cards profile-header-cards">
            <div className="header-stat-card profile-header-card" aria-label="Plan status">
              <div className="profile-header-card-copy">
                <p className="metric-label tiny subdued">Plan</p>
                <p className={`profile-header-card-value ${planClass}`}>{planLabel}</p>
                <p className="tiny subdued">{displayName}</p>
              </div>
            </div>
            <div className="header-stat-card profile-header-card" aria-label="Billing status">
              <div className="profile-header-card-copy">
                <p className="metric-label tiny subdued">Billing</p>
                <p className="profile-header-card-value">{subscriptionStatusLabel}</p>
                <p className="tiny subdued">{workspaceEmail || "No email on file"}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="ghost-btn profile-shell-action"
            onClick={onRequestLogout}
          >
            <SignOut size={16} weight="bold" />
            Log out
          </button>
        </div>
      </header>

      <nav className="panel profile-section-tabs-panel" aria-label="Settings sections">
        <div className="profile-section-tabs">
          {sections.map((item) => {
            const isActive = section === item.key;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={`/profile?section=${item.key}`}
                className={`profile-section-tab ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="profile-section-tab-icon">
                  <Icon size={18} weight={isActive ? "bold" : "regular"} />
                </span>
                <span className="profile-section-tab-label">{item.label}</span>
              </Link>
            );
          })}
        </div>
        {notice ? (
          <p className={`tiny profile-notice profile-notice-${notice.tone}`} role="status">
            {notice.message}
          </p>
        ) : null}
      </nav>

      <div className="profile-workspace-body">{children}</div>
    </section>
  );
}
