/**
 * Shared profile workspace primitives.
 * Keeps account-page sections visually consistent while section components own their actions.
 */
import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "phosphor-react";
import { AppMessage } from "../../../components/AppMessage";
import type { NoticeState } from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";

type ProfilePanelProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon?: ComponentType<IconProps>;
  className?: string;
  headerAction?: ReactNode;
  children?: ReactNode;
};

type ProfileMetricCardProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

type ProfileExplainerProps = {
  summary: string;
  children: ReactNode;
};

type ProfileNoticeBannerProps = {
  notice: NoticeState | null;
};

/**
 * Renders a reusable section panel with consistent header and optional action slot.
 */
export function ProfilePanel({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  className,
  headerAction,
  children,
}: ProfilePanelProps) {
  return (
    <section id={id} className={profileClass("panel", "profile-panel", className)}>
      <div className={profileClass("panel-header", "profile-panel-header")}>
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className={profileClass("profile-panel-title")}>{title}</h2>
          {description ? <p className="subdued tiny">{description}</p> : null}
        </div>
        {headerAction ? (
          <div className={profileClass("profile-panel-header-action")}>{headerAction}</div>
        ) : Icon ? (
          <span className={profileClass("profile-panel-icon-chip")} aria-hidden="true">
            <Icon size={18} weight="bold" />
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Renders one compact account metric for hero and summary areas.
 */
export function ProfileMetricCard({ label, value, className }: ProfileMetricCardProps) {
  return (
    <div className={profileClass("profile-metric-card", className)}>
      <p className={profileClass("profile-metric-label")}>{label}</p>
      <p className={profileClass("profile-metric-value")}>{value}</p>
    </div>
  );
}

/**
 * Renders an expandable helper note for billing/account concepts.
 */
export function ProfileExplainer({ summary, children }: ProfileExplainerProps) {
  return (
    <details className={profileClass("panel", "profile-detail-panel", "profile-billing-how")}>
      <summary>{summary}</summary>
      <div className={profileClass("profile-explainer-body")}>{children}</div>
    </details>
  );
}

/**
 * Renders route-level notices in the content area where follow-up actions happen.
 */
export function ProfileNoticeBanner({ notice }: ProfileNoticeBannerProps) {
  if (!notice) return null;

  return (
    <AppMessage
      className={profileClass("profile-notice-banner", `profile-notice-banner-${notice.tone}`)}
      tone={notice.tone}
      mode="banner"
      message={notice.message}
    />
  );
}
