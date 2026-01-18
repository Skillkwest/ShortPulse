/**
 * Hero/header panel for the Saved Creators page.
 */
import Link from "next/link";
import { PlanUsage, UsageStats } from "../types";

type Props = {
  searchUsage: UsageStats;
  planUsage: PlanUsage;
};

export const SavedCreatorsHeader = ({ searchUsage, planUsage }: Props) => (
  <>
    <div className="saved-top-row">
      <Link href="/dashboard" className="ghost-btn small header-link">
        ← Back to dashboard
      </Link>
    </div>

    <section
      className="panel saved-header-bar saved-hero hero-image-card"
      style={{
        backgroundImage: "url('/Gray.png')",
      }}
    >
      <div className="saved-header-left">
        <div className="saved-title-stack">
          <div className="saved-title-row">
            <h1 className="title">Saved creators</h1>
          </div>
          <p className="subdued">Build a list of creators to follow and surface in your analytics filters.</p>
        </div>
      </div>
      <div className="saved-header-right">
        <div className="search-usage-card" aria-label="Search usage">
          <div className="search-usage-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2.5" y="8.5" width="2.8" height="7" rx="1" stroke="#25A9BF" strokeWidth="1.4" />
              <rect x="7.4" y="5.5" width="2.8" height="10" rx="1" stroke="#25A9BF" strokeWidth="1.4" />
              <rect x="12.3" y="3.5" width="2.8" height="12" rx="1" stroke="#25A9BF" strokeWidth="1.4" />
            </svg>
          </div>
          <div className="search-usage-text">
            <p className="metric-label subtle">Searches</p>
            <p className="search-usage-value">
              {searchUsage.used} / {searchUsage.limit}
            </p>
          </div>
        </div>
        <div className="search-usage-card plan-card" aria-label="Plan status" role="button" tabIndex={0}>
          <div className="search-usage-icon plan-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="7" stroke="#25A9BF" strokeWidth="1.4" />
              <path d="M6.3 9.1 8 10.8 11.7 7" stroke="#25A9BF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="search-usage-text">
            <p className="metric-label subtle">{planUsage.label}</p>
            <p className="search-usage-value plan-value">{planUsage.name}</p>
          </div>
        </div>
      </div>
    </section>
  </>
);
