/**
 * Performance analytics page.
 * Renders the sample cohort experience until backend ingestion is wired, coordinating filters, scoring, and detail modals.
 * Delegates data shaping to feature modules so the page stays focused on orchestration.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, CaretDown, MagnifyingGlass } from "phosphor-react";

import { CompactVideoCard } from "../features/performance/components/CompactVideoCard";
import { CohortAnalyticsSection } from "../features/performance/components/CohortAnalyticsSection";
import { PrimaryFilterBar, ThresholdFilterBar } from "../features/performance/components/FilterBars";
import { VideoDetailModal } from "../features/performance/components/VideoDetailModal";
import { SCRAPE_NOTE } from "../features/performance/constants";
import { TRENDING_VIDEOS } from "../features/performance/data/sampleVideos";
import { pickSelectedVideo } from "../features/performance/logic/analytics";
import { filterAndScoreVideos } from "../features/performance/logic/scoring";
import { CategoryFilter, DateRange, PlatformFilter, ScoredVideo, TrendDirection, TrendingVideo } from "../features/performance/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SortKey = "score" | "views" | "outlier" | "views_per_hour" | "engagement_rate";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Performance score" },
  { key: "views", label: "Views" },
  { key: "outlier", label: "Outlier" },
  { key: "views_per_hour", label: "Velocity" },
  { key: "engagement_rate", label: "Engagement rate" },
];

const jitterMultiplier = (version: number, index: number) => {
  const base = Math.sin(version * 97 + index * 17) * 10000;
  const fraction = base - Math.floor(base);
  return 0.9 + fraction * 0.35; // 0.9–1.25 swing per refresh
};

const percentile = (value: number, sorted: number[]) => {
  if (!sorted.length) return 0;
  const count = sorted.filter((v) => v <= value).length;
  return Number(((count / sorted.length) * 100).toFixed(1));
};

const rebuildDemoVideos = (seed: number, timestamp: number): TrendingVideo[] => {
  const adjusted = TRENDING_VIDEOS.map((video, index) => {
    const multiplier = jitterMultiplier(seed, index);
    const views = Math.max(1, Math.round(video.views * multiplier));
    const likes = Math.max(1, Math.round(video.likes * (0.9 + multiplier * 0.15)));
    const comments = Math.max(0, Math.round(video.comments * (0.9 + multiplier * 0.12)));
    const sharesOrSaves = Math.max(0, Math.round((video.shares_or_saves || 0) * (0.85 + multiplier * 0.12)));
    const publishTime = new Date(video.publish_time).getTime();
    const hoursSincePublish = Math.max(1, (timestamp - publishTime) / (1000 * 60 * 60));
    const viewsPerHour = views / hoursSincePublish;
    const engagementRate = views ? (likes + comments + sharesOrSaves) / views : 0;
    const trendDirection: TrendDirection =
      multiplier > 1.08 ? "up" : multiplier < 0.94 ? "down" : "stable";

    return {
      ...video,
      views,
      likes,
      comments,
      shares_or_saves: sharesOrSaves,
      hours_since_publish: hoursSincePublish,
      views_per_hour: viewsPerHour,
      engagement_rate: engagementRate,
      latest_scraped_at: new Date(timestamp).toISOString(),
      trend_direction: trendDirection,
    };
  });

  const sortedViews = [...adjusted].map((v) => v.views).sort((a, b) => a - b);
  const sortedVelocity = [...adjusted].map((v) => v.views_per_hour).sort((a, b) => a - b);
  const sortedEngagement = [...adjusted].map((v) => v.engagement_rate).sort((a, b) => a - b);

  const withPercentiles = adjusted.map((video) => {
    const viewsPercentile = percentile(video.views, sortedViews);
    const velocityPercentile = percentile(video.views_per_hour, sortedVelocity);
    const engagementPercentile = percentile(video.engagement_rate, sortedEngagement);
    const performanceScore = Number(
      (0.45 * engagementPercentile + 0.4 * velocityPercentile + 0.15 * viewsPercentile).toFixed(1),
    );

    return {
      ...video,
      views_percentile: viewsPercentile,
      views_per_hour_percentile: velocityPercentile,
      engagement_rate_percentile: engagementPercentile,
      performance_score: performanceScore,
    };
  });

  const ranked = [...withPercentiles].sort((a, b) => b.performance_score - a.performance_score);
  const rankMap = new Map(ranked.map((row, index) => [row.reel_id, index + 1]));

  return withPercentiles.map((video) => ({
    ...video,
    rank: rankMap.get(video.reel_id) ?? video.rank,
  }));
};

/**
 * Public-facing performance analytics view for demo data.
 */
