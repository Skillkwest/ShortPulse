/**
 * Reusable dashboard navigation link prefab.
 * Provides a consistent back-to-dashboard control across workspace surfaces.
 */
import Link from "next/link";
import type { LinkProps } from "next/link";
import { House } from "phosphor-react";
import type { ReactNode } from "react";

type DashboardNavPrefabVariant = "rail" | "inline";

type DashboardNavPrefabProps = {
  href?: LinkProps["href"];
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
  icon?: ReactNode;
  variant?: DashboardNavPrefabVariant;
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

  return (
    <Link href={href} className={classes} aria-label={resolvedAriaLabel}>
      {icon ?? <House size={16} weight="regular" />}
      {label}
    </Link>
  );
}
