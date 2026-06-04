/**
 * Shared settings workspace shell for the profile route.
 * Aligns account settings chrome with the rest of the authenticated workspace surfaces.
 */
import Image from "next/image";
import Link from "next/link";
import { SignOut } from "phosphor-react";
import type { ReactNode } from "react";
import type { NoticeState, ProfileSection, ProfileSectionItem } from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";

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
    <section className={profileClass("profile-workspace")}>
      <header className={profileClass("app-bar", "profile-app-bar")}>
        <div className={profileClass("profile-app-bar-main")}>
          <div className={profileClass("profile-identity")}>
            <div className={profileClass("profile-avatar-chip", "profile-avatar-chip-lg")}>
              {displayInitials}
            </div>
            <div className={profileClass("profile-identity-copy")}>
              <p className="eyebrow">Settings workspace</p>
              <h1>{title}</h1>
              <p className="subdued">{body}</p>
            </div>
          </div>
        </div>
      </header>

      <div className={profileClass("profile-workspace-layout")}>
        <aside
          className={profileClass("panel", "profile-side-rail")}
          aria-label="Settings sections"
        >
          <div className={profileClass("profile-side-rail-main")}>
            <Link
              href="/"
              className={profileClass("profile-rail-brand")}
              aria-label="ShortPulse home"
            >
              <Image
                src="/small good d.png"
                alt="ShortPulse logo"
                className={profileClass("profile-rail-brand-logo")}
                width={160}
                height={44}
                style={{ height: "auto" }}
              />
            </Link>

            <Link
              href="/dashboard"
              className={profileClass(
                "ghost-btn",
                "profile-shell-action",
                "profile-shell-nav-action",
                "profile-side-rail-action"
              )}
            >
              Back to dashboard
            </Link>

            <nav className={profileClass("profile-section-tabs")} aria-label="Settings sections">
              {sections.map((item) => {
                const isActive = section === item.key;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={`/profile?section=${item.key}`}
                    className={profileClass("profile-section-tab", isActive && "is-active")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className={profileClass("profile-section-tab-icon")}>
                      <Icon size={18} weight={isActive ? "bold" : "regular"} />
                    </span>
                    <span className={profileClass("profile-section-tab-label")}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              className={profileClass(
                "ghost-btn",
                "profile-shell-action",
                "profile-shell-nav-action",
                "profile-side-rail-action"
              )}
              onClick={onRequestLogout}
            >
              <SignOut size={16} weight="bold" />
              Log out
            </button>
          </div>

          <div className={profileClass("profile-side-rail-footer")}>
            {notice ? (
              <p
                className={profileClass("tiny", "profile-notice", `profile-notice-${notice.tone}`)}
                role="status"
              >
                {notice.message}
              </p>
            ) : null}
          </div>
        </aside>

        <div className={profileClass("profile-workspace-body")}>{children}</div>
      </div>
    </section>
  );
}