export default function PerformanceAnalyticsPage() {
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [selectedId, setSelectedId] = useState<string>();
  const [outliersOnly, setOutliersOnly] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [minViews, setMinViews] = useState<string>("");
  const [minLikes, setMinLikes] = useState<string>("");
  const [minFollowers, setMinFollowers] = useState<string>("");
  const [maxFollowers, setMaxFollowers] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortOpen, setSortOpen] = useState(false);
  const [seedTimestamp] = useState(() => Date.now());
  const sortRef = useRef<HTMLDivElement>(null);
  const planSearchLimit = 100;
  const searchesRemaining = 72;
  const planName = "Creative Suite";
  const [dataVersion, setDataVersion] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(() => new Date(seedTimestamp).toISOString());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const recalculatedVideos = useMemo(
    () => rebuildDemoVideos(dataVersion, seedTimestamp + dataVersion * 500),
    [dataVersion, seedTimestamp],
  );

  const dataset = useMemo(
    () =>
      filterAndScoreVideos({
        videos: recalculatedVideos,
        dateRange,
        platform,
        categoryFilter,
        outliersOnly,
      }),
    [recalculatedVideos, dateRange, platform, categoryFilter, outliersOnly],
  );

  useEffect(() => {
    if (!sortOpen) return undefined;
    const handleOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [sortOpen]);

  const sortedDataset = useMemo(() => {
    const sorted = [...dataset];
    const comparator = (a: ScoredVideo, b: ScoredVideo) => {
      const getMetric = (video: ScoredVideo) => {
        switch (sortKey) {
          case "views":
            return video.views;
          case "outlier":
            return video.outlierMultiplier;
          case "views_per_hour":
            return video.views_per_hour;
          case "engagement_rate":
            return video.engagement_rate;
          default:
            return video.performance_score;
        }
      };
      const metricA = getMetric(a);
      const metricB = getMetric(b);
      if (metricA === metricB) {
        return a.rank - b.rank;
      }
      return (metricB ?? 0) - (metricA ?? 0);
    };
    return sorted.sort(comparator);
  }, [dataset, sortKey]);

  useEffect(() => {
    if (!dataset.length) {
      setSelectedId(undefined);
      setShowDetail(false);
      return;
    }
    if (selectedId && !dataset.find((v) => v.reel_id === selectedId)) {
      setSelectedId(dataset[0].reel_id);
    }
  }, [dataset, selectedId]);

  const selectedVideo = useMemo(() => pickSelectedVideo(dataset, selectedId), [dataset, selectedId]);
  const currentSortLabel = SORT_OPTIONS.find((item) => item.key === sortKey)?.label ?? "Performance score";

  const handleSelectVideo = (video: ScoredVideo) => {
    setSelectedId(video.reel_id);
    setShowDetail(true);
  };

  const handleClearThresholds = () => {
    setMinViews("");
    setMinLikes("");
    setMinFollowers("");
    setMaxFollowers("");
  };

  const formatActionTime = (iso: string | null) => {
    if (!iso) return "Ready to refresh demo data";
    const date = new Date(iso);
    return `Last refresh ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const formatActionDateTime = (iso: string | null) => {
    if (!iso) return "No refresh yet";
    const date = new Date(iso);
    return `Last refresh ${date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await sleep(450);
    const nowIso = new Date().toISOString();
    setDataVersion((v) => v + 1);
    setLastRefreshAt(nowIso);
    setIsRefreshing(false);
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Performance Analytics</title>
        <meta
          name="description"
          content="Top-performing public videos trending across Instagram, TikTok, and YouTube with velocity, engagement, and completion."
        />
      </Head>
      <main className="page page-wide analytics-page minimal">
        <div className="page-top minimal">
          <Link href="/dashboard" className="ghost-btn small">
            ← Back to dashboard
          </Link>
          <div className="live-indicator">
            <span className="dot" />
            <span className="live-time">{formatActionDateTime(lastRefreshAt)}</span>
          </div>
        </div>

        <section
          className="panel performance-hero-card"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(7, 10, 16, 0.6), rgba(7, 10, 16, 0.75)), url('/dashboard/performance-analytics.png')",
          }}
        >
          <div className="panel-header hero-header">
            <div>
              <h1 className="title">Performance Analytics</h1>
              <p className="subdued">{SCRAPE_NOTE}</p>
            </div>
            <div className="hero-actions">
              <div className="hero-card-row">
                <div className="header-stat-card" aria-label="Searches left" role="status">
                  <div className="status-icon compact" aria-hidden="true">
                    <MagnifyingGlass size={16} weight="bold" />
                  </div>
                  <div className="header-card-body">
                    <p className="metric-label tiny">Searches left</p>
                    <p className="status-value small">
                      {searchesRemaining} / {planSearchLimit}
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
                    <p className="metric-label subtle">Plan</p>
                    <p className="search-usage-value plan-value">{planName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PrimaryFilterBar
          dateRange={dateRange}
          platform={platform}
          categoryFilter={categoryFilter}
          outliersOnly={outliersOnly}
          onDateChange={setDateRange}
          onPlatformChange={setPlatform}
          onCategoryChange={setCategoryFilter}
          onToggleOutliers={() => setOutliersOnly((v) => !v)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          resultsCount={sortedDataset.length}
        />

        <ThresholdFilterBar
          minViews={minViews}
          minLikes={minLikes}
          minFollowers={minFollowers}
          maxFollowers={maxFollowers}
          onMinViewsChange={setMinViews}
          onMinLikesChange={setMinLikes}
          onMinFollowersChange={setMinFollowers}
          onMaxFollowersChange={setMaxFollowers}
          onClear={handleClearThresholds}
        />

        <section className="list-section top-videos-card">
          <div className="section-heading minimal">
          <div>
            <p className="eyebrow">Trending</p>
            <h3>Top videos</h3>
            <p className="tiny subdued">Sorted by {currentSortLabel.toLowerCase()}</p>
          </div>
          <div className="section-heading-actions">
            <div className="section-heading-stats">
            </div>
            <div className="sort-picker" ref={sortRef}>
              <span className="sort-side-label">Sort</span>
              <button
                type="button"
                className={`sort-toggle ${sortOpen ? "is-open" : ""}`}
                onClick={() => setSortOpen((prev) => !prev)}
              >
                <span className="sort-name">{currentSortLabel}</span>
                <CaretDown size={14} weight="bold" />
              </button>
              {sortOpen ? (
                <div className="sort-menu">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={sortKey === option.key ? "sort-option is-active" : "sort-option"}
                      onClick={() => {
                        setSortKey(option.key);
                        setSortOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={`primary-btn refresh-button ${isRefreshing ? "is-busy" : ""}`}
              onClick={handleRefreshData}
                disabled={isRefreshing}
              >
                <span className="refresh-icon">
                  <ArrowClockwise size={18} weight="bold" />
                </span>
                <span className="refresh-copy">
                  <span className="refresh-title">{isRefreshing ? "Refreshing…" : "Refresh videos"}</span>
                  <span className="refresh-meta">
                    {isRefreshing ? "Pulling latest demo signals" : formatActionTime(lastRefreshAt)}
                  </span>
                </span>
              </button>
            </div>
          </div>
          {dataset.length ? (
            <div className="compact-grid">
              {sortedDataset.map((video) => (
                <CompactVideoCard key={video.reel_id} video={video} onSelect={handleSelectVideo} />
              ))}
            </div>
          ) : (
            <div className="chart-empty">No videos match the current filters.</div>
          )}
        </section>

        <CohortAnalyticsSection
          dataset={dataset}
          advancedOpen={advancedOpen}
          onToggle={() => setAdvancedOpen((v) => !v)}
        />

        <VideoDetailModal video={selectedVideo} open={showDetail} onClose={() => setShowDetail(false)} />
      </main>
    </>
  );
}
