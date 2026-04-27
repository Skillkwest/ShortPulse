/**
 * Shared dashboard quick-action card.
 * Preserves the existing dashboard hero-card layout for links and buttons.
 */
import Link from "next/link";
import type { ReactNode } from "react";

type DashboardQuickActionCardProps = {
  ariaLabel: string;
  className: string;
  title: string;
  helperText: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
};

/**
 * Renders one dashboard hero quick-action card.
 */
export function DashboardQuickActionCard({
  ariaLabel,
  className,
  title,
  helperText,
  icon,
  href,
  onClick,
  disabled = false,
  busy = false,
}: DashboardQuickActionCardProps) {
  const content = (
    <span className="hero-new-project-content">
      <span className="hero-new-project-icon-column" aria-hidden="true">
        {icon}
      </span>
      <span className="hero-new-project-text-column">
        <span className="hero-new-project-label">{title}</span>
        <p className="hero-new-project-helper">{helperText}</p>
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
    >
      {content}
    </button>
  );
}
