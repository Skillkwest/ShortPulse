/**
 * Collapsible cohort analytics section with stats rail and scatter chart.
 * Keeps aggregation logic outside the page so the layout can stay declarative.
 */
import { PerformanceScatter } from "../../../components/PerformanceScatter";
import { BREAKOUT_SCORE } from "../constants";
import { CohortSummary, summarizeCohort } from "../logic/analytics";
import { performanceClass } from "../performanceRouteStyles";
import { ScoredVideo } from "../types";
import { formatCompact } from "../utils/formatters";

export type CohortAnalyticsSectionProps = {
  dataset: ScoredVideo[];
  advancedOpen: boolean;
  onToggle: () => void;
};

/**
 * Render the advanced analytics panel containing cohort stats and scatter plot.
 */
export function CohortAnalyticsSection({
  dataset,
  advancedOpen,
  onToggle,
}: CohortAnalyticsSectionProps) {
  const summary: CohortSummary = summarizeCohort(dataset, BREAKOUT_SCORE);

  return (
    <section className={performanceClass("panel")}>
      <button
        className={performanceClass("collapse-header")}
        onClick={onToggle}
        aria-expanded={advancedOpen}
      >
        <span>{advancedOpen ? "Advanced cohort analytics ▴" : "Advanced cohort analytics ▾"}</span>
      </button>
      {advancedOpen ? (
        <>
          <div className={performanceClass("stat-rail", "minimal")}>
            <div className={performanceClass("stat-card")}>
              <p className={performanceClass("stat-label")}>Breakout share</p>
              <p className={performanceClass("stat-value")}>
                <span>{summary.breakoutShare.toFixed(0)}%</span>
              </p>
              <p className={performanceClass("stat-sub")}>
                {summary.breakoutCount} videos ≥ {BREAKOUT_SCORE} score
              </p>
            </div>
            <div className={performanceClass("stat-card")}>
              <p className={performanceClass("stat-label")}>Median engagement</p>
              <p className={performanceClass("stat-value")}>
                {summary.medianEngagement.toFixed(2)}%
              </p>
              <p className={performanceClass("stat-sub")}>Across current filters</p>
            </div>
            <div className={performanceClass("stat-card")}>
              <p className={performanceClass("stat-label")}>Median velocity</p>
              <p className={performanceClass("stat-value")}>
                {formatCompact(summary.medianVelocity)}/hr
              </p>
              <p className={performanceClass("stat-sub")}>Views per hour</p>
            </div>
            <div className={performanceClass("stat-card", "stat-card-accent")}>
              <p className={performanceClass("stat-label")}>Median outlier factor</p>
              <p className={performanceClass("stat-value")}>
                {summary.medianOutlier ? `${summary.medianOutlier.toFixed(1)}×` : "—"}
              </p>
              <p className={performanceClass("stat-sub")}>Outlier baseline multiplier</p>
            </div>
          </div>
          <div className={performanceClass("panel-header")}>
            <div>
              <p className="eyebrow">Momentum field</p>
              <h3>Velocity vs engagement</h3>
            </div>
            <span className={performanceClass("chip")}>Cohort · {dataset.length}</span>
          </div>
          <PerformanceScatter data={dataset} loading={false} />
        </>
      ) : null}
    </section>
  );
}
