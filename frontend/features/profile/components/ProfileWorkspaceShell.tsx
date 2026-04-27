/**
 * Shared settings workspace shell for the profile route.
 * Aligns account settings chrome with the rest of the authenticated workspace surfaces.
 */
import Image from "next/image";
import Link from "next/link";
import { SignOut } from "phosphor-react";
import type { ReactNode } from "react";
import type { NoticeState, ProfileSection, ProfileSectionItem } from "../profilePageModel";

type ProfileWorkspaceShellProps = {
  displayInitials: string;
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
  displayInitials,
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
          <div className="profile-identity">
            <div className="profile-avatar-chip profile-avatar-chip-lg">{displayInitials}</div>
            <div className="profile-identity-copy">
              <p className="eyebrow">Settings workspace</p>
              <h1>{title}</h1>
              <p className="subdued">{body}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="profile-workspace-layout">
        <aside className="panel profile-side-rail" aria-label="Settings sections">
          <div className="profile-side-rail-main">
            <Link href="/" className="profile-rail-brand" aria-label="ShortPulse home">
              <Image
                src="/small good d.png"
                alt="ShortPulse logo"
                className="profile-rail-brand-logo"
                width={160}
                height={44}
                style={{ height: "auto" }}
              />
            </Link>

            <Link
              href="/dashboard"
              className="ghost-btn profile-shell-action profile-shell-nav-action profile-side-rail-action"
            >
              Back to dashboard
            </Link>

            <nav className="profile-section-tabs" aria-label="Settings sections">
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
            </nav>

            <button
              type="button"
              className="ghost-btn profile-shell-action profile-shell-nav-action profile-side-rail-action"
              onClick={onRequestLogout}
            >
              <SignOut size={16} weight="bold" />
              Log out
            </button>
          </div>

          <div className="profile-side-rail-footer">
            {notice ? (
              <p className={`tiny profile-notice profile-notice-${notice.tone}`} role="status">
                {notice.message}
              </p>
            ) : null}
          </div>
        </aside>

        <div className="profile-workspace-body">{children}</div>
      </div>
    </section>
  );
}
