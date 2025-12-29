/**
 * Performance analytics type system.
 * Centralizes shared type definitions so charts, lists, and filter logic stay in sync.
 * Imported by pages and components to prevent drift between sample data, UI props, and calculations.
 */
export type PlatformFilter = "all" | "instagram" | "tiktok" | "youtube";

export type DateRange = "7d" | "30d" | "90d";

export type TrendDirection = "up" | "stable" | "down";

export type NicheTone = "premium" | "entertainment";

export type Niche = { value: string; label: string; tone: NicheTone };
export type CategoryFilter = "All" | Niche["value"];

export type ReelPerformance = {
  reel_id: string;
  reel_url: string;
  platform: PlatformFilter | "instagram" | "tiktok" | "youtube";
  publish_time: string;
  latest_scraped_at: string;
  views: number;
  likes: number;
  comments: number;
  shares_or_saves?: number | null;
  hours_since_publish: number;
  views_per_hour: number;
  engagement_rate: number;
  views_percentile: number;
  views_per_hour_percentile: number;
  engagement_rate_percentile: number;
  performance_score: number;
  thumbnail_url?: string;
  creator_username?: string | null;
  caption_text?: string | null;
};

export type TrendingVideo = ReelPerformance & {
  platform_label: "Instagram" | "TikTok" | "YouTube";
  category: string;
  completion_rate: number;
  click_through_rate: number;
  watch_time_seconds: number;
  trend_direction: TrendDirection;
  rank: number;
};

export type ScoredVideo = TrendingVideo & {
  outlierMultiplier: number;
  isIqrOutlier: boolean;
  baselineViews: number;
  iqrUpperFence: number;
};

export type AggregateStats = {
  avgEngagement: number;
  avgCompletion: number;
  totalViews: number;
  topCategory: string;
  fastestPlatform: string;
  trendingDirection: TrendDirection;
};

export type DateOption = { label: string; value: DateRange };
