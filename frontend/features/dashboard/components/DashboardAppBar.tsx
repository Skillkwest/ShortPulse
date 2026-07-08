/**
 * Shared dashboard application bar for guest and authenticated dashboard modes.
 * Renders brand navigation, top stat/promotional cards, and the session-specific action area.
 */
import Image from "next/image";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";

type DashboardAppBarCard = {
  key: string;
  label: string;
  value: string;
  valueNode?: ReactNode;
  icon?: ElementType;
  iconSrc?: string;
  className?: string;
  href?: string;
  target?: string;
  rel?: string;
};

type DashboardAppBarProps = {
  cards: readonly DashboardAppBarCard[];
  actionSlot: ReactNode;
  brandHref?: string | null;
};

const formatCardAriaValue = (value: string): string => value.replace(/\s+/g, " ").trim();

/**
 * Renders the dashboard app bar with a shared visual shell.
 */
export function DashboardAppBar({ cards, actionSlot, brandHref = "/" }: DashboardAppBarProps) {
  const brandLogo = (
    <>
      <Image
        src="/small good d.png"
        alt="ShortPulse logo"
        className="brand-logo"
        width={203}
        height={64}
        style={{ height: "auto" }}
      />
      <span className="brand-name">ShortPulse</span>
    </>
  );

  return (
    <header className="app-bar">
      {brandHref ? (
        <Link
          href={brandHref}
          className="brand-mark brand-mark-logo"
          aria-label="ShortPulse home"
          prefetch={false}
        >
          {brandLogo}
        </Link>
      ) : (
        <div className="brand-mark brand-mark-logo">{brandLogo}</div>
      )}

      <div className="app-bar-right">
        <div className="header-cards">
          {cards.map((item) => {
            const itemAriaValue = formatCardAriaValue(item.value);
            const cardBody = (
              <>
                <div className="status-icon compact">
                  {item.iconSrc ? (
                    <Image
                      src={item.iconSrc}
                      alt=""
                      aria-hidden="true"
                      className="header-stat-card-icon-image"
                      width={96}
                      height={96}
                      unoptimized
                    />
                  ) : item.icon ? (
                    <item.icon size={16} weight="bold" />
                  ) : null}
                </div>
                <div className="header-card-body">
                  <p className="metric-label tiny">{item.label}</p>
                  <p className={`status-value small ${item.className ?? ""}`}>
                    {item.valueNode ?? item.value}
                  </p>
                </div>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="header-stat-card header-stat-card-link"
                  aria-label={`${item.label}: ${itemAriaValue}`}
                  prefetch={false}
                  target={item.target}
                  rel={item.rel}
                >
                  {cardBody}
                </Link>
              );
            }

            return (
              <div key={item.key} className="header-stat-card" role="status" aria-live="polite">
                {cardBody}
              </div>
            );
          })}
        </div>

        {actionSlot}
      </div>
    </header>
  );
}
