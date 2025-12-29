/**
 * Performance analytics page.
 * Renders the sample cohort experience until backend ingestion is wired, coordinating filters, scoring, and detail modals.
 * Delegates data shaping to feature modules so the page stays focused on orchestration.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CompactVideoCard } from "../features/performance/components/CompactVideoCard";
import { CohortAnalyticsSection } from "../features/performance/components/CohortAnalyticsSection";
import { PrimaryFilterBar, ThresholdFilterBar } from "../features/performance/components/FilterBars";
import { VideoDetailModal } from "../features/performance/components/VideoDetailModal";
import { SCRAPE_CADENCE, SCRAPE_NOTE } from "../features/performance/constants";
import { TRENDING_VIDEOS } from "../features/performance/data/sampleVideos";
import { pickSelectedVideo } from "../features/performance/logic/analytics";
import { filterAndScoreVideos } from "../features/performance/logic/scoring";
import { CategoryFilter, DateRange, PlatformFilter, ScoredVideo } from "../features/performance/types";

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

  const dataset = useMemo(
    () =>
      filterAndScoreVideos({
        videos: TRENDING_VIDEOS,
        dateRange,
        platform,
        categoryFilter,
        outliersOnly,
      }),
    [dateRange, platform, categoryFilter, outliersOnly],
  );

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

  const handleSelectVideo = (video: ScoredVideo) => {
    setSelectedId(video.reel_id);
    setShowDetail(true);
  };

  return (
    <>
      <Head>
        <title>ShortFlow · Performance Analytics</title>
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
            <span>{SCRAPE_CADENCE}</span>
          </div>
        </div>

        <section
          className="panel performance-hero-card"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(7, 10, 16, 0.6), rgba(7, 10, 16, 0.75)), url('/dashboard/performance-analytics.png')",
          }}
        >
          <div className="panel-header">
            <div>
              <p className="eyebrow">Performance analytics</p>
              <h1 className="title">Short-form outlier tracker</h1>
              <p className="subdued tiny">{SCRAPE_NOTE}</p>
            </div>
            <span className="chip chip-ghost">Demo cohort</span>
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
        />

        <section className="list-section">
          <div className="section-heading minimal">
            <div>
              <p className="eyebrow">Trending</p>
              <h3>Top videos</h3>
              <p className="tiny subdued">Sorted by views × outlier score</p>
            </div>
            <span className="pill tiny">{dataset.length} results</span>
          </div>
          {dataset.length ? (
            <div className="compact-grid">
              {dataset.map((video) => (
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
