/**
 * Cohort analytics helpers extracted from the performance page.
 * Provides deterministic calculations so UI components can remain declarative and focused on layout.
 */
import { BREAKOUT_SCORE } from "../constants";
import { ScoredVideo, TrendDirection } from "../types";
import { median } from "../utils/statistics";

export type CohortSummary = {
  breakoutCount: number;
  breakoutShare: number;
  medianEngagement: number;
  medianVelocity: number;
  medianOutlier: number;
  topPerformer?: ScoredVideo;
};

/**
 * Summarize the current dataset for the cohort summary rail.
 *
 * @param dataset The scored videos aligned to the current filters.
 * @param breakoutScore Threshold for considering a video a breakout performer.
 * @returns Aggregate metrics used in the stats rail.
 */
export function summarizeCohort(dataset: ScoredVideo[], breakoutScore: number = BREAKOUT_SCORE): CohortSummary {
  const breakoutCount = dataset.filter((d) => d.performance_score >= breakoutScore).length;
  const breakoutShare = dataset.length ? (breakoutCount / dataset.length) * 100 : 0;
  const medianEngagement = median(dataset.map((d) => d.engagement_rate * 100));
  const medianVelocity = median(dataset.map((d) => d.views_per_hour));
  const medianOutlier = median(dataset.map((d) => d.outlierMultiplier));
  const topPerformer = dataset.length
    ? dataset.reduce((prev, curr) => (curr.performance_score > prev.performance_score ? curr : prev), dataset[0])
    : undefined;

  return { breakoutCount, breakoutShare, medianEngagement, medianVelocity, medianOutlier, topPerformer };
}

/**
 * Pick the selected video from the dataset, falling back to the first row when the ID is missing.
 */
export function pickSelectedVideo(dataset: ScoredVideo[], selectedId?: string): ScoredVideo | undefined {
  if (!dataset.length) return undefined;
  if (!selectedId) return dataset[0];
  return dataset.find((v) => v.reel_id === selectedId) || dataset[0];
}

/**
 * Determine directional momentum for the dataset based on trend_direction.
 */
export function deriveTrendDirection(dataset: ScoredVideo[]): TrendDirection {
  if (!dataset.length) return "stable";
  const directionScore =
    dataset.reduce((score, v) => {
      if (v.trend_direction === "up") return score + 1;
      if (v.trend_direction === "down") return score - 1;
      return score;
    }, 0) / dataset.length;

  if (directionScore > 0.15) return "up";
  if (directionScore < -0.15) return "down";
  return "stable";
}
