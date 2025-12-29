/**
 * Dataset scoring and filtering for performance analytics.
 * Converts raw trending videos into scored records with outlier detection and platform baselines.
 * Pure functions keep React components slim and make it easier to swap the data source later.
 */
import { OUTLIER_MULTIPLIER_THRESHOLD } from "../constants";
import { CategoryFilter, DateRange, PlatformFilter, ScoredVideo, TrendingVideo } from "../types";
import { iqrStats, median } from "../utils/statistics";

const DATE_RANGE_TO_HOURS: Record<DateRange, number> = {
  "7d": 168,
  "30d": 720,
  "90d": 2160,
};

/**
 * Filter and score videos for the requested window, platform, and category filters.
 *
 * @param videos Raw trending videos to score.
 * @param dateRange Time window selector.
 * @param platform Platform filter; "all" leaves data unchanged.
 * @param categoryFilter Selected niche; "All" leaves data unchanged.
 * @param outliersOnly When true, only return rows whose views exceed the outlier threshold multiplier.
 * @param outlierThreshold Multiplier threshold override; defaults to OUTLIER_MULTIPLIER_THRESHOLD.
 * @returns A sorted list of scored videos including outlier metadata.
 */
export function filterAndScoreVideos({
  videos,
  dateRange,
  platform,
  categoryFilter,
  outliersOnly,
  outlierThreshold = OUTLIER_MULTIPLIER_THRESHOLD,
}: {
  videos: TrendingVideo[];
  dateRange: DateRange;
  platform: PlatformFilter;
  categoryFilter: CategoryFilter;
  outliersOnly: boolean;
  outlierThreshold?: number;
}): ScoredVideo[] {
  const windowHours = DATE_RANGE_TO_HOURS[dateRange];
  const windowed = videos
    .filter((video) => video.hours_since_publish <= windowHours)
    .filter((video) => (platform === "all" ? true : video.platform === platform))
    .filter((video) => (categoryFilter === "All" ? true : video.category === categoryFilter));

  const medianViewsAll = median(windowed.map((v) => v.views)) || 1;
  const platformBuckets = windowed.reduce<Record<string, number[]>>((acc, video) => {
    acc[video.platform] = acc[video.platform] || [];
    acc[video.platform].push(video.views);
    return acc;
  }, {});
  const platformMedianViews: Record<string, number> = Object.fromEntries(
    Object.entries(platformBuckets).map(([key, values]) => [key, median(values) || medianViewsAll]),
  );
  const { upperFence } = iqrStats(windowed.map((v) => v.views));

  const scored: ScoredVideo[] = windowed
    .map((video) => {
      const baseline = platformMedianViews[video.platform] || medianViewsAll || 1;
      const outlierMultiplier = video.views / baseline;
      const isIqrOutlier = video.views > upperFence;
      return { ...video, outlierMultiplier, isIqrOutlier, baselineViews: baseline, iqrUpperFence: upperFence };
    })
    .sort((a, b) => a.rank - b.rank);

  return outliersOnly ? scored.filter((v) => v.outlierMultiplier >= outlierThreshold) : scored;
}
