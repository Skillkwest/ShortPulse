/**
 * Reusable dashboard navigation link prefab.
 * Provides a consistent back-to-dashboard control across workspace surfaces.
 */
import Link from "next/link";
import type { LinkProps } from "next/link";
import { House } from "phosphor-react";
import type { ReactNode } from "react";

type DashboardNavPrefabVariant = "rail" | "inline";
type DashboardNavNavigationMode = "client" | "assign";

type DashboardNavPrefabProps = {
  href?: LinkProps["href"];
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
  icon?: ReactNode;
  variant?: DashboardNavPrefabVariant;
  navigationMode?: DashboardNavNavigationMode;
};

const DEFAULT_LABEL = "Dashboard";

/**
 * Render the canonical dashboard navigation control using the AI Studio rail button pattern.
 */
export function DashboardNavPrefab({
  href = "/dashboard",
  label = DEFAULT_LABEL,
  ariaLabel,
  className = "",
  icon,
  variant = "rail",
  navigationMode = "client",
}: DashboardNavPrefabProps) {
  const resolvedAriaLabel = ariaLabel ?? (typeof label === "string" ? label : DEFAULT_LABEL);
  const classes = [
    "ghost-btn",
    "small",
    "dashboard-nav-prefab",
    `dashboard-nav-prefab--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const assignHref = typeof href === "string" ? href : null;

  if (navigationMode === "assign" && assignHref) {
    return (
      <a
        href={assignHref}
        className={classes}
        aria-label={resolvedAriaLabel}
        onClick={(event) => {
          event.preventDefault();
          window.location.assign(assignHref);
        }}
      >
        {icon ?? <House size={16} weight="regular" />}
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} aria-label={resolvedAriaLabel}>
      {icon ?? <House size={16} weight="regular" />}
      {label}
    </Link>
  );
}
