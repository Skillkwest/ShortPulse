/**
 * Shared dashboard application bar for guest and authenticated dashboard modes.
 * Renders brand navigation, top stat/promotional cards, and the session-specific action area.
 */
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { IconProps } from "phosphor-react";

type DashboardAppBarCard = {
  key: string;
  label: string;
  value: string;
  icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  className?: string;
  href?: string;
};

type DashboardAppBarProps = {
  cards: readonly DashboardAppBarCard[];
  actionSlot: ReactNode;
};

/**
 * Renders the dashboard app bar with a shared visual shell.
 */
export function DashboardAppBar({ cards, actionSlot }: DashboardAppBarProps) {
  return (
    <header className="app-bar">
      <Link href="/" className="brand-mark brand-mark-logo" aria-label="ShortPulse home">
        <Image
          src="/small good d.png"
          alt="ShortPulse logo"
          className="brand-logo"
          width={203}
          height={64}
          style={{ height: "auto" }}
        />
      </Link>

      <div className="app-bar-right">
        <div className="header-cards">
          {cards.map((item) => {
            const cardBody = (
              <>
                <div className="status-icon compact">
                  <item.icon size={16} weight="bold" />
                </div>
                <div className="header-card-body">
                  <p className="metric-label tiny">{item.label}</p>
                  <p className={`status-value small ${item.className ?? ""}`}>{item.value}</p>
                </div>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="header-stat-card header-stat-card-link"
                  aria-label={`${item.label}: ${item.value}`}
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
