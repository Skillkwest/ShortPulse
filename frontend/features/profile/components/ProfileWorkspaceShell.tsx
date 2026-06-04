/**
 * Shared settings workspace shell for the profile route.
 * Aligns account settings chrome with the rest of the authenticated workspace surfaces.
 */
import Image from "next/image";
import Link from "next/link";
import { SignOut } from "phosphor-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { NoticeState, ProfileSection, ProfileSectionItem } from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";
import {
  navIconStyle,
  navItemStyle,
  noticeToneColor,
  shellStyles,
  textStyles,
} from "./profileAccountInlineStyles";

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

function useCompactProfileLayout() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth <= 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isCompact;
}

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
  const isCompact = useCompactProfileLayout();

  return (
    <section className={profileClass("profile-workspace")} style={shellStyles.workspace}>
      <header className={profileClass("app-bar", "profile-app-bar")} style={shellStyles.header}>
        <div className={profileClass("profile-app-bar-main")}>
          <div className={profileClass("profile-identity")} style={shellStyles.identity}>
            <div
              className={profileClass("profile-avatar-chip", "profile-avatar-chip-lg")}
              style={shellStyles.avatar}
            >
              {displayInitials}
            </div>
            <div className={profileClass("profile-identity-copy")} style={{ minWidth: 0 }}>
              <p className="eyebrow" style={textStyles.eyebrow}>
                Settings workspace
              </p>
              <h1 style={textStyles.h1}>{title}</h1>
              <p className="subdued" style={textStyles.body}>
                {body}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div
        className={profileClass("profile-workspace-layout")}
        style={isCompact ? shellStyles.layoutCompact : shellStyles.layout}
      >
        <aside
          className={profileClass("panel", "profile-side-rail")}
          style={isCompact ? { ...shellStyles.rail, ...shellStyles.railCompact } : shellStyles.rail}
          aria-label="Settings sections"
        >
          <div className={profileClass("profile-side-rail-main")}>
            <Link
              href="/"
              className={profileClass("profile-rail-brand")}
              style={shellStyles.brand}
              aria-label="ShortPulse home"
            >
              <Image
                src="/small good d.png"
                alt="ShortPulse logo"
                className={profileClass("profile-rail-brand-logo")}
                width={160}
                height={44}
                style={shellStyles.brandLogo}
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
              style={accountLinkStyle}
            >
              Back to dashboard
            </Link>

            <nav
              className={profileClass("profile-section-tabs")}
              style={isCompact ? shellStyles.navCompact : shellStyles.nav}
              aria-label="Settings sections"
            >
              {sections.map((item) => {
                const isActive = section === item.key;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={`/profile?section=${item.key}`}
                    className={profileClass("profile-section-tab", isActive && "is-active")}
                    style={navItemStyle(isActive)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={profileClass("profile-section-tab-icon")}
                      style={navIconStyle(isActive)}
                    >
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
              style={accountButtonStyle}
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
                style={{
                  margin: 0,
                  color: noticeToneColor[notice.tone],
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
                role="status"
              >
                {notice.message}
              </p>
            ) : null}
          </div>
        </aside>

        <div className={profileClass("profile-workspace-body")} style={shellStyles.body}>
          {children}
        </div>
      </div>
    </section>
  );
}

const accountLinkStyle = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 13px",
  borderRadius: 11,
  border: "1px solid rgba(210, 219, 232, 0.16)",
  background: "rgba(222, 229, 238, 0.06)",
  color: "#eef5f8",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 820,
  lineHeight: 1.1,
};

const accountButtonStyle = {
  ...accountLinkStyle,
  width: "100%",
  cursor: "pointer",
};
