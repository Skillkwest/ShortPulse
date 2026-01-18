/**
 * Filter bars for the performance analytics page.
 * Separates filter UI from page logic to keep the page focused on orchestration.
 */
import { MagnifyingGlass } from "phosphor-react";
import { DATE_OPTIONS, NICHES } from "../constants";
import { CategoryFilter, DateRange, PlatformFilter } from "../types";

export type PrimaryFilterBarProps = {
  dateRange: DateRange;
  platform: PlatformFilter;
  categoryFilter: CategoryFilter;
  outliersOnly: boolean;
  onDateChange: (value: DateRange) => void;
  onPlatformChange: (value: PlatformFilter) => void;
  onCategoryChange: (value: CategoryFilter) => void;
  onToggleOutliers: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultsCount: number;
};

/**
 * Top-row filters for date range, platform, niches, outliers, and keyword search.
 */
export function PrimaryFilterBar({
  dateRange,
  platform,
  categoryFilter,
  outliersOnly,
  onDateChange,
  onPlatformChange,
  onCategoryChange,
  onToggleOutliers,
  searchTerm,
  onSearchChange,
  resultsCount,
}: PrimaryFilterBarProps) {
  return (
    <section className="filter-bar">
      <div className="filter-group">
        <div className="segmented">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={dateRange === opt.value ? "active" : ""}
              onClick={() => onDateChange(opt.value)}
              aria-pressed={dateRange === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="platform-toggle compact">
          {(["all", "instagram", "tiktok", "youtube"] as PlatformFilter[]).map((value) => (
            <button
              key={value}
              className={`platform-pill small ${platform === value ? "active" : ""}`}
              onClick={() => onPlatformChange(value)}
              aria-pressed={platform === value}
            >
              {value === "all" ? "All" : value === "instagram" ? "Instagram" : value === "tiktok" ? "TikTok" : "YouTube"}
            </button>
          ))}
        </div>
        <div className="pill-select">
          <select
            className="niche-select"
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value as CategoryFilter)}
            aria-label="Select niche"
          >
            <option value="All">All niches</option>
            {NICHES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className={`outlier-btn ${outliersOnly ? "active" : ""}`}
          onClick={onToggleOutliers}
          aria-pressed={outliersOnly}
          title="Outlier = views / platform median"
        >
          Outliers
        </button>
        <div className="search-row">
          <div className="search-chip primary">
            <span className="search-icon" aria-hidden>
              <MagnifyingGlass size={16} weight="bold" />
            </span>
            <input
              type="text"
              placeholder="Search keywords, niches, creators…"
              aria-label="Search"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <span className="pill tiny results-pill filter-results" aria-live="polite">
            {resultsCount} results
          </span>
        </div>
      </div>
    </section>
  );
}

export type ThresholdFilterBarProps = {
  minViews: string;
  minLikes: string;
  minFollowers: string;
  maxFollowers: string;
  onMinViewsChange: (value: string) => void;
  onMinLikesChange: (value: string) => void;
  onMinFollowersChange: (value: string) => void;
  onMaxFollowersChange: (value: string) => void;
  onClear: () => void;
};

/**
 * Secondary filter row for numeric thresholds.
 * Values are managed in the page; currently decorative until wired to backend filtering.
 */
export function ThresholdFilterBar({
  minViews,
  minLikes,
  minFollowers,
  maxFollowers,
  onMinViewsChange,
  onMinLikesChange,
  onMinFollowersChange,
  onMaxFollowersChange,
  onClear,
}: ThresholdFilterBarProps) {
  return (
    <section className="filter-bar sub">
      <div className="filter-group">
        <div className="input-chip">
          <label className="tiny subdued" htmlFor="minViews">
            Min views
          </label>
          <input
            id="minViews"
            type="number"
            placeholder="0"
            value={minViews}
            onChange={(e) => onMinViewsChange(e.target.value)}
          />
        </div>
        <div className="input-chip">
          <label className="tiny subdued" htmlFor="minLikes">
            Min likes
          </label>
          <input
            id="minLikes"
            type="number"
            placeholder="0"
            value={minLikes}
            onChange={(e) => onMinLikesChange(e.target.value)}
          />
        </div>
        <div className="input-chip">
          <label className="tiny subdued" htmlFor="minFollowers">
            Min followers
          </label>
          <input
            id="minFollowers"
            type="number"
            placeholder="0"
            value={minFollowers}
            onChange={(e) => onMinFollowersChange(e.target.value)}
          />
        </div>
        <div className="input-chip">
          <label className="tiny subdued" htmlFor="maxFollowers">
            Max followers
          </label>
          <input
            id="maxFollowers"
            type="number"
            placeholder="Any"
            value={maxFollowers}
            onChange={(e) => onMaxFollowersChange(e.target.value)}
          />
        </div>
      </div>
      <button type="button" className="ghost-btn small clear-btn" onClick={onClear} aria-label="Clear filters">
        Clear
      </button>
    </section>
  );
}
